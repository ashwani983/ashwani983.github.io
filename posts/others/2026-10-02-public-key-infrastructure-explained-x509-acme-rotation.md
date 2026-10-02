---
title: Public Key Infrastructure Explained: X.509 Certificates, ACME Automation and Zero-Downtime Rotation
date: 2026-10-02
slug: public-key-infrastructure-explained-x509-acme-rotation
tags: [PKI, X.509, TLS, Certificates, ACME, Security, DevSecOps]
category: Others
excerpt: How X.509 certificates, certificate authorities and ACME automation keep TLS safe, and how to issue, rotate and monitor them without outages.
readTime: 14 min read
published: true
---

# Public Key Infrastructure Explained: X.509 Certificates, ACME Automation and Zero-Downtime Rotation

Every `https://` page load, API call and service mesh connection is backed by a public key infrastructure (PKI) operation. A certificate proves who owns a key, a certificate authority (CA) vouches for that proof, and a trust store decides which vouches count. Keys, certificates, authorities, policy and revocation — that is PKI.

What has changed recently is the operational surface: nobody renews a web certificate by emailing a CA, nobody keeps TLS keys in a shared folder, and the industry plan is that most public certificates will soon be valid for **weeks, not years**. This guide covers what sits inside a certificate, how a chain of trust is built and verified, how ACME automates issuance, and how to run certificate lifecycle management without an expiry outage.

## Table of Contents

- [What Public Key Infrastructure Actually Is](#what-public-key-infrastructure-actually-is)
- [Anatomy of an X.509 Certificate](#anatomy-of-an-x509-certificate)
- [The Chain of Trust](#the-chain-of-trust)
- [The Certificate Lifecycle](#the-certificate-lifecycle)
- [ACME: Issuance as an API](#acme-issuance-as-an-api)
- [cert-manager in Kubernetes](#cert-manager-in-kubernetes)
- [Why Certificate Lifetimes Are Collapsing](#why-certificate-lifetimes-are-collapsing)
- [Choosing Keys and Algorithms](#choosing-keys-and-algorithms)
- [Private Key Hygiene](#private-key-hygiene)
- [Debugging Certificates in Practice](#debugging-certificates-in-practice)
- [Private and Workload PKI](#private-and-workload-pki)
- [Real-World Example: Hardening TLS at Scale](#real-world-example-hardening-tls-at-scale)
- [Common Pitfalls](#common-pitfalls)
- [Key Takeaways](#key-takeaways)
- [Frequently Asked Questions](#frequently-asked-questions)

## What Public Key Infrastructure Actually Is

PKI binds an identity to a public key so that other parties can verify the binding. It has four moving parts:

| Pillar | What it is | Typical example |
| --- | --- | --- |
| **Key pair** | A public key plus a secret private key | ECDSA P-256 key for `api.example.com` |
| **Certificate** | A signed statement binding identity, key and constraints | TLS server certificate valid 90 days |
| **Certificate authority** | An entity that signs certificates after validating control | Let's Encrypt, an internal PKI team |
| **Policy and trust** | Who may issue what, and which roots are trusted | CA/Browser Forum rules, root stores |

Asymmetric keys make TLS practical: a shared secret must be distributed securely and, once leaked, is leaked forever, while an asymmetric pair lets a server prove knowledge of its *private* key by signing during the TLS 1.3 handshake (RFC 8446). PKI's job is to make that proof verifiable by a third party.

![Padlock symbol representing encrypted HTTPS connections](https://commons.wikimedia.org/wiki/Special:FilePath/Padlock-Full-Waki285.svg?width=480)

### The two directions of trust

Certificates serve two distinct roles:

- **Server authentication** — "I am `example.com`." The everyday TLS certificate.
- **Client authentication** — "I am the workload with identity `spiffe://prod-cluster/ns-payments/sa-checkout`." This is mTLS and workload identity, the backbone of zero-trust networks.

Both use the same X.509 format and chain logic; only the subject and extensions differ.

## Anatomy of an X.509 Certificate

An X.509 certificate (RFC 5280) is a signed ASN.1 structure. You never need to parse ASN.1 by hand, but knowing the fields explains most production failures:

- **Subject Alternative Name (SAN)** — the names covered. Clients check the SAN list, not the legacy Common Name.
- **Issuer** and **serial number** — the signing CA, plus the unique identifier revocation lists refer to.
- **Validity** — `notBefore` and `notAfter`. This is the field your pager fires on.
- **Public key algorithm** — RSA or EC, with size or curve.
- **Extensions** — SAN, Key Usage, Extended Key Usage (`serverAuth`/`clientAuth`), Basic Constraints (`CA:FALSE` on a leaf), Authority Information Access, Certificate Transparency data.
- **Signature** — the CA's signature over everything above, making the certificate tamper-evident.

```bash
openssl s_client -connect example.com:443 -servername example.com </dev/null 2>/dev/null \
  | openssl x509 -noout -text
```

The most common mismatch in the wild is a certificate issued for `example.com` while the user typed `www.example.com`, or a wildcard `*.example.com` used for `api.example.com` — a wildcard matches exactly one label, never two.

> **Note:** a certificate is a *public* document containing no secrets, so publishing it is a feature, not a leak. The common operational mistake is the opposite: locking down access to the `.crt` file while leaving the private key readable in a container image.

## The Chain of Trust

A leaf certificate is almost never signed directly by a root. Roots are long-lived trust anchors shipped inside operating systems and browsers; intermediate CAs absorb day-to-day signing so the root key stays safe.

![A leaf certificate is validated by walking up to a trusted root](https://raw.githubusercontent.com/ashwani983/ashwani983.github.io/main/assets/images/blog/public-key-infrastructure-explained-x509-acme-rotation-diagram-1.png)

Verification walks the other way: the client holds the root, receives the leaf and usually the intermediate from the server, and checks every signature, name, validity and constraint until it reaches a trust anchor it already has. If the chain ends at an unknown root, the connection simply fails.

**Certificate Transparency** (RFC 6962) sits alongside this. Public CT logs record every publicly trusted certificate, so a mis-issuance becomes auditable within minutes; search your own domain's history at `crt.sh`.

## The Certificate Lifecycle

Every certificate moves through the same five stages, each with its own 3 a.m. failure mode:

1. **Key generation** — on the host or by the CA; failure: weak or reused keys.
2. **Request** — CSR or ACME order; failure: wrong SAN list, rate limits.
3. **Validation** — proving control of the name; failure: DNS propagation, blocked port 80.
4. **Delivery** — chain and key reaching the consumer; failure: leaf served without the intermediate.
5. **Rotation and revocation** — renewal before `notAfter`; failure: no automation, or no reload.

| Mechanism | How revocation is checked | Reality |
| --- | --- | --- |
| **CRL** (RFC 5280) | CA publishes revoked serial numbers | Simple and cacheable, but large CAs ship large files |
| **OCSP** (RFC 6960) | Client queries the CA per certificate | Precise but slow; soft-fail behaviour historically let revoked certs through |
| **OCSP stapling** (RFC 6066) | Server attaches a fresh signed OCSP response | Cheap for clients, but the server must fetch it |
| **Must-Staple** (RFC 7633) | Client must reject if no stapled status is present | Strong, but breaks if the server cannot staple |
| **Short lifetime** | The certificate expires on its own | Removes the revocation problem instead of solving it |

> **Caution:** revocation is genuinely hard on the public web. Browsers largely stopped relying on live OCSP because of latency and soft-fail behaviour, and Let's Encrypt announced in 2024 that it would stop embedding OCSP responder URLs in newly issued certificates, with the change taking effect in 2025. Short lifetimes — not revocation checking — are the industry's actual answer, which is why the next sections matter operationally.

## ACME: Issuance as an API

ACME (Automatic Certificate Management Environment, RFC 8555) turns issuance into a standard protocol: a client proves control of a name, the CA issues a certificate and returns it as a signed structure. No CSRs to email, no support tickets. A minimal order:

1. Create a key account and fetch the CA directory (nonce, endpoints, terms URL).
2. Authorise identifiers such as `example.com` and `www.example.com`.
3. Answer a **challenge** proving control of those identifiers.
4. Finalise the order; the CA issues and returns the chain.
5. Renew before expiry — repeatedly, forever.

![ACME makes issuance and renewal a repeating automated loop](https://raw.githubusercontent.com/ashwani983/ashwani983.github.io/main/assets/images/blog/public-key-infrastructure-explained-x509-acme-rotation-diagram-2.png)

![HTTPS padlock with the Let's Encrypt logo](https://commons.wikimedia.org/wiki/Special:FilePath/HTTPS%20lock%20Let%27s%20Encrypt.svg?width=640)

### Challenge types

| Challenge | How control is proven | Use it when |
| --- | --- | --- |
| **HTTP-01** | Serve a token at `http://<domain>/.well-known/acme-challenge/<token>` | Web servers with inbound port 80 reachable from the internet |
| **DNS-01** | Publish a `TXT` record under `_acme-challenge` | Wildcards, internal DNS, hosts without inbound access |
| **TLS-ALPN-01** | Answer a special TLS handshake on port 443 | Rare in practice |

Wildcards such as `*.example.com` are obtainable only via DNS-01, which needs API credentials for your DNS provider — the part of ACME that usually requires engineering rather than configuration.

Two details bite in production:

- **Rate limits.** Public CAs limit issuance per registered domain, per exact set of names and per duplicate certificate. Templating one certificate across thousands of hosts is the fastest route to a wall. Read the current numbers from the CA's own documentation rather than trusting a cached blog post.
- **CAA records (RFC 8659).** A `CAA` DNS record tells public CAs which of them may issue for your domain. If a migration stalls with `CAA` errors, this record is the culprit.

## cert-manager in Kubernetes

In a cluster, [cert-manager](https://cert-manager.io) is the de facto controller: it watches `Certificate` and `Issuer` resources, solves ACME challenges, stores the result in a Kubernetes `Secret` and can inject files into pods. The same model works with internal PKI.

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: platform@example.com
    privateKeySecretRef:
      name: letsencrypt-account-key
    solvers:
      - dns01:
          route53:
            region: eu-west-1
---
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: api-tls
  namespace: payments
spec:
  secretName: api-tls          # cert, key and CA chain in one Secret
  duration: 2160h              # 90 days
  renewBefore: 720h            # rotate 30 days early
  privateKey:
    algorithm: ECDSA
    size: 256
  issuerRef:
    name: letsencrypt
    kind: ClusterIssuer
  dnsNames:
    - api.example.com
```

`renewBefore` is what makes rotation a non-event; a duration without it is a countdown timer.

> **Caution:** cert-manager updates mounted files in place, but your application may not notice. Nginx, HAProxy and most Go services load a certificate once at startup. Without a reload hook (`ingress-nginx` does this automatically through its controller; standalone deployments need `nginx -s reload` or `SIGHUP`), you keep serving the old certificate until the next restart. Kubernetes `Secret` values also live in etcd, so enable encryption at rest and strict RBAC on `secrets`.

## Why Certificate Lifetimes Are Collapsing

Manual renewal does not scale to tens of thousands of hosts, so the industry is removing the human from the loop:

- The **CA/Browser Forum ballot SC-081** reduces the maximum validity period for publicly trusted TLS server certificates to **200 days**, and as approved schedules further reductions to 100 days and then 47 days. Check the currently approved ballot for exact milestone dates.
- **CISA Binding Operational Directive 17-01** pushes federal agencies toward comparable maximum lifetimes.

Factor in lead time: you need a CA you can talk to, automation covering every hostname including internal ones, and an inventory you trust. The strategic reading matters more than the dates — shorter lifetimes move the security value from *revocation* to *issuance control*, which makes your CA account credentials, DNS API tokens and inventory the crown jewels.

## Choosing Keys and Algorithms

| Algorithm | Key size | Approximate strength | Practical notes |
| --- | --- | --- | --- |
| RSA | 2048 bit | ~112 bit | Broad legacy support; safe default fallback |
| RSA | 3072 bit | ~128 bit | Larger handshakes and CPU cost, diminishing returns |
| RSA | 4096 bit | ~150 bit | Rarely justified for web TLS |
| ECDSA | P-256 | ~128 bit | Small keys and signatures; a good default |
| ECDSA | P-384 | ~192 bit | Use where a stronger margin is required |
| Ed25519 | 256 bit | ~128 bit | Excellent properties, still not universally supported |

Costs differ too: RSA-4096 key generation is slow, RSA-2048 and ECDSA P-256 are fast. Profile it when rotating thousands of certificates on a small fleet.

Post-quantum key exchange is reaching real TLS stacks under names such as `X25519MLKEM768` (earlier deployed as `X25519Kyber768Draft00`). This is a **key-exchange** upgrade layered alongside classical exchange; certificate signatures are unchanged — see [Post-Quantum Cryptography Explained](/post-quantum-cryptography-explained-preparing-for-the-quantum-computing-threat).

Whichever you pick: let libraries and CAs generate keys, never a hand-rolled generator, and keep signing keys in an HSM or cloud KMS when policy requires FIPS 140-3 validated modules.

## Private Key Hygiene

The private key is the entire asset:

1. **Never commit a key to Git** — not even a temporary one. Add patterns to `.gitignore` and scan history.
2. **Generate it on the host that uses it.** The server proves possession during the handshake, so the key never needs to travel.
3. **Restrict permissions** — `chmod 600`, owned by the service user, in a directory nothing else can read.
4. **Keep it out of container images.** Baking a certificate into an image ships its key to every node, mirror and layer cache.
5. **Use a secret manager or HSM** when the key belongs to a signing service.
6. **Have a revocation plan.** Know which CAs you use, their revocation contact and how fast they act.

## Debugging Certificates in Practice

Most certificate incidents are diagnosed with a few commands:

```bash
# What does the server send, and in what order?
openssl s_client -connect api.example.com:443 -servername api.example.com -showcerts </dev/null

# Validate a chain the way a strict client would
openssl verify -CAfile root.pem -untrusted intermediate.pem leaf.pem

# Validity dates and SANs, and is OCSP being stapled?
openssl x509 -in cert.pem -noout -subject -issuer -dates -ext subjectAltName
openssl s_client -connect api.example.com:443 -status </dev/null
```

Configure the server with the **full chain** — leaf plus intermediates, and *not* the root. With Certbot's layout that is `fullchain.pem` for `ssl_certificate` and `privkey.pem` for `ssl_certificate_key`. Serving only the leaf is the most common TLS deployment mistake: `curl` on a machine with an incomplete store may still work, and the breakage appears on someone else's phone.

## Private and Workload PKI

Public PKI issues certificates for public names, but a mesh with 400 pods holding 400 public certificates is nonsense — the identity that matters is "the checkout service", not a hostname.

**Internal PKI** swaps the public CA for your own: Active Directory Certificate Services, Smallstep `step-ca`, AWS Certificate Manager Private CA, Google CAS, or a Vault PKI secrets engine. The API is similar; the trust anchor is your root, distributed to the hosts that need it.

**SPIFFE and SPIRE** (CNCF projects) standardise this further. A workload gets a **SPIFFE ID** such as `spiffe://prod-cluster.net/ns/payments/sa/checkout`, and SPIRE issues a short-lived **X.509-SVID** binding that identity to a key after attesting its environment. Hour-long lifetimes are the design, not a prototype trick. Sigstore's Fulcio applies the same pattern to artifact signing — see [Supply Chain Security in DevOps](/supply-chain-security-in-devops-securing-your-cicd-pipeline-from-code-to-container).

## Real-World Example: Hardening TLS at Scale

Suppose you own 180 hosts across cloud load balancers, Kubernetes and legacy VMs, with manually issued one-year certificates and no inventory. A pragmatic six-week programme:

**Week 1 — inventory.** You cannot rotate what you cannot see.

```bash
for host in $(cat hosts.txt); do
  end=$(echo | openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null \
        | openssl x509 -noout -enddate | cut -d= -f2)
  issuer=$(echo | openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null \
        | openssl x509 -noout -issuer | cut -d= -f3)
  printf '%-32s %-24s %s\n' "$host" "$end" "$issuer"
done | sort -k2
```

Store that as a pipeline artifact. It is your certificate CMDB, and the `expiry` column becomes an alertable metric.

**Week 2 — one issuance path.** Pick ACME with DNS-01 using a least-privilege service account scoped to `_acme-challenge` TXT records; a zone-wide DNS token is unnecessary blast radius.

**Week 3 — pilot on low-risk hosts.** Wildcards per environment (`*.prod.example.com`) keep certificate counts low and renewal simple. Verify each pilot serves the **full chain** and that reloads take effect.

**Week 4 — automate renewal.** cert-manager for Kubernetes, an ACME client plus a deploy-and-reload hook for VMs, native ACME on managed load balancers, renewal starting around one third of the lifetime.

**Week 5 — observability.** Alert on `days_until_expiry` per host (warn at 30, page at 14 and 7), on issuance failures, and on issuer changes. A synthetic TLS check from outside your network catches what internal monitors cannot.

**Week 6 — tighten and retire.** Remove CA exemptions, delete long-lived manual certificates, lock issuance down with `CAA`, and document the emergency procedure for a forgotten host.

Success is not "we renewed our certificates" but that a new host gets a valid certificate without a human, and expiry has become a non-event.

## Common Pitfalls

1. **Serving the leaf without the intermediate.** Works on your laptop, breaks elsewhere.
2. **Long lifetimes "to reduce work".** Trades automation for recurring outage risk.
3. **Renewal without reload.** A new certificate on disk, the old one still served.
4. **Keys in images or Git.** Leaking the key defeats every other control.
5. **Wildcards treated as universal.** `*.example.com` matches neither `a.b.example.com` nor `example.com`.
6. **Ignoring clock skew.** Parse dates as UTC and keep NTP healthy.
7. **Public CAs for internal services.** Internal identity needs internal PKI or SPIFFE.
8. **One mega-CA token for everything.** Scope per environment.

## Key Takeaways

- PKI binds identity to a public key through certificates, authorities, trust anchors and policy — all four need managing.
- A certificate is trusted only because a client can walk from leaf to intermediate to a root it already holds; an incomplete chain breaks clients even when your own tests pass.
- Validation and revocation are the hard parts. Short lifetimes remove the revocation problem, which is why certificates are heading toward 200-day, 100-day and eventually 47-day validity.
- ACME turns issuance into an API; DNS-01 is what makes wildcards and internal DNS automatable, and where your DNS credentials matter.
- Automation is only complete when the consumer **reloads** the certificate. cert-manager without a reload hook fails silently.
- Shorter lifetimes shift the value from revocation to issuance control: CA accounts, DNS tokens and inventory are now the crown jewels.

## Frequently Asked Questions

**Do I need a certificate authority if I already use cloud infrastructure?**
Usually not for internet-facing services — AWS Certificate Manager, Google Cloud Load Balancing and Azure App Service integrate with public CAs and handle renewal. You still need PKI for internal workloads, code signing, and identities that are workloads rather than hostnames.

**Can I use a self-signed certificate in production?**
For a service only consumed by clients you control, yes — that is what a service mesh does, distributing its own root so every sidecar trusts every other. For traffic crossing a network you do not own, self-signed means either fragile pinning or disabled verification.

**What is the difference between a certificate and a CSR?**
A CSR is a *request* for a certificate, signed with the private key to prove possession. The certificate is the result, signed by the CA. ACME clients usually avoid external CSRs entirely; tools like Certbot still use them.

**How often should I rotate certificates?**
As often as practical, provided rotation is automated and observable. If rotation will happen every few weeks by default, any process depending on a human annual renewal is the thing to fix first.

**How do I test renewal before it matters?**
Expire the certificate on a canary host and force renewal, then confirm the live endpoint serves the new serial with a full chain — from a clean container with an empty trust store, not your workstation.

## Related Articles

- [Post-Quantum Cryptography Explained: Preparing for the Quantum Computing Threat](/post-quantum-cryptography-explained-preparing-for-the-quantum-computing-threat)
- [Zero Trust Architecture Explained: Replacing Network Perimeters with Identity-Based Security](/zero-trust-architecture-explained-replacing-network-perimeters-with-identity-based-security)
- [Supply Chain Security in DevOps: Securing Your CI/CD Pipeline from Code to Container](/supply-chain-security-in-devops-securing-your-cicd-pipeline-from-code-to-container)
- [HTTP/3 and QUIC Explained: The Next-Generation Web Transport Protocol](/http3-and-quic-explained-the-next-generation-web-transport-protocol)
- [OAuth 2.0 and OpenID Connect Explained: The Complete Guide to Modern Authentication and Authorization](/oauth-20-and-openid-connect-explained-the-complete-guide-to-modern-authentication-and-authorization)
