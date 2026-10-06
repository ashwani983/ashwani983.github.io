---
title: BGP Explained: How the Internet Picks Its Routes and Why One Leak Can Take It Down
date: 2026-10-06
slug: bgp-explained-internet-routing-rpki
tags: [BGP, Networking, Internet Infrastructure, RPKI, Routing, Cybersecurity]
category: Others
excerpt: Border Gateway Protocol quietly decides how traffic crosses the internet. Learn how BGP works, why route leaks happen, and how RPKI helps.
readTime: 10 min read
published: true
---

# BGP Explained: How the Internet Picks Its Routes and Why One Leak Can Take It Down

Every time you load a website, your packets leave your network and travel through a chain of independent networks — your ISP, a transit provider, a content network — until they reach the destination. Nobody owns that whole chain. There is no central router in the sky deciding the path. Instead, the networks that make up the internet constantly talk to each other using a single protocol: the **Border Gateway Protocol (BGP)**.

BGP is often called the glue of the internet, and for good reason. It is the protocol that exchanges routing information between autonomous systems (ASes), allowing roughly 80,000+ independently operated networks to agree on where traffic should go. It is also one of the most consequential protocols to get wrong: a single misconfigured route announcement can black-hole traffic for millions of users within seconds, and route leaks and hijacks still make global news.

This guide explains how BGP actually works — path selection, route attributes, the BGP state machine, and how the protocol converges — then walks through real-world failure modes and the modern defenses (RPKI and route origin validation) that operators are deploying today.

## Table of Contents

- [What Problem Does BGP Solve?](#what-problem-does-bgp-solve)
- [Core Concepts: ASes, iBGP and eBGP](#core-concepts-ases-ibgp-and-ebgp)
- [How a BGP Route Announcement Travels](#how-a-bgp-route-announcement-travels)
- [The BGP Path Selection Algorithm](#the-bgp-path-selection-algorithm)
- [The BGP Session Lifecycle](#the-bgp-session-lifecycle)
- [When BGP Goes Wrong: Leaks, Hijacks and Outages](#when-bgp-goes-wrong-leaks-hijacks-and-outages)
- [Defending BGP: RPKI and Route Origin Validation](#defending-bgp-rpki-and-route-origin-validation)
- [Real-World Example: Anatomy of a Route Leak](#real-world-example-anatomy-of-a-route-leak)
- [Key Takeaways](#key-takeaways)
- [Frequently Asked Questions](#frequently-asked-questions)
- [Related Articles](#related-articles)

## What Problem Does BGP Solve?

Inside a single network, an interior gateway protocol such as OSPF or IS-IS can flood link-state information to every router, and each router can compute an exact shortest path. That works because one team controls every router.

The internet is not one network. It is a federation of autonomous systems, each with its own address space, its own policies, and its own reasons for preferring some paths over others. An ISP may prefer a cheap transit provider over an expensive one regardless of latency. A content provider may want inbound traffic to enter at the datacenter closest to the user. An enterprise may want all outbound traffic to funnel through a security inspection point.

BGP exists to carry **reachability information between these administrative boundaries** while letting each participant express its own policy. It optimizes for policy, not for the shortest physical path — a crucial distinction.

> **Important:** BGP does not compute the shortest path in the way OSPF does. It computes the *policy-compliant* path that the advertiser is willing to announce and the receiver is willing to accept. Latency and hop count are usually invisible to it.

## Core Concepts: ASes, iBGP and eBGP

### Autonomous Systems

An autonomous system is a collection of IP networks and routers under the control of one entity (an ISP, a large enterprise, a cloud provider, a university) that presents a uniform routing policy to the outside world. Each AS is identified by a number:

| AS Number Type | Range | Example Use |
| --- | --- | --- |
| 16-bit (public) | 1–65534 (0 reserved) | Legacy assignments, small ISPs |
| 32-bit (public) | up to 4294967295 | Modern assignments from RIRs (ARIN, RIPE, APNIC...) |
| Private | 4200000000–4294967295 | Lab and internal BGP deployments (RFC 6996) |

You can see this in the real world with a quick `whois`:

```bash
$ whois -h whois.radb.net -- '-i origin AS13335'
% Information related to '104.16.0.0/13'
origin:       AS13335
descr:        Cloudflare, US
```

`AS13335` is Cloudflare. Every prefix it originates carries that origin AS, which is exactly the information BGP peers exchange.

### eBGP vs iBGP

- **eBGP (external BGP):** sessions between routers in *different* ASes. This is the internet-facing part of BGP — where routing policy, filtering, and RPKI validation matter most. Typically peering is established between directly connected neighbors using loopback or interconnect addresses, TTL 1 by default.
- **iBGP (internal BGP):** sessions between routers *within* the same AS, used to distribute externally learned routes to internal routers. iBGP does not re-advertise routes learned from one iBGP peer to another by default, which is why production networks use **route reflectors** or **confederations** to avoid a full mesh of iBGP sessions.

## How a BGP Route Announcement Travels

At its heart, BGP speaks in **NLRI** (Network Layer Reachability Information): prefixes like `203.0.113.0/24` paired with path attributes. The most important attribute is the **AS_PATH** — the list of ASes a prefix has traversed. Each time a route crosses an AS boundary, the advertising AS prepends its own AS number.

![BGP route propagation from an origin AS through transit providers to a remote ne](https://raw.githubusercontent.com/ashwani983/ashwani983.github.io/main/assets/images/blog/bgp-explained-internet-routing-rpki-diagram-1.png)

Two rules fall out of this design immediately:

1. **Loop prevention:** if a router sees its own AS number in the AS_PATH of an incoming route, it rejects the route. This stops a prefix from circling the internet forever.
2. **Path length as a rough preference:** a shorter AS_PATH generally wins (all else being equal), which is a crude but effective proxy for "fewer administrative hops."

Other attributes carry policy: **LOCAL_PREF** (only within an AS, expresses preferred exit), **MED** (hint to a neighbor about preferred entry), **COMMUNITY** (a tagging mechanism used for policy signaling, e.g., no-export, black-hole), **NEXT_HOP**, and weight (vendor-specific, Cisco/Juniper).

## The BGP Path Selection Algorithm

When a router learns multiple routes to the same prefix, it runs a well-known decision process (vendors differ in details, but the shape is consistent):

1. Highest **weight** (vendor-specific, e.g., Cisco)
2. Highest **LOCAL_PREF**
3. Locally originated route preferred
4. Shortest **AS_PATH**
5. Lowest **origin type** (IGP < EGP < incomplete)
6. Lowest **MED** (comparable only with same neighboring AS)
7. eBGP over iBGP
8. Lowest IGP metric to the **NEXT_HOP**
9. Oldest route (stable path, avoids churn)
10. Lowest router ID as tie-breaker

> **Caution:** Steps 1–6 encode *policy*, not physics. A route with a short AS_PATH can still send your packets across the planet at 150 ms RTT because BGP has no idea about latency. This is why operators use MED, local preference, and traffic engineering to steer flows deliberately.

## The BGP Session Lifecycle

BGP routers must establish a TCP connection (port 179) before exchanging any routes. The state machine is small and worth memorizing:

![BGP finite state machine for a peering session](https://raw.githubusercontent.com/ashwani983/ashwani983.github.io/main/assets/images/blog/bgp-explained-internet-routing-rpki-diagram-2.png)

- **OPEN** carries the AS number, hold timer (typically 90 s), and capabilities (4-byte AS, multiprotocol families, route refresh).
- **KEEPALIVE** messages are exchanged every ~30 s; if the **hold timer** expires with no message, the session drops and all routes learned through it are withdrawn.
- **UPDATE** messages announce or withdraw prefixes.
- **NOTIFICATION** messages close a session with an error code — and this is where misconfiguration hurts: a single unsupported attribute can bounce a production peering session repeatedly.

## When BGP Goes Wrong: Leaks, Hijacks and Outages

Because BGP trusts what peers tell it by default, three classic failure classes exist:

| Failure | What happens | Typical cause | Impact |
| --- | --- | --- | --- |
| **Route leak** | A route learned from a transit/provider is re-advertised to another provider, violating policy | Missing filter on `import`/`export` | Traffic detours through an unintended network; latency spikes or black holes |
| **Prefix hijack** | An AS announces a prefix it does not own | Misconfig, stale route object, or malicious actor | Traffic for the victim prefix is attracted to the attacker or dropped |
| **Flap / instability** | Session bounces cause rapid announce/withdraw cycles | Buggy config, overloaded router, overloaded control plane | Convergence churn across the internet; CPU spikes on peers |

Prefix hijacks are not theoretical. In 2008, Pakistan Telecom's attempt to block YouTube locally leaked a more-specific `208.65.153.0/24` announcement to its upstream, and YouTube became unreachable globally for a period. Similar incidents have affected banks, payment providers, and government networks in subsequent years — the mechanism never changed: the world believed the announcement because there was (at the time) no cryptographic way to reject it.

## Defending BGP: RPKI and Route Origin Validation

The modern answer is **RPKI (Resource Public Key Infrastructure)** — a cryptographic framework that binds IP prefixes and AS numbers to the organizations that legitimately hold them. Note that while it shares the "PKI" name with X.509 certificate infrastructure, RPKI secures routing objects, not TLS sessions; it uses signed **ROAs (Route Origin Authorizations)**.

A ROA states three things:

- Which **prefix** is authorized (`203.0.113.0/24`)
- Which **origin AS** may announce it (`AS64500`)
- The **maximum length** of the prefix allowed (`/24`, preventing someone from injecting a `/32` more-specific)

Routers receive **VRPs** (Validation Output: prefix, maxLength, AS) from a validator and check each incoming announcement:

- **VALID** — origin AS and prefix length match a ROA
- **INVALID** — a ROA exists but the announcement violates it
- **UNKNOWN** — no ROA covers the prefix

Operators then apply policy: many networks now drop or deprioritize `INVALID` routes, while still accepting `UNKNOWN` to avoid breaking the internet during the ongoing RPKI rollout.

```bash
# Example: checking RPKI status of a prefix on a router supporting RFC 6811
router# show bgp 203.0.113.0/24
BGP routing table entry for 203.0.113.0/24
  Paths: (1 available, best #1)
    64512 64500
      Origin IGP, valid, external, best (Local Pref)
      RPKI validation state: valid, valid ROA prefix 203.0.113.0/22
      Origin-AS validation state: valid
```

A quick way to see ROA coverage for any ASN is the Routinator or RIPE Stat API:

```bash
$ curl -s "https://stat.ripe.net/data/rpki-validation/data.json?resource=193.0.6.153&prefix=193.0.6.0/21" | jq '.data.state'
"valid"
```

Adoption has climbed steadily — by the mid-2020s a large share of globally routed prefixes had ROAs, particularly in regions where registries and operators actively pushed coverage — but validation is only as good as the filters at the receiving end. ROAs tell the router what *should* exist; the network's policy decides whether `INVALID` is dropped, lowered in preference, or ignored.

## Real-World Example: Anatomy of Route Leak

Consider a simplified leak between two providers:

1. `AS 64520` (transit) learns `203.0.113.0/24` from customer `AS 64512`.
2. `AS 64520` has a peering session with `AS 64530`, but its export policy was accidentally changed from `export: customer-routes` to `export: all`.
3. `AS 64530` receives the route over peering (normally a route it would only accept from customers or transit), computes its best path, and propagates it onward.
4. Networks downstream now prefer the leaked path. Traffic detours through `AS 64520`, which was never sized or contracted to carry it — queues fill, MTU mismatches appear, and some flows black-hole entirely.
5. `AS 64520`'s NOC receives alarms, identifies the changed export policy, and reverts it. The route is withdrawn; networks reconverge. With BFD and tuned timers, recovery is often seconds; without them, it can take minutes.

Mitigations that shorten the blast radius:

- **Strict prefix filters** (`prefix-list` / `route-map`) on every eBGP session, generated from IRR objects and RPKI VRPs
- **AS-path filters** that only accept routes whose leftmost AS matches the expected neighbor
- **BFD** (Bidirectional Forwarding Detection) for sub-second dead-peer detection
- **max-prefix limits** that tear down a session announcing far more routes than expected (a classic hijack signature)
- **MANRS actions** — the Mutually Agreed Norms for Routing Security program that operators commit to implementing

## Key Takeaways

- BGP exchanges reachability between autonomous systems and optimizes for **policy**, not physical distance or latency.
- Routes are identified by prefix + path attributes; the **AS_PATH** provides loop prevention and a coarse preference signal.
- The BGP session runs over **TCP/179** and moves through IDLE → CONNECT/ACTIVE → OPENSENT → OPENCONFIRM → ESTABLISHED.
- Route leaks and prefix hijacks remain the dominant failure modes because legacy BGP trusts peer announcements.
- **RPKI/ROA validation** gives routers a cryptographic basis to mark announcements VALID, INVALID, or UNKNOWN — but operators must still enforce filtering policy.
- Defense in depth matters: prefix filters, AS-path filters, max-prefix limits, BFD, and community standards like MANRS complement RPKI.

## Frequently Asked Questions

**Q1. What is the difference between BGP and OSPF?**
OSPF is an interior gateway protocol used *inside* a single administrative domain; it floods link state and computes shortest paths with Dijkstra's algorithm. BGP is an exterior gateway protocol used *between* autonomous systems; it is path-vector based and deliberately policy-driven. Most large networks run both: OSPF/IS-IS for internal topology, BGP for everything learned from outside.

**Q2. Why does BGP use TCP?**
TCP gives BGP reliable delivery, sequencing, and flow control so the protocol itself does not need to retransmit UPDATE messages. The trade-off is that TCP failure detection can be slow (default hold timer ~90 seconds), which is why operators pair BGP with BFD or tuned keepalive/hold timers for faster convergence.

**Q3. What exactly is a route leak?**
It is a violation of routing policy where routes learned from one neighbor (typically a customer or transit) are incorrectly re-advertised to another neighbor (typically a peer or upstream) that should not receive them. The leaked routes attract traffic through an unprepared network, causing latency spikes, black holes, or both.

**Q4. Does RPKI replace BGP?**
No. RPKI is a separate cryptographic layer that produces attestations (ROAs) which routers consult when evaluating announcements. BGP still carries the routes; RPKI only lets a router decide whether an announcement is authorized. Think of it as a signature check on top of an existing, trust-based protocol.

**Q5. How can I see what my AS or ISP announces to the internet?**
Public tools expose this easily: `whois` and `dig` show origin AS for a prefix, RIPE Stat and BGPStream let you inspect current paths and RPKI validation state, and looking glasses hosted by ISPs let you query the BGP table from their vantage point.

## Related Articles

- DNS Explained: The Complete Guide to the Internet's Phonebook
- HTTP/3 and QUIC Explained: The Next-Generation Web Transport Protocol
- Understanding the TCP Three-Way Handshake: A Comprehensive Guide
- Zero Trust Architecture Explained: Replacing Network Perimeters with Identity-Based Security
- Mastering Security Fundamentals: A Comprehensive Guide to Cybersecurity Basics
