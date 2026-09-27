---
title: Service Mesh Explained: How Istio, Linkerd and eBPF Proxies Secure and Route Microservice Traffic
date: 2026-09-27
slug: service-mesh-explained-istio-linkerd-microservice-traffic
tags: [Service Mesh, Istio, Linkerd, Kubernetes, mTLS, Microservices, eBPF]
category: DevOps
excerpt: How service meshes move mTLS, traffic shifting and telemetry out of application code, and how to choose between Istio, Linkerd and sidecarless eBPF options.
readTime: 13 min read
published: true
---

# Service Mesh Explained: How Istio, Linkerd and eBPF Proxies Secure and Route Microservice Traffic

Decomposing a monolith into microservices does one thing reliably: it multiplies the number of network calls. A request that used to be a local method invocation now crosses a process boundary, a container boundary and usually a node boundary — many times per user action.

Every hop needs answers to the same questions. Is the caller who it claims to be? Should the request be encrypted? What happens if the downstream service returns a 503 or hangs? Which version of `reviews` should receive 5% of the traffic?

Answering these inside every service — in Java, Go, Python or Node.js — means writing the same subtle, security-critical networking code repeatedly. A service mesh is the alternative: a layer of infrastructure proxies that answers those questions for your services.

![Interconnected microservice components, each with its own database, illustrating the network complexity a service mesh is designed to manage](https://upload.wikimedia.org/wikipedia/commons/5/57/Microservices_app_example_v0.4.png)

## Table of Contents

- [Why a Service Mesh Exists](#why-a-service-mesh-exists)
- [How a Mesh Is Built](#how-a-mesh-is-built)
- [Zero-Trust Networking with mTLS](#zero-trust-networking-with-mtls)
- [Traffic Management](#traffic-management)
- [Observability](#observability)
- [The Mainstream Implementations](#the-mainstream-implementations)
- [Real-World Walkthrough: Onboarding an App with Istio](#real-world-walkthrough-onboarding-an-app-with-istio)
- [Cost, Overhead and Operational Reality](#cost-overhead-and-operational-reality)
- [When You Should Not Run a Mesh](#when-you-should-not-run-a-mesh)
- [Conclusion](#conclusion)

## Why a Service Mesh Exists

### The network is the attack surface

The moment services talk over a network, "trusted" and "untrusted" become labels you apply to yourself. In a flat cluster, any pod that can reach a `ClusterIP` can usually reach any other, so one compromised or badly written service is a single `curl` away from the rest of the estate.

The industry answer — *zero trust* — is to require every connection to be mutually authenticated and encrypted, so network position grants no implicit rights. Historically that meant TLS termination and authorization logic in every service: tedious, inconsistently implemented, impossible to audit centrally.

### Libraries don't scale

The second pressure is velocity:

| Concern | Library in every service | Mesh layer |
| --- | --- | --- |
| mTLS between services | Reimplement TLS, cert rotation and hostname validation per language | Issued and rotated by the control plane, enforced by the proxy |
| Retries with backoff | Hand-rolled per client, prone to retry storms | Declarative, with timeouts and attempt limits |
| Canary traffic splitting | Load-balancer-specific config in each caller | Weighted routing rules applied centrally |
| Golden-signal metrics | Custom instrumentation, inconsistent labels | Standard proxy-level RED metrics for every hop |
| Audit logging | Inconsistent, per-service | Uniform access logs at the proxy layer |

The term *service mesh* was popularised in a 2016 Buoyant blog post: treat sidecar proxies as a first-class networking layer. What began as Google's Istio (2017) and Linkerd evolved into widely adopted CNCF projects — Istio, Linkerd and Cilium have all graduated.

## How a Mesh Is Built

Every mesh splits into two halves. The **control plane** watches desired state (Kubernetes Services, CRDs, policies) and computes the correct proxy configuration for every workload. The **data plane** is the set of proxies that actually forward packets, enforce policy and emit telemetry.

The critical contract is the **xDS API**, originally from Envoy: a streaming API where the control plane pushes listeners, clusters, routes and endpoints to proxies. Because the data plane is a well-known open-source proxy rather than bespoke per-vendor code, the control plane is where products actually differ.

### Sidecar architecture

In the classic model, one proxy container is injected into every pod. The application thinks it is talking to a service on the cluster network; in reality it talks to `localhost`, where the sidecar intercepts the connection, applies TLS, retries and telemetry, then opens a new connection to the destination pod's sidecar.

```yaml
# Injected by the webhook — you rarely write this yourself
spec:
  containers:
    - name: app
      image: registry.example.com/payments:1.4.2
    - name: istio-proxy
      image: docker.io/istio/proxyv2:latest
      ports:
        - containerPort: 15000   # Envoy admin
        - containerPort: 15021   # health / readiness
```

This is transparent and per-workload, but it multiplies memory and CPU by pod count. It also carries a long-standing lifecycle problem: a regular sidecar container never exits, so a `Job` pod hangs forever waiting for it.

### Sidecarless architecture

Sidecarless meshes move the proxy out of the pod. Two designs are now mainstream:

- **Ambient mode (Istio)** — a shared, per-node L4 proxy called `ztunnel` (written in Rust) handles mTLS, L4 authorization and telemetry. A **waypoint** proxy is added only where L7 features (routing, retries, L7 authorization) are needed. Traffic between proxies is tunneled using HBONE. Ambient mode reached GA in Istio 1.24.
- **eBPF datapath (Cilium)** — L3/L4 load balancing, mTLS and policy are programmed directly into the kernel, with Envoy pulled in only when HTTP-level semantics are required.

![Sidecar-based mesh: the control plane pushes config and certificates to per-pod ](https://raw.githubusercontent.com/ashwani983/ashwani983.github.io/main/assets/images/blog/service-mesh-explained-istio-linkerd-microservice-traffic-diagram-1.png)

## Zero-Trust Networking with mTLS

### Cryptographic workload identity

The foundation of a mesh is a way to answer *"who is this?"* for every workload. The mesh typically issues an X.509 certificate per workload from its own certificate authority, with a Subject Alternative Name encoding the identity — commonly a Kubernetes ServiceAccount identity or a SPIFFE URI. Every connection is then mutually authenticated, and that peer identity feeds directly into authorization.

This replaces "the request came from inside the cluster" with "the request came from `spiffe://cluster.local/ns/storefront/sa/frontend`". One caveat deserves emphasis:

> mTLS authenticates workloads, it does not authorize them. Without explicit authorization rules you have simply built a very well-encrypted flat network — do not leave `PERMISSIVE` mode in production and call it zero trust.

### Peer authentication and authorization

In Istio, `PeerAuthentication` expresses transport security and `AuthorizationPolicy` expresses request-level access. These are independent objects: the first decides whether traffic is encrypted, the second decides who may call what.

```yaml
# Transport security: mandate encryption for everything in the namespace
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: catalogue
spec:
  mtls:
    mode: STRICT
---
# Authorization: only the frontend identity may read reviews
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: reviews-allow-frontend
  namespace: catalogue
spec:
  selector:
    matchLabels:
      app: reviews
  action: ALLOW
  rules:
    - from:
        - source:
            principals: ["cluster.local/ns/storefront/sa/frontend"]
      to:
        - operation:
            methods: ["GET"]
            paths: ["/api/reviews/*"]
```

`STRICT` is the goal. `PERMISSIVE` exists as a migration aid, and it will happily accept plaintext — including traffic from a compromised pod.

## Traffic Management

This is where a mesh pays for itself. In Istio, `VirtualService` describes *how* traffic is routed, `DestinationRule` describes *how endpoints are selected and treated*, and `Gateway` describes ingress.

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: reviews-canary
  namespace: catalogue
spec:
  hosts: [reviews]
  http:
    - route:
        - destination: {host: reviews, subset: v2}
          weight: 90
        - destination: {host: reviews, subset: v1}
          weight: 10
      timeout: 800ms
      retries:
        attempts: 2
        perTryTimeout: 300ms
        retryOn: "5xx,reset"
---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: reviews
  namespace: catalogue
spec:
  host: reviews
  trafficPolicy:
    connectionPool:
      tcp: {maxConnections: 100}
      http: {http1MaxPendingRequests: 50}
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 5s
      baseEjectionTime: 30s
```

A bounded timeout, a small attempt count and outlier detection are what turn a cascading failure into a degraded-but-recoverable service.

> Retries multiply load. If a downstream is already saturated, a client that retries three times turns a small queue into a full outage. Always pair retries with a timeout, cap the attempt count, and remember that a mesh retries per hop — a five-hop call chain with retries can generate dozens of backend requests per user action.

### Gateway API and GAMMA

The Kubernetes Gateway API standardises ingress and, through the GAMMA initiative, service-to-service routing. A mesh can therefore be pointed at standard `HTTPRoute` resources instead of vendor CRDs, which reduces lock-in. Istio waypoints in ambient mode are themselves `Gateway` resources with `gatewayClassName: istio-mesh`.

## Observability

Proxies sit on every request, so they emit consistent, low-cardinality metrics without touching application code. This is the most reliable reason to adopt a mesh: every service reports the same signals with the same labels.

| Signal | Typical labels | Answers |
| --- | --- | --- |
| Request rate | `destination_service`, `response_code`, `reporter` | Is traffic arriving at all? |
| Error rate | `response_code` | Which callers are failing? |
| Duration histogram | `destination_service` | Where did the p99 move? |
| Bytes sent/received | `source_workload` | Which service is chatty? |
| Outlier ejections | `destination_service` | Is a host out of rotation? |
| Access log entries | full request context | What happened to this call? |

Feeding this into an existing OpenTelemetry pipeline — rather than inventing a second dashboard — is what stops a mesh from becoming an observability silo.

## The Mainstream Implementations

| Project | Data plane | L7 via | CNCF status | Best fit |
| --- | --- | --- | --- | --- |
| Istio | Envoy sidecar, or `ztunnel` + waypoints | Envoy | Graduated (2023) | Large fleets, deep L7 policy |
| Linkerd | Rust micro-proxy sidecar (native by default in 2.20) | Proxy | Graduated (2021) | Lower risk, small footprint, strong defaults |
| Cilium | eBPF kernel datapath + Envoy for L7 | Envoy | Graduated (2023) | Clusters already running Cilium |
| Kuma (Kong) | Envoy sidecars or a zone-less mode | Envoy | Incubation | Multi-zone, multi-cluster topologies |
| Consul Connect | Envoy sidecars or a built-in proxy | Envoy | Incubation (Consul) | Environments on Consul already |

### Istio

The most feature-rich, and arguably the most complex. Its two data planes can coexist in one cluster, which helps gradual migration but doubles the mental model. `istioctl` is a first-class operational tool:

```bash
istioctl proxy-status                       # config sync state per proxy
istioctl proxy-config route reviews-v1-xxx  # effective config for one proxy
istioctl x describe pod reviews-v1-xxx      # config + endpoint drill-down
istioctl analyze -n catalogue               # static validation of manifests
```

The current release line is Istio 1.31 (August 2026), supporting Kubernetes 1.32 through 1.36.

### Linkerd

Linkerd optimises for predictability: Rust micro-proxies, opinionated defaults, fewer moving parts, and the first service mesh to reach CNCF graduation. In 2.20 it promoted Kubernetes native sidecars to GA and made them the default, fixing the `Job`-hangs-on-shutdown problem. Its diagnostics are unusually good for the category:

```bash
linkerd check --proxy                 # per-pod health, including init containers
linkerd viz stat deploy -n catalogue  # success rate and RPS per pod
linkerd viz edges deploy -n catalogue # who is actually calling whom
linkerd identity deploy -n catalogue  # workload identity and cert details
```

### Cilium and the eBPF path

Cilium is the most interesting architectural bet. Because it is usually already the cluster CNI, it can program load balancing, encryption and policy in the kernel with eBPF, avoiding a user-space hop for L3/L4 traffic. Cilium Service Mesh reached GA in Cilium 1.12, and Cilium graduated from the CNCF in October 2023. Its sub-project Hubble provides a service map and per-flow visibility that rivals dedicated APM tooling.

## Real-World Walkthrough: Onboarding an App with Istio

The topology below is the four-service `bookinfo` sample application: product page, details, two versions of reviews, and ratings.

![The bookinfo sample application topology: productpage calling details, reviews and ratings services](https://upload.wikimedia.org/wikipedia/commons/6/6e/Bookinfo.svg)

### 1. Install the control plane

```bash
istioctl install --set profile=ambient
istioctl verify-install
kubectl get pods -n istio-system
```

### 2. Enrol the namespace

In ambient mode, onboarding is a label — no manifest changes:

```bash
kubectl label namespace catalogue istio.io/dataplane-mode=ambient
istioctl ztunnel-config workloads -n istio-system   # HBONE protocol
```

### 3. Add a waypoint only where you need L7

If this namespace only needs encryption, stop here — `ztunnel` already provides mTLS, L4 authorization and telemetry. Add a waypoint only for HTTP-level routing or L7 policy:

```bash
istioctl waypoint apply -n catalogue --name catalogue-waypoint --enroll-namespace
```

### 4. Shift traffic gradually

```bash
kubectl label namespace catalogue istio.io/use-waypoint=catalogue-waypoint
```

Then attach an `HTTPRoute` sending 10% of reviews traffic to `reviews-v2`. The mesh is already in place, so this is one object applied and reverted — no application release required.

### 5. Verify before you trust it

```bash
istioctl proxy-status                 # is every proxy SYNCED?
istioctl analyze -n catalogue         # any config errors?
kubectl exec -n catalogue deploy/reviews-v1 -- curl -s localhost:15000/stats
```

The Envoy admin endpoint is the ground truth. If a policy misbehaves, read the effective route and cluster config there before reading documentation.

### 6. Roll back cheaply

Removing the label returns traffic to the previous path without touching application code. This reversibility — not raw feature count — is what makes a mesh safe to adopt incrementally.

## Cost, Overhead and Operational Reality

A mesh is not free, and honesty here prevents bad decisions:

| Dimension | Sidecar model | Ambient / sidecarless | eBPF datapath |
| --- | --- | --- | --- |
| Memory overhead | Per pod × replica count | Shared per node | Minimal user-space footprint |
| Added latency | Small but non-zero user-space hops | Fewer hops for L4-only paths | Lowest for L3/L4 |
| Blast radius | One pod per bad proxy | One node per bad proxy | Kernel-level debugging |
| Config complexity | Widest feature set | Fewer knobs; L7 gated by waypoints | Cilium plus mesh concepts |

Vendor benchmarks exist for all three and are not comparable. The honest statement is that the delta is workload-dependent and must be measured in your own environment. The one reliable pattern is that sidecarless designs meaningfully reduce resource cost at large pod counts — Istio's ambient GA announcement claimed savings exceeding 90% in some use cases — while native sidecars remove the lifecycle problem that gave sidecars a bad reputation.

The other cost is human: a control plane, a new failure mode, a new resource vocabulary and a steep debugging curve. Budget for training and give the mesh an explicit owner. The best mesh deployment is the one you can explain at 3 a.m.

## When You Should Not Run a Mesh

Be honest about fit. A service mesh is usually the wrong answer when:

1. **You have fewer than roughly a dozen services** — operational cost will exceed benefit.
2. **You cannot afford a dedicated platform owner.** Unowned meshes rot into mysterious outages.
3. **Your real problem is a slow database or cold starts.** A proxy will not fix a bad cache.
4. **You only need load balancing** — an ingress controller plus an HPA may be enough.
5. **You need hard tenant isolation** — shared-proxy designs, ambient or not, deserve careful evaluation first.

## Conclusion

A service mesh is an infrastructure answer to a code problem: networking behaviour that used to be reimplemented in every language becomes declarative configuration delivered to a uniform data plane. The value is real — zero-trust mTLS, per-service golden-signal telemetry and reversible traffic manipulation — but so is the complexity, and the two are inseparable.

The pragmatic path is incremental. Start in one namespace, pick the lowest-complexity mode that meets your requirements, verify against the data plane's own admin endpoints rather than dashboards, and expand only after the first namespace has been boring for a quarter.

## Key Takeaways

- A service mesh moves cross-cutting concerns — mTLS, retries, traffic shifting, telemetry — out of application code into declaratively managed proxies.
- Meshes split into a control plane that computes configuration (`istiod`; Linkerd's destination and identity controllers) and a data plane that enforces it.
- Three data plane designs matter: Envoy sidecars, Istio's sidecarless ambient mode (`ztunnel` + waypoints, GA in 1.24), and Cilium's eBPF kernel datapath.
- mTLS provides workload identity; it is not authorization. Zero trust requires explicit authorization rules too.
- Retries and timeouts are the highest-risk knobs in a mesh — per-hop retries compound, so bound them.
- Start with one namespace, use the simplest mode that meets your needs, and verify against the proxy admin endpoint.

## Frequently Asked Questions

**Is a service mesh just an API gateway or an ingress controller?**
No. Gateways handle north-south traffic at the cluster edge. A mesh handles east-west traffic between workloads, plus encryption and identity for those connections. The two are complementary and often coexist.

**Does adding a sidecar slow my services down?**
There is additional latency, typically small, from extra user-space hops. The magnitude depends on your workload and should be measured with a load test rather than assumed. If latency or resource cost is a hard constraint, evaluate ambient mode or an eBPF-based datapath.

**Do I need to rewrite my applications to use a mesh?**
Generally no — both sidecar and ambient modes are transparent to application code. Do confirm your application tolerates the proxy's connection behaviour and does not rely on protocols the proxy cannot parse.

**Can I adopt a mesh gradually, service by service?**
Yes, and you should. Enrol one namespace first, verify telemetry and policy enforcement, then expand. Both Istio and Linkerd allow per-namespace opt-in, and ambient mode's label-based onboarding makes this especially cheap.

**What is GAMMA and why does it matter?**
GAMMA is an initiative within the Kubernetes Gateway API that extends standard routing resources to east-west traffic. If a mesh can be configured with standard `HTTPRoute` and `Gateway` objects, adopting or replacing it becomes far less disruptive, because configuration is not locked to one vendor's CRDs.

## Related Articles

- *OpenTelemetry in DevOps: Unified Traces, Metrics, and Logs for Modern Observability* — feeding mesh telemetry into an existing pipeline
- *eBPF Explained: A Practical Guide to Deep Linux Observability for DevOps and SRE* — background on Cilium's approach
- *Policy as Code: Securing Kubernetes with Open Policy Agent and Kyverno* — admission-time policy that complements runtime mesh policy
- *Service Level Objectives and Error Budgets: The SRE Guide to Measuring Reliability* — turning mesh metrics into reliability targets
- *Feature Flags in DevOps: The Complete Guide to Progressive Delivery and Safe Releases* — complementary to mesh-based traffic shifting
