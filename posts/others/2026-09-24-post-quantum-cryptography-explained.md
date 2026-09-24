---
title: Post-Quantum Cryptography Explained: Preparing for the Quantum Computing Threat
date: 2026-09-24
slug: post-quantum-cryptography-explained
tags: [Post-Quantum Cryptography, Cybersecurity, Quantum Computing, Encryption, NIST, TLS]
category: Others
excerpt: Quantum computers could one day break RSA and ECC. Here is how post-quantum cryptography and NIST's new standards keep your data safe.
readTime: 12 min read
published: true
---

# Post-Quantum Cryptography Explained: Preparing for the Quantum Computing Threat

For three decades, the security of the entire internet has rested on a handful of math problems — factoring huge numbers and computing discrete logarithms. RSA, ECDSA, ECDH, and their derivatives protect everything from website logins to software updates to government communications.

Quantum computing threatens to dismantle that foundation. In 1994, mathematician Peter Shor published an algorithm that, on a sufficiently powerful quantum computer, could solve both of those problems so quickly that today's public-key cryptography would effectively stop working. The computers we have today cannot run Shor's algorithm at scale, but the cryptography we deploy today may still be protecting secrets decades from now.

This guide explains, in practical terms, what post-quantum cryptography (PQC) is, why a future "cryptanalytically relevant quantum computer" (CRQC) matters to you *today*, which algorithms NIST has standardized, and exactly what you should be doing about it in 2026.

![IBM Quantum System One, a commercial quantum computer](https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/IBM_Quantum_System_One.jpg/800px-IBM_Quantum_System_One.jpg)

## Table of Contents

- [Why Quantum Computers Threaten Modern Cryptography](#why-quantum-computers-threaten-modern-cryptography)
- [The Store Now, Decrypt Later Threat](#the-store-now-decrypt-later-threat)
- [NIST's Post-Quantum Standardization Effort](#nists-post-quantum-standardization-effort)
- [How Lattice- and Hash-Based Schemes Work](#how-lattice--and-hash-based-schemes-work)
- [Hybrid Key Exchange: The Pragmatic Path to Safety](#hybrid-key-exchange-the-pragmatic-path-to-safety)
- [What Needs to Upgrade](#what-needs-to-upgrade)
- [Real-World Example: Securing a Web Service](#real-world-example-securing-a-web-service)
- [A Practical Migration Roadmap](#a-practical-migration-roadmap)
- [Key Takeaways](#key-takeaways)
- [Frequently Asked Questions](#frequently-asked-questions)

## Why Quantum Computers Threaten Modern Cryptography

Modern cryptography is split into two flavors: symmetric and asymmetric. Symmetric ciphers like AES are fast, well understood, and — with modest adjustments — expected to survive the quantum era. Asymmetric (public-key) cryptography is the vulnerable half. It enables key exchange (so two parties can agree on a shared secret over an untrusted network) and digital signatures (so you can prove who sent a message).

Public-key schemes are built on what cryptographers call **trapdoor functions**: computations that are easy to perform in one direction but astronomically hard to reverse — *unless* you know a secret "trapdoor." RSA's trapdoor is factorization; elliptic-curve schemes' trapdoor is the discrete logarithm problem.

> **Core idea:** Classical public-key security relies on the assumption that certain problems are impractical to solve. A quantum computer running Shor's algorithm breaks that assumption for RSA, ECC, Diffie-Hellman, and their derivatives.

### Shor's Algorithm in a Nutshell

In 1994, Peter Shor showed that an ideal quantum computer could find the prime factors of an `n`-bit integer in roughly polynomial time (`O(n³)` or better, depending on the constant), and similarly solve the discrete logarithm problem that underpins elliptic-curve crypto. The best known **classical** algorithm for factoring a large semiprime — the General Number Field Sieve — is sub-exponential, which is what keeps 2048-bit RSA secure on normal hardware.

A famous back-of-the-envelope estimate from at the time Shor published suggested that factoring a 1000-digit number would need a quantum computer with roughly a few thousand logical qubits. That may sound small — modern processors measure qubits in the thousands — but physical qubits require massive error correction. Estimates scale to *millions* of physical qubits for a problem that would matter to an attacker. No one has built a machine that can break real-world RSA yet, and no one can honestly promise a date when they will. That uncertainty is precisely why forward planning matters.

![Quantum subroutine for order finding in Shor's algorithm](https://commons.wikimedia.org/wiki/Special:FilePath/Shor%27s_algorithm.svg?width=700)

The table below contrasts the classic and quantum cases for the two problems that matter most:

| Problem | Best classical attack | With Shor's algorithm |
| --- | --- | --- |
| Integer factorization (RSA) | Sub-exponential (General Number Field Sieve) | Polynomial |
| Discrete logarithm (ECC, DH, DSA) | Sub-exponential index calculus / Pollard's rho | Polynomial |
| Approximate Shortest Vector (lattices) | Exponential | No polynomial attack known — this is the key PQC bet |

### Grover's Algorithm and Symmetric Encryption

Symmetric cryptography has a milder problem. Grover's algorithm (1996) provides a **quadratic speedup** for unstructured search — meaning brute-forcing a 128-bit key drops from roughly `2^128` operations to roughly `2^64`, which is no longer comfortable for high-security uses. The standard mitigation is simply to use larger keys: AES-256 resists Grover-style search well enough that most authorities consider it safe for the foreseeable future, and hash functions can be strengthened by requiring longer outputs (SHA-256 becomes effectively 128-bit security against preimage search).

So the practical priority list is clear:

1. **Replace public-key algorithms** (RSA, ECDSA, ECDH, EdDSA, DSA) with post-quantum alternatives.
2. **Move high-value symmetric systems to AES-256** and double-length hashes where available.
3. **Design new systems with crypto-agility** so algorithm swaps remain cheap.

## The Store Now, Decrypt Later Threat

Here is the uncomfortable part: you do not have to wait for a working quantum computer to be affected by one. Encrypted data is captured and stored *every day* — TLS traffic, VPN tunnels, encrypted email, backups, and protocol messages. An adversary who records that ciphertext today and possesses a quantum computer in ten or fifteen years can decrypt it retroactively.

Security agencies call this the **"store now, decrypt later"** (also "harvest now, decrypt later") problem. For data that must remain secret for decades — health records, legal documents, national-security communications, long-lived trade secrets, personal data protected by privacy regulations — the clock is already running.

> ⚠️ **Caution:** If your ciphertext is captured today and your *new* keys are post-quantum, the plaintext protected by the *old* keys is still at risk. PQC only helps the data protected by PQC. This is why hybrid deployment is urgent now, not after a CRQC exists.

Forward secrecy helps a little but not enough: if an attacker records a TLS session and later breaks the ephemeral ECDH key agreement, the session plaintext is recoverable. Recording ciphertext is cheap; the threat is asymmetric.

## NIST's Post-Quantum Standardization Effort

The gold standard for PQC in practice is the NIST Post-Quantum Cryptography Standardization process, which has run since 2016 and produced the algorithm set everyone else is now building around.

### Timeline Highlights

- **2016** — NIST issues its call for post-quantum submissions.
- **2017** — The competition opens with 69 first-round candidates from teams worldwide.
- **July 2022** — NIST announces four winners: CRYSTALS-Kyber, CRYSTALS-Dilithium, Falcon, and SPHINCS+.
- **August 2024** — NIST publishes three finalized Federal Information Processing Standards: **FIPS 203** (ML-KEM), **FIPS 204** (ML-DSA), and **FIPS 205** (SLH-DSA).
- **2025** — NIST finalizes **FIPS 206** (FN-DSA, the standardized version of Falcon).
- **Ongoing** — Vendors ship native PQC support (major TLS libraries, browsers, and cloud providers), and regulators begin to require migration plans.

### The Four Foundation Algorithms

| Standard | Algorithm | Role | Basis | Typical Use |
| --- | --- | --- | --- | --- |
| FIPS 203 | ML-KEM (Kyber) | Key encapsulation (KEM) | Module-LWE lattices | TLS key exchange, encrypted messaging |
| FIPS 204 | ML-DSA (Dilithium) | Digital signature | Module-LWE lattices | General-purpose signing, certificates |
| FIPS 205 | SLH-DSA (SPHINCS+) | Digital signature | Stateless hash-based | High-security, low-trust-assumption signing |
| FIPS 206 | FN-DSA (Falcon) | Digital signature | NTRU lattices | Compact signatures for constrained devices |

The bundle of FIPS 203/204/205 is what most regulators and cloud providers are standardizing on; FIPS 206 (Falcon) is the smaller-signature choice for bandwidth-constrained or certificate-size-limited environments.

> **Terminology:** A **KEM** (key encapsulation mechanism) is the post-quantum replacement for traditional key-exchange such as ECDH — it lets two parties derive a shared secret without ever transmitting it. ML-KEM provides both encryption and "decapsulation" for that shared secret in one package.

### Key and Signature Sizes at a Glance

Post-quantum cryptography is not free. Keys and signatures are bigger than RSA- or ECC-era sizes, and some schemes are noticeably slower. Approximate figures (per the published standards):

| Scheme | Public key | Secret data | Notes |
| --- | --- | --- | --- |
| ML-KEM-768 | ≈ 1.2 KB | ciphertext ≈ 1.1 KB | Good default for TLS |
| ML-KEM-1024 | ≈ 1.6 KB | ciphertext ≈ 1.6 KB | Higher security margin |
| ML-DSA-65 | ≈ 2 KB | signature ≈ 3.3 KB | Balanced signature default |
| SLH-DSA-SHA2-128s | miniscule key | signature ≈ 8 KB | Large signature, minimal trust assumptions |
| Example classical (ECC P-256) | 32 bytes | signature ≈ 64 bytes | Baseline for comparison |

Figures like these are why hybrid deployments pair PQC with classical algorithms: correctness is assured by the classical path, *and* the PQC path breaks if the classical path is also broken — each scheme must be cracked to compromise the hybrid.

## How Lattice- and Hash-Based Schemes Work

To build confidence in PQC, it helps to know roughly why the new math is hard for quantum computers.

### Structured Lattices

Most PQC designs are built around **module lattices** and the **Learning With Errors** assumption. Intuitively: picture a grid of points extending infinitely in many dimensions (the lattice). Given a point that sits near (but not on) the lattice — a noisy point — find the nearest genuine lattice point. This "Approximate Shortest Vector" (SVP) style problem has resisted both classical and quantum attacks for decades, and crucially, Shor's algorithm gives no speedup for it when the lattice dimension is chosen appropriately.

Kyber and Dilithium push this structure into a compact algebraic form (module-LWE), which keeps keys and ciphertexts surprisingly small while preserving strong worst-case-hardness arguments.

### Stateless Hash-Based Signatures

A radically different idea underlies SPHINCS+: build signatures purely from a **hash function** with cryptographic one-wayness. If the hash function is quantum-resistant (e.g., using SHA-2 at adequate output lengths), the signature scheme inherits that resistance. SPHINCS+ is a stateless signature scheme — each signature is fresh and does not require maintaining signing state, which makes it simpler to adopt safely. The trade-off is the large signature size and slower signing, which makes it a favorite for high-assurance, low-bandwidth-critical applications rather than busy TLS handshakes.

## Hybrid Key Exchange: The Pragmatic Path to Safety

Nobody wants to flip a switch from "classical only" to "PQC only" overnight — downgrade attacks, interop bugs, and performance regressions are real. The industry's answer is **hybrid key exchange**: combine an existing classical scheme (e.g., X25519) with a post-quantum KEM (e.g., ML-KEM-768) in a single handshake, and feed both shared secrets into the key schedule. Compromise requires breaking *both* halves.

The widely deployed hybrid group is `X25519MLKEM768`, an Internet-Draft standardized by the IETF for TLS 1.3. Google's Chrome began rolling it out by default for TLS 1.3 connections in 2024, and OpenSSL's 3.5 release (April 2025) shipped ML-KEM key-encapsulation support so that servers and reverse proxies can follow. The flow looks like this:

![Hybrid TLS 1.3 key exchange combining X25519 and ML-KEM](https://raw.githubusercontent.com/ashwani983/ashwani983.github.io/main/assets/images/blog/post-quantum-cryptography-explained-diagram-1.png)

Conceptually, the shared secret combines both results:

```
hybrid_shared = HKDF(
    concat(
        mlkem.shared_secret,   # post-quantum path
        x25519.shared_secret   # classical path
    )
)
```

If a future quantum computer breaks X25519, the ML-KEM path still protects the session. If ML-KEM is ever found weak, the classical path still protects it. That defense-in-depth is why hybrid is the recommended migration pattern for 2026.

## What Needs to Upgrade

Post-quantum migration is not just about your web server's TLS cipher list. The vulnerable primitives are deeply embedded everywhere.

### TLS and Certificate Authorities

Browser-server connections are the best-known path. TLS 1.3 already supports post-quantum key exchange on the client side (via hybrid groups), and certificate authorities are working through the thornier problem of issuing **post-quantum (and hybrid) X.509 certificates** whose signatures verify across old and new ecosystems. Expect a period where certificates carry both a classical and a PQC signature chain.

### Code Signing and Software Supply Chains

Signed artifacts have long lifetimes: that signed package you published today might be verified — and trusted — for years. If the signer's key was classical-only and is later broken, an attacker can forge updates that downstream systems accept. This connects directly to supply-chain security practice: SBOMs, provenance, and signatures are all on the PQC migration list. [Supply Chain Security in DevOps: Securing Your CI/CD Pipeline from Code to Container](/blog/supply-chain-security-in-devops) covers the fundamentals that PQC hardening then extends.

### VPNs, IPsec, and Network Infrastructure

IPsec, WireGuard-style tunnels, SSH host keys, and DNSSEC (which signs DNS records for years) all rely on classical signatures or KEMs. DNSSEC in particular is a good long-horizon candidate for hash-based signatures like SLH-DSA. Work through each protocol family's roadmap rather than assuming a single "enable PQC" flag covers everything.

### Blockchains and Digital Wallets

Blockchains authenticate transactions with ECDSA or Schnorr signatures. If those keys become breakable, historical transactions and, more importantly, the ability to forge new ones, are at stake. Several chains and wallet ecosystems are already designing upgrade paths and post-quantum signature options; this is a domain where leadership should be planning, not panicking, but it is genuinely on the migration list.

## Real-World Example: Securing a Web Service

Let's walk through a realistic 2026 migration for a moderately sized SaaS product that terminates TLS at a reverse proxy and signs release artifacts in CI.

1. **Inventory.** List every certificate, signing key, and key-exchange configuration. You cannot protect what you have not enumerated.
2. **Move symmetric cores to AES-256.** Set TLS cipher preferences to AES-256-GCM where available, and default new hashes to SHA-256/SHA-384.
3. **Enable hybrid key exchange on TLS.** Configure your reverse proxy or TLS library to negotiate `X25519MLKEM768` for TLS 1.3. With OpenSSL 3.5+, you can verify provider support locally:

```bash
# Confirm ML-KEM support in your OpenSSL build
openssl list -kem-algorithms | grep -i ML-KEM
```

4. **Issue hybrid certificates.** Work with your CA to roll out certificates carrying both a classical signature chain and a post-quantum (ML-DSA) one, so both worlds interoperate during the transition.
5. **Sign artifacts with PQC as well as classical signatures.** Keep the classical signature for compatibility, add an ML-DSA or SLH-DSA signature alongside it, and publish both so old verifiers keep working.
6. **Measure, monitor, roll back.** Benchmark handshake latency and handshake failure rates in staging before production, and keep a rollback branch. Cryptography migrations are reversible — bias toward boring, incremental rollouts.

If you are testing TLS behavior in an automated QA pipeline, this is also a superb opportunity to extend [visual regression testing](/blog/visual-regression-testing) and integration tests to assert that clients actually negotiate the hybrid group on every path.

## A Practical Migration Roadmap

Every organization's answer will differ, but the shape of a healthy plan in 2026 looks like this:

1. **Create a cryptography inventory** — a single system of record for keys, certificates, protocols, and their owners.
2. **Classify data by confidentiality lifetime.** Anything that must stay secret for 15+ years is your top priority.
3. **Prioritize long-lived paths first**: roots-of-trust, CA keys, long-lived VPN/SSH identities, and signed software.
4. **Adopt hybrid everywhere feasible** — it is the safest incremental step and is natively supported by modern libraries.
5. **Keep symmetric at AES-256** and strengthen hashing where the security level warrants it.
6. **Automate re-keying and monitoring** so algorithm parameters are testable and auditable.
7. **Set a decommission deadline** for classical-only configurations once your PQC perimeter is proven, and track drift with security scanners.

![Practical post-quantum migration roadmap](https://raw.githubusercontent.com/ashwani983/ashwani983.github.io/main/assets/images/blog/post-quantum-cryptography-explained-diagram-2.png)

The single most important principle in all of this is **crypto-agility**: design your systems so that swapping an algorithm family does not require a re-architecture. The post-quantum standardization process will keep evolving for years; the software that survives is the software that treats algorithms as swappable components.

## Key Takeaways

- **Shor's algorithm breaks RSA, ECDH, ECDSA, and their relatives** on a sufficiently powerful quantum computer; Grover's algorithm forces symmetric crypto to AES-256 and longer hashes.
- **"Store now, decrypt later" means the threat is already live** for any ciphertext exposed today that must remain secret for decades.
- **NIST has standardized ML-KEM, ML-DSA, SLH-DSA (FIPS 203/204/205) and now FN-DSA (FIPS 206)** — these are becoming the universal building blocks in 2026.
- **Hybrid key exchange (e.g., `X25519MLKEM768`)** is the recommended migration path: add PQC alongside classical schemes instead of replacing them blindly.
- **PQC costs real bytes**: keys and signatures are much bigger than ECC-era sizes, so benchmark before you migrate.
- **Crypto-agility is the strategy that matters most.** Inventory your cryptography, version it like code, and keep algorithms swappable.

## Frequently Asked Questions

**Will quantum computers break AES-128?**
Not the way they break RSA. Grover's algorithm halves the effective key length, from 128 to roughly 64 bits of search complexity for a brute-force attack. Practical mitigations — longer keys — make AES-256 the recommended choice for high-assurance data.

**When will a cryptanalytically relevant quantum computer actually exist?**
No credible source has a precise date, and estimates changed over time. The safe assumption is that it may arrive within the lifetime of today's long-lived data. That is precisely why the migration advice says "hybrid now, not PQC-only-tomorrow."

**Is post-quantum cryptography slower and bigger?**
Yes and no. Key encapsulation (ML-KEM) handshakes are competitive, but signatures are slower and larger — ML-DSA-65 signatures are on the order of 3 KB versus 64 bytes for P-256. Hybrid deployments add even more bytes, which is why performance testing matters in the migration plan.

**Do I need new TLS certificates immediately?**
Not an emergency swap, but a plan. Certificates themselves will eventually need hybrid chains; the urgent part is enabling hybrid key exchange in your TLS stack and moving to AES-256 where practical, because those affect *encrypted-in-transit* data immediately.

**What is the difference between a KEM and a digital signature?**
A KEM (like ML-KEM) securely agrees on a shared secret between two parties without anyone else learning it. A digital signature (like ML-DSA or SLH-DSA) proves authenticity and integrity — that a message came from the claimed sender and was not modified. Both are needed, and the NIST suite covers both.

## Related Articles

- [Mastering Security Fundamentals: A Comprehensive Guide to Cybersecurity Basics](/blog/mastering-security-fundamentals)
- [OAuth 2.0 and OpenID Connect Explained: The Complete Guide to Modern Authentication and Authorization](/blog/oauth2-oidc-explained)
- [Supply Chain Security in DevOps: Securing Your CI/CD Pipeline from Code to Container](/blog/supply-chain-security-in-devops)
- [HTTP/3 and QUIC Explained: The Next-Generation Web Transport Protocol](/blog/http3-quic-explained)
