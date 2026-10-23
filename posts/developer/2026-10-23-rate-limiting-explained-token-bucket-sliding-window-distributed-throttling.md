---
title: Rate Limiting Explained - Token Bucket, Sliding Windows and Distributed Throttling That Actually Holds
date: 2026-10-23
slug: rate-limiting-explained-token-bucket-sliding-window-distributed-throttling
tags: [Rate Limiting, API Design, Distributed Systems, Redis, Backend, System Design]
category: Developer
excerpt: A practical guide to rate limiting algorithms, distributed counters, Redis Lua scripts and the client-side retry behavior that keeps APIs fair and available.
readTime: 15 min read
published: true
---

# Rate Limiting Explained - Token Bucket, Sliding Windows and Distributed Throttling That Actually Holds

Every API eventually meets a client that asks for too much. Sometimes it is a scraper, sometimes it is a retry storm caused by an outage, and very often it is a well-meaning integration that forgot to paginate. Rate limiting is the set of techniques that decides how much traffic a caller may send in a given period, and what happens when that allowance runs out.

It sounds simple: count requests, reject the extras. In practice, rate limiting is a distributed systems problem hiding inside a few lines of middleware. Counters must stay correct across dozens of servers, limits must be fair across tenants, and the rejection path must not make an overloaded system worse. This guide walks through the algorithms, the distributed implementation details, and the client-side behavior that turns a limiter from a blunt instrument into a well-behaved contract.

## Table of Contents

- [Why Rate Limiting Matters](#why-rate-limiting-matters)
- [Rate Limits, Quotas and Throttling](#rate-limits-quotas-and-throttling)
- [The Core Algorithms](#the-core-algorithms)
  - [Fixed Window](#fixed-window)
  - [Sliding Window Log](#sliding-window-log)
  - [Sliding Window Counter](#sliding-window-counter)
  - [Token Bucket](#token-bucket)
  - [Leaky Bucket and GCRA](#leaky-bucket-and-gcra)
  - [Choosing an Algorithm](#choosing-an-algorithm)
- [Rate Limiting in a Distributed System](#rate-limiting-in-a-distributed-system)
  - [Centralized Counters with Redis](#centralized-counters-with-redis)
  - [The Atomicity Problem](#the-atomicity-problem)
  - [Hybrid Local and Global Limiting](#hybrid-local-and-global-limiting)
- [Designing the Rejection Path](#designing-the-rejection-path)
- [Real-World Example: Tiered API Limits](#real-world-example-tiered-api-limits)
- [Operating and Testing a Limiter](#operating-and-testing-a-limiter)
- [Key Takeaways](#key-takeaways)
- [Frequently Asked Questions](#frequently-asked-questions)

## Why Rate Limiting Matters

A rate limiter protects several things at once. Being explicit about which one you care about changes the design.

- **Availability.** Without a limit, one misbehaving client can saturate a connection pool, a database, or an upstream API your entire product depends on.
- **Fairness.** Multi-tenant systems must stop one customer's batch job from consuming capacity everyone else paid for.
- **Cost control.** Metered resources — LLM tokens, SMS, payment calls, map lookups — need a last line of defense for the budget.
- **Abuse resistance.** Credential stuffing, scraping and enumeration depend on volume. Limiting slows them down and makes them visible.
- **Predictable capacity.** A known ceiling lets you size autoscaling and downstream timeouts with something better than a guess.

![Server racks in a data center, where capacity is finite](https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80)

Separate rate limiting from **load shedding**. A limiter enforces a policy per caller before the work is expensive. Load shedding discards work once the system is past capacity, regardless of caller. Production needs both: limits keep normal traffic predictable, and shedding keeps the system alive when it is not.

## Rate Limits, Quotas and Throttling

The words are often used interchangeably, but they answer different questions.

| Concept | Question it answers | Typical enforcement |
| --- | --- | --- |
| Rate limit | How fast may you send? | Requests per second or minute |
| Quota | How much may you use in total? | Requests or tokens per day or month |
| Concurrency limit | How many requests may be in flight? | Active slots per caller |
| Throttling | What happens when you exceed a limit? | Delays, 429 responses, queueing |
| Load shedding | What happens when the system is full? | Drop or degrade, independent of caller |

A rate limit is about velocity, a quota about total consumption, and a concurrency limit about simultaneous pressure. A request well within its per-second limit can still be expensive if it holds a database connection for thirty seconds, which is why concurrency limits often matter more for slow endpoints.

Choose the **dimension** deliberately: per IP, user, API key, tenant, endpoint, or a combination. IP limits are easy but noisy because of NAT and shared egress. Key-based limits are fairer but require authentication before the limiter runs. Most mature APIs apply several: a coarse per-IP ceiling for unauthenticated floods, plus finer per-key limits for normal traffic.

## The Core Algorithms

There is no single best algorithm; each trades memory, precision, and burst tolerance differently. These are the five you are most likely to encounter.

### Fixed Window

The simplest approach divides time into buckets — say, one minute — and counts requests in the current bucket. When the count exceeds the limit, requests are rejected until the bucket rolls over.

Fixed windows are cheap: one counter per key, incremented and expired. Their weakness is the **boundary problem**. A client can send 100 requests at 12:00:59 and another 100 at 12:01:00 — 200 requests in about one second while never technically exceeding a one-minute limit. For internal services that burst is harmless; for a database or paid upstream it can be exactly the spike you wanted to prevent.

### Sliding Window Log

A sliding window log stores the timestamp of every accepted request. To check a new request, discard timestamps older than the window and compare the remaining count to the limit. It is precise: the limit holds over any interval of the given length, eliminating the boundary problem.

The cost is memory: 10,000 requests per hour means up to 10,000 timestamps per key, which is a lot of Redis entries at scale. Sliding logs suit low-volume, high-value operations such as login attempts, where precision matters more than storage.

### Sliding Window Counter

The sliding window counter is a compromise that approximates the sliding log with two counters. It keeps the current fixed-window count and the previous window's count, then estimates the rate with a weighted average based on how far into the current window you are.

```text
estimated = previous_count * (1 - elapsed_fraction) + current_count
```

If the previous minute had 80 requests, the current minute has 30, and you are 25 percent into the current minute, the estimate is `80 * 0.75 + 30 = 90`. That smooths the boundary problem using constant memory. The estimate can be slightly wrong at the edges, but it is accurate enough for most API gateways.

### Token Bucket

The token bucket is the most widely used algorithm for public APIs because it combines a sustained rate with controlled bursts. A bucket holds up to `capacity` tokens and refills at a fixed rate. Each request removes one token; if the bucket is empty, the request is rejected or delayed.

**The bucket level is the burst allowance.** A bucket with capacity 100 and a refill rate of 10 per second lets a client idle for a while, then send 100 requests instantly, after which it is limited to 10 per second. That matches real clients: mostly quiet, occasionally bursty.

![Token bucket flow - tokens refill continuously, requests consume them, and an em](https://raw.githubusercontent.com/ashwani983/ashwani983.github.io/main/assets/images/blog/rate-limiting-explained-token-bucket-sliding-window-distributed-throttling-diagram-1.png)

A useful variant is **lazy refill**: instead of a background job adding tokens, store the last refill timestamp and compute the token count on each request. Most Redis implementations do this, and an idle bucket costs nothing until touched.

### Leaky Bucket and GCRA

The leaky bucket is the mirror image of the token bucket. Requests enter a fixed-depth queue and drain at a constant rate; if the queue is full, new requests are rejected. The output is perfectly smooth, which is valuable when the downstream cannot tolerate bursts at all.

**GCRA** (Generic Cell Rate Algorithm) is a compact form of leaky-bucket behavior that stores one timestamp — the "theoretical arrival time" — instead of a queue. Telecom systems and some gateways use it for smooth pacing with minimal state, though it is less intuitive to tune than a token bucket.

### Choosing an Algorithm

| Algorithm | Memory per key | Burst handling | Precision | Good default for |
| --- | --- | --- | --- | --- |
| Fixed window | Very low | Poor at boundaries | Low | Coarse internal limits |
| Sliding log | High | Exact | High | Auth, payments, low volume |
| Sliding counter | Low | Smoothed | Medium | General API gateways |
| Token bucket | Low | Configurable burst | High | Public APIs, per-key limits |
| Leaky bucket / GCRA | Very low | None (smooth) | High | Protecting fragile upstreams |

If you are unsure, start with a token bucket for public API keys and a sliding window counter for broad per-IP protection. Both are cheap and well understood.

## Rate Limiting in a Distributed System

A single-process in-memory counter is easy to write and almost always wrong in production. With ten replicas each allowing 100 requests per minute, the effective limit is somewhere between 100 and 1,000 depending on load distribution. Worse, the limit changes whenever you autoscale, so the policy you documented is not the policy you enforce.

### Centralized Counters with Redis

The common solution is a shared counter store with atomic operations and expiry. Redis is popular for this because it offers sub-millisecond operations, key expiration, and server-side scripting. A naive implementation might read a counter, add one, and write it back:

```text
value = GET key
if value < limit:
    INCR key
    EXPIRE key 60
    allow()
else:
    reject()
```

Two race conditions lurk here. Two requests can read the same value and both decide they are under the limit. And if the process dies between `INCR` and `EXPIRE`, the key can live forever, silently locking a caller out.

### The Atomicity Problem

The fix is to make check-and-increment atomic. Redis supports this through Lua scripts, which execute on the server without interleaving other commands.

```lua
-- Fixed-window limiter: atomic check, increment and expiry
-- KEYS[1] = rate limit key
-- ARGV[1] = limit, ARGV[2] = window seconds
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[2])
end
if current > tonumber(ARGV[1]) then
  return {0, current, redis.call("TTL", KEYS[1])}
end
return {1, current, redis.call("TTL", KEYS[1])}
```

The script returns whether the request is allowed, the current count, and the remaining TTL for response headers. A token bucket variant stores remaining tokens and the last refill timestamp in a hash, then computes the refill inside the script. All state transitions happen inside one atomic unit.

> **Caution:** A distributed limiter introduces a new single point of failure. If Redis is unavailable, decide in advance whether the system should fail open (allow traffic, risk overload) or fail closed (reject traffic, risk an outage). Most teams fail open for read-heavy endpoints and fail closed for expensive or security-sensitive ones, with a local emergency limiter as a backstop.

### Hybrid Local and Global Limiting

Even an atomic Redis script costs a network round trip, which matters at high traffic. Two-tier limiting is a common fix:

1. **Local limiter.** Each instance keeps an in-memory token bucket sized to `global_limit / instance_count`, with a little headroom. Most requests are decided in microseconds.
2. **Global limiter.** Periodically, or when the local bucket is exhausted, the instance consults the shared store. This catches traffic skewed toward one replica.

The local tier can be slightly over-permissive during rebalancing, but it absorbs the common case cheaply and keeps the shared store from becoming a bottleneck.

![Circuit board and hardware representing computing infrastructure](https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80)

## Designing the Rejection Path

What you return when a limit is hit matters as much as the limit itself.

- Use **HTTP 429 Too Many Requests**. Do not reuse 403 or 503; they mean different things and confuse retry logic.
- Send **`Retry-After`** in seconds (or as an HTTP date) so the client can wait intelligently.
- Return **`RateLimit-Limit`**, **`RateLimit-Remaining`**, and **`RateLimit-Reset`** headers, or the older `X-RateLimit-*` variants, so the limit is observable before it is hit.
- Include a **machine-readable error code** and a short message. Clients should not parse prose.
- **Do not** count rejected requests in a way that extends the penalty indefinitely. An aggressive retry loop should not be able to keep itself locked out by refreshing its own window.

A minimal response:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 12
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 12

{"error":"rate_limited","message":"Retry after 12 seconds"}
```

On the client side, use exponential backoff with jitter. Retrying immediately, in lockstep with thousands of other clients, produces the thundering herd the limiter was meant to prevent.

```javascript
async function requestWithBackoff(url, options = {}, attempts = 5) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await fetch(url, options);
    if (response.status !== 429) return response;

    const retryAfter = Number(response.headers.get("Retry-After"));
    const base = Number.isFinite(retryAfter) ? retryAfter * 1000 : 2 ** attempt * 500;
    const jitter = Math.random() * base * 0.5;
    await new Promise((resolve) => setTimeout(resolve, base + jitter));
  }
  throw new Error("Exceeded retry attempts");
}
```

If a request is not safe to repeat — a payment, for example — pair retries with an **idempotency key** so the server can recognize a duplicate and return the original result rather than charging twice.

## Real-World Example: Tiered API Limits

Suppose you run a document-processing API with three plans, plus a global per-IP ceiling to blunt anonymous floods. A practical configuration might look like this:

| Plan | Sustained rate | Burst capacity | Daily quota | Max concurrent jobs |
| --- | --- | --- | --- | --- |
| Free | 5 req/min | 10 | 1,000 | 1 |
| Pro | 120 req/min | 60 | 100,000 | 8 |
| Enterprise | 2,000 req/min | 500 | Contractual | 64 |
| Anonymous (per IP) | 20 req/min | 20 | 500 | 1 |

Enforcement order matters: check the cheapest, broadest limits first so abuse is rejected before it touches authentication or billing.

1. Per-IP anonymous ceiling at the edge.
2. Authentication and API key resolution.
3. Per-key token bucket for the plan's sustained rate and burst.
4. Per-tenant concurrency limit around expensive work.
5. Daily quota check, usually cached rather than read on every request.

Two details make this work in practice. First, use **separate keys** for each limit, with a clear naming scheme such as `rl:key:{id}:sustained` and `rl:ip:{addr}:anon`. Second, attach the plan and limit configuration to the API key record so that changing a customer's plan takes effect immediately rather than after a deploy.

## Operating and Testing a Limiter

A limiter nobody can observe is a limiter nobody can tune. Emit metrics for allowed and rejected requests by limit name, plan, and endpoint. Track the **rejection ratio**: a sudden spike usually means an attack or a misconfigured client, and the two need different responses. Alert on limiter latency and on fallback decisions when the shared store is unavailable.

Rate limiters are full of time-dependent behavior, so test them deliberately:

- **Fake the clock.** Inject a time source so you can advance time and assert refill behavior deterministically.
- **Test the boundary.** Send exactly the limit, then one more, immediately before and after a window rolls over.
- **Test concurrency.** Fire parallel requests at a low limit and assert the accepted count never exceeds it.
- **Test failure modes.** Simulate the counter store being down and verify the documented fail-open or fail-closed behavior.
- **Test the client contract.** Confirm 429 responses include `Retry-After` and the rate limit headers, and that your SDKs honor them.

> **Note:** Rate limiting is not a substitute for authentication, input validation, or DDoS protection. It reduces the impact of abuse, but a botnet can spread requests across thousands of IPs. Network-level protections and account anomaly detection address different parts of the problem.

Finally, document the limits publicly. A limit that surprises a customer is a support ticket; one that is documented, observable in headers, and paired with an upgrade path is a product feature.

## Key Takeaways

- Rate limiting controls velocity, quotas control total usage, and concurrency limits control simultaneous pressure; mature APIs use all three.
- Choose the algorithm based on burst tolerance and memory: token bucket for public APIs, sliding window counter for broad protection, sliding log for high-value low-volume actions.
- In distributed systems, counters must be shared and atomic. Lua scripts in Redis are a practical way to make check-and-increment safe.
- Always return HTTP 429 with `Retry-After` and rate limit headers, and design clients to back off with jitter.
- Decide explicitly whether the limiter fails open or closed when its store is unavailable, and test that behavior.
- Document limits publicly and pair them with a clear upgrade path.

## Frequently Asked Questions

### Should rate limits be per IP, per user, or per API key?

Usually several. A coarse per-IP limit protects against unauthenticated floods, while per-key or per-tenant limits provide fairness for authenticated traffic. Avoid relying on IP alone for authenticated APIs: NAT and shared egress make IPs a poor identity signal.

### What is the difference between rate limiting and throttling?

Rate limiting is the policy defining how much traffic is allowed. Throttling is the enforcement behavior — delaying, queueing, or rejecting requests beyond the policy. The terms overlap casually, but the distinction is useful when designing the rejection path.

### Is a fixed window good enough?

For internal services with generous limits, often yes — it is simple and cheap. It breaks down when a downstream is sensitive to short bursts, because clients can send nearly twice the limit around a boundary. Use a sliding window or token bucket when burst shape matters.

### Can I use rate limiting to control LLM token costs?

Yes, but count the right unit. Requests per minute hide cost when one request uses a few tokens and another uses a hundred thousand. Add token-aware quotas, and cap total tokens per tenant rather than only call count.
