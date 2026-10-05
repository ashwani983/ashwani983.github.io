---
title: Kubernetes Autoscaling Explained: HPA, VPA, KEDA, Cluster Autoscaler and Karpenter
date: 2026-10-05
slug: kubernetes-autoscaling-explained-hpa-vpa-keda-cluster-autoscaler-karpenter
tags: [Kubernetes, Autoscaling, HPA, Karpenter, DevOps, Cost Optimization]
category: DevOps
excerpt: A practical guide to the five autoscaling layers in Kubernetes, from pod-level HPA and VPA through event-driven KEDA to node scaling with Karpenter.
readTime: 11 min read
published: true
---

# Kubernetes Autoscaling Explained: HPA, VPA, KEDA, Cluster Autoscaler and Karpenter

A cluster that never scales wastes money. A cluster that scales late, or in the wrong direction, takes your service down. Kubernetes ships several autoscaling mechanisms, each solving a different layer of the problem, and most production incidents around "the cluster got slow" trace back to a mismatch between those layers.

This guide walks through the full autoscaling stack: horizontal pod autoscaling, vertical pod autoscaling, event-driven scaling, and node-level scaling with the Cluster Autoscaler and Karpenter. We will look at what each controller actually watches, how fast it reacts, and how they interact in a real cluster.

## Table of Contents

- [Why autoscaling is a multi-layer problem](#why-autoscaling-is-a-multi-layer-problem)
- [Layer 0: Requests, limits and why they decide everything](#layer-0-requests-limits-and-why-they-decide-everything)
- [Horizontal Pod Autoscaling (HPA)](#horizontal-pod-autoscaling-hpa)
- [Vertical Pod Autoscaling (VPA)](#vertical-pod-autoscaling-vpa)
- [Event-driven scaling with KEDA](#event-driven-scaling-with-keda)
- [Node scaling: Cluster Autoscaler vs Karpenter](#node-scaling-cluster-autoscaler-vs-karpenter)
- [How the layers fit together](#how-the-layers-fit-together)
- [Real-world example: a flash-sale traffic spike](#real-world-example-a-flash-sale-traffic-spike)
- [Pitfalls that bite in production](#pitfalls-that-bite-in-production)
- [Wrapping up](#wrapping-up)
- [Key Takeaways](#key-takeaways)
- [Frequently Asked Questions](#frequently-asked-questions)
- [Related Articles](#related-articles)

## Why autoscaling is a multi-layer problem

Autoscaling in Kubernetes happens on four independent axes, each with its own controller:

```dot
// caption: The four scaling layers in Kubernetes
digraph autoscaling {
  rankdir=TB;
  subgraph demand [ "Incoming demand" ]
    metric [ "Metrics: CPU, memory, queue depth, custom" ];
    metric -> hpa [ "HPA: add/remove pods" ];
    vpa [ "VPA: change pod requests" ];
    keda [ "KEDA: scale from events" ];
  end
  subgraph scheduling [ "Scheduling" ]
    hpa -> sched [ "Scheduler places pods on nodes" ];
    vpa -> sched;
    keda -> sched;
  end
  subgraph capacity [ "Cluster capacity" ]
    sched -> cap [ "Cluster Autoscaler / Karpenter add nodes" ];
  end
  metric -> cost [ "Cost, quota, bin-packing" ];
  hpa -> cost;
  vpa -> cost;
}
```

The critical insight is that **pod scaling and node scaling are not the same thing**. Scaling pods only helps if there is spare capacity already in the cluster (or if a node-scaler can add capacity fast enough). If your pods request more CPU than any node can provide, or your cluster is at its maximum node count, HPA will happily create 200 Pending pods and nothing will improve.

| Layer | Controller | Scales | Reacts in | Cost impact |
|---|---|---|---|---|
| Horizontal (pods) | HPA, KEDA | Pod replicas | ~1–2 min (default sync) | Direct, linear |
| Vertical (pod size) | VPA | CPU/memory requests | Cycles, minutes to hours | Indirect, improves efficiency |
| Node provisioning | Cluster Autoscaler | Nodes | ~3–10 min | Dominant cost driver |
| Node provisioning | Karpenter | Nodes | Seconds (provisioning async) | Dominant cost driver |

## Layer 0: Requests, limits and why they decide everything

Every autoscaler in this stack makes decisions from **container resource requests**. If requests are wrong, everything above is wrong.

The Kubernetes scheduler places a pod on a node only if that node has enough *allocatable* capacity for the pod's requests. Requests drive:

- where pods land,
- what HPA computes utilization against,
- what the Cluster Autoscaler and Karpenter use to pick instance types,
- how aggressively the cluster can bin-pack.

A common mistake is copying the "same requests for all environments" approach from a tutorial. A service that needs 500m CPU in production and 20m CPU in CI will either be scheduled badly or capped unnecessarily.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout-api
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: api
          image: registry.example.com/checkout:2.4.1
          resources:
            requests:
              cpu: 250m
              memory: 384Mi
            limits:
              memory: 512Mi
```

Notice there is no CPU limit. CPU limits throttle the container when it bursts, which interacts badly with HPA because the autoscaler sees throttled (low) CPU usage and refuses to scale out. Memory limits are different: a memory limit causes an OOMKill, so a limit is often used as a guardrail while memory requests are tuned for scheduling.

> **Caution:** Treat `requests` as the most important configuration in your manifests. Autoscalers do not discover real capacity — they amplify whatever the requests tell them. A cluster with generous requests and no autoscaler is expensive; a cluster with tiny requests and aggressive autoscaling is fast and cheap until it starts evicting pods.

## Horizontal Pod Autoscaling (HPA)

The HPA controller runs in `kube-controller-manager`. Every sync period (15 seconds by default, then applied through a more conservative stabilization window) it reads a metric, computes the desired replica count, and scales the target workload.

The math behind the default CPU algorithm:

```
desiredReplicas = ceil(currentReplicas × currentMetricValue / desiredMetricValue)
```

With `currentMetricValue = 0.8` (80% of request) and `desiredMetricValue = 0.5` (50% of request), the HPA targets roughly `1.6 ×` the current replica count.

### HPA v2 and multiple metrics

`autoscaling/v2` is what you should be using. It supports composite metrics, multiple metrics, and external metric sources, and it picks the **largest** recommendation across all metrics.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: checkout-api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: checkout-api
  minReplicas: 3
  maxReplicas: 50
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 75
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "200"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 30
```

Two details matter more than the rest:

1. **Stabilization windows.** Scale-up stabilizes on recent recommendations, so short spikes do not inflate the desired count. Scale-down looks further back, which is why `stabilizationWindowSeconds: 300` on scale-down prevents flapping.
2. **Behaviour policies.** Defaults are conservative (a change of at most 25% per 15 seconds). A flash sale needs faster scale-up; a batch worker needs a much longer scale-down window to avoid thrash.

Verify it with the describe command:

```bash
kubectl describe hpa checkout-api
kubectl get hpa -w
```

`TARGETS` shows the live metric against the target, and `EVENTS` reveals why the HPA cannot act — most often a `FailedGetResourceMetric` error caused by `metrics-server` not being installed or not having access to the metrics API. Note also that HPA needs the target workload to expose a `scale` subresource, which Deployments, StatefulSets and ReplicationControllers do out of the box.

## Vertical Pod Autoscaling (VPA)

HPA adds replicas; VPA changes the size of each replica. The VPA controller observes actual CPU and memory usage over time and produces a recommendation for the `requests` of each container.

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: checkout-api
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: checkout-api
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
      - containerName: api
        minAllowed:
          cpu: 100m
          memory: 256Mi
        maxAllowed:
          cpu: "2"
          memory: 2Gi
        controlledResources:
          - cpu
          - memory
```

The important caveat: **changing pod requests requires restarting the pod.** In `Auto` mode, VPA evicts and recreates pods to apply new sizes. For a stateless API that is usually fine; for a stateful workload it means real disruption.

> **Caution:** Never let VPA in `Auto` mode manage the `cpu` request on a Deployment that is also targeted by an HPA on `cpu`. The two controllers will fight each other — VPA lowers the request because usage dropped, HPA sees utilization jump toward 100% and adds replicas, usage drops again, and you get a permanent scale oscillation. The common resolution is to keep VPA on `memory` only, or keep VPA in `Off`/`Recreate`-free recommendation-only modes and apply the numbers yourself.

Start in `updateMode: "Off"` (recommendation only), compare the recommended values against your current requests, and only then consider automating.

## Event-driven scaling with KEDA

CPU and memory are lagging indicators. By the time a queue backs up enough to raise CPU utilization, customers are already waiting.

KEDA (Kubernetes Event-driven Autoscaling) scales workloads to zero and back based on external event sources: message queue depth, cron schedules, Prometheus queries, cloud storage queue length, and many more through its scalers.

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: order-processor
spec:
  scaleTargetRef:
    name: order-processor
  minReplicaCount: 0
  maxReplicaCount: 25
  cooldownPeriod: 300
  triggers:
    - type: rabbitmq
      metadata:
        queueName: orders
        queueLength: "20"
        mode: QueueLength
    - type: cron
      metadata:
        timezone: Etc/UTC
        start: 0 6 * * *
        end: 0 20 * * *
        desiredReplicas: "2"
```

Two capabilities here have no HPA equivalent:

- **Scale to zero.** When the queue drains below the threshold, the workload scales to zero and compute is reclaimed. This is a large cost win for spiky, event-driven pipelines.
- **Multiple triggers with OR semantics.** Any trigger above its threshold can drive the replica count, so a burst of messages or a scheduled job both work without conversion into a CPU metric.

KEDA runs as a set of pods (it is an external autoscaler, not part of the control plane). It reads the HPA-style ScaledObject, manages the Deployment or StatefulSet replica count, and an optional metrics adapter exposes the same metrics to the HPA API so that dashboards still work.

The trade-off is one more control-plane component and a dependency chain: if KEDA is down, scaling stops. Size it and monitor it like any other critical workload, and set `cooldownPeriod` high enough to avoid rapid scale-to-zero churn on intermittent traffic.

## Node scaling: Cluster Autoscaler vs Karpenter

Pods are useless without nodes. This is where the majority of real-world autoscaling pain lives, because node provisioning takes minutes, not seconds.

### Cluster Autoscaler

The Cluster Autoscaler watches for pods that cannot be scheduled and Pending, then looks for node groups it can grow. It works best with multiple node groups and is typically paired with the pod autoscaler: it selects a group by simulating scale-up and chooses the group that would result in the least fragmentation.

```yaml
apiVersion: "autoscaling/v1"
kind: "PodDisruptionBudget"
metadata:
  name: checkout-api
spec:
  minAvailable: 80%
  selector:
    matchLabels:
      app: checkout-api
```

A `PodDisruptionBudget` like the one above is nearly mandatory here, because a node scale-up or a cluster upgrade can evict pods and the autoscaler will block on quota or on the PDB.

### Karpenter

Karpenter (from AWS) takes a different approach: it does not manage node groups at all. It watches for unschedulable pods and launches a **provisioner-driven** compute instance whose shape is chosen specifically to fit those pods, then consolidates and deprovisiones capacity when it is no longer needed.

| Aspect | Cluster Autoscaler | Karpenter |
|---|---|---|
| Selection model | Scale an existing node group | Launch a new node sized to fit the pod |
| Instance diversity | One shape per node group | Many shapes/instances in one provisioner |
| Scale-up latency | Node group resize + instance boot | Direct instance launch, batched by launch templates |
| Consolidation | Not automatic | Merges and removes underused nodes |
| Bin packing | Group-level approximation | Per-node, per-pod simulation |

The practical reasons teams migrate:

1. **No node group guesswork.** You describe constraints (instance families, architectures, capacity types), not how many nodes to keep warm.
2. **Provisioning latency.** Rather than waiting for a node group to double and then boot instances, Karpenter batches launches.
3. **Consolidation and deprovisioning.** This is the biggest cost win — underutilised nodes are actively merged into fewer, fuller nodes instead of lingering.

A minimal `NodePool` looks like this:

```yaml
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: general-purpose
spec:
  template:
    spec:
      requirements:
        - key: kubernetes.io/arch
          operator: In
          values: ["amd64"]
        - key: karpenter.k8s.aws/instance-category
          operator: In
          values: ["c", "m", "r"]
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["on-demand"]
      nodeClassRef:
        name: general-purpose
  limits:
    cpu: 2000
  disruption:
    consolidationPolicy: WhenEmptyOrUnderutilized
```

The `limits` block is your budget guardrail — Karpenter will not exceed it, and the resulting capacity shortfall surfaces as Pending pods instead of an unexpected bill. Pinning `karpenter.sh/capacity-type` to `spot` (or mixing spot with on-demand using a well-defined priority order) is the standard way to trade cost for eviction risk.

> **Caution:** Karpenter does not self-limit spending. Without explicit `limits` on a `NodePool`, a scale loop caused by bad requests, a runaway deployment or a `maxReplicas` typo will provision capacity until you hit a quota or an invoice. Set limits per NodePool and alert on pending-pod counts.

## How the layers fit together

A healthy production setup usually looks like this:

1. **Requests are set deliberately** from load testing, not copy-pasted.
2. **VPA runs in recommendation mode** and feeds those numbers back into your manifests.
3. **HPA handles steady, CPU-bound traffic** with aggressive scale-up and a conservative scale-down.
4. **KEDA covers the event-driven and batch workloads**, including scale-to-zero.
5. **Karpenter or the Cluster Autoscaler supplies nodes**, constrained by quotas, NodePool limits and PDBs.

![Kubernetes cluster architecture used as a reference for scaling decisions](https://commons.wikimedia.org/wiki/Special:FilePath/Kubernetes-logo.svg?width=480)

Watch for interactions. A VPA recommendation that lowers requests across a whole fleet makes Karpenter's consolidation more aggressive — which is usually what you want, but it can also increase Pending pods briefly. A KEDA-driven scale-to-zero on a workload that other services call synchronously will look like random 503s, not like a scaling problem, so document scale-to-zero eligibility per service.

## Real-world example: a flash-sale traffic spike

Consider `checkout-api`, which runs on a Karpenter-backed cluster with HPA, KEDA used elsewhere in the platform, and Prometheus installed.

**Baseline.** Steady traffic of 400 requests/second with 40% CPU utilization. The Deployment runs 6 replicas at `requests: cpu 250m, memory 384Mi`. The NodePool has warm capacity for about 30 pods.

**The spike.** The sale opens: 3,000 requests/second. Within 60 seconds:

1. CPU utilization crosses 60% and the HPA computes roughly 6 × (0.85/0.60) ≈ 9 replicas, then scales up again on its 100%/30s policy.
2. Replicas rise to ~34. Karpenter sees the pods that do not fit and launches new instances sized to the pending pods in a single batch, rather than doubling a node group.
3. Scale-up stabilizes in roughly 2–3 minutes, mostly bounded by instance launch and image pull time.
4. Because `scaleDown.stabilizationWindowSeconds` is 300, replica count falls back slowly once traffic normalizes — no flapping.

**The instrumented part.** CPU-based HPA works here because the service is CPU-bound. For a checkout flow waiting on a payment provider, queue depth or in-flight request count is a better signal, so the team added a Prometheus trigger through KEDA and lowered the CPU threshold to catch the *approach* to a spike rather than the peak.

**Cleanup.** Consolidation policy `WhenEmptyOrUnderutilized` drains the extra nodes over the following 10–20 minutes, which is the difference between a spike costing you a few extra node-hours and costing you a full day of idle capacity.

The same scenario against a cluster running only the Cluster Autoscaler with a single node type and a CPU limit on every container would look completely different: throttled CPU, no HPA scale-up signal, pods throttling instead of scaling.

## Pitfalls that bite in production

1. **HPA on CPU with CPU limits set.** Throttling makes the container look *less* utilized, so the HPA under-scales exactly when you need it. Either drop CPU limits or scale on a different metric.
2. **Scaling replicas faster than you scale nodes.** If node provisioning takes 10 minutes, an HPA that doubles every 30 seconds just produces Pending pods and an alert storm. Fix the provisioning layer first.
3. **Missing PDBs and quotas.** Karpenter respects PodDisruptionBudgets and resource quotas. A PDB of `minAvailable: 100%` on a 3-replica Deployment will block consolidation and node provisioning entirely.
4. **Immediate scale-to-zero on user-facing endpoints.** A service scaled to zero that receives a request pays a cold-start penalty — sometimes seconds. Keep synchronous API paths warm.
5. **Ignoring the scale-down side.** Under-provisioned scale-up is a reliability problem; over-provisioned scale-down is a cost problem. Set `stabilizationWindowSeconds` deliberately instead of accepting the 300-second default.
6. **Treating recommendations as facts.** VPA output is only as good as the observation window. Run it for at least a week, across weekly traffic cycles, before letting it change production requests.

## Wrapping up

Kubernetes autoscaling is not a single feature but a stack of cooperating controllers. HPA and KEDA decide how many pods should exist; VPA influences how big each pod should be; the Cluster Autoscaler or Karpenter decides how many nodes exist to hold them. When a service feels slow or expensive, the answer is usually in the seam between two of those layers rather than in any one of them.

Start by measuring: are your requests close to real usage? Is `kube_pod_container_status_cpu_throttled` non-zero? Are there Pending pods? Do underutilised nodes linger for hours? Each of those observations points directly at the layer that needs work.

## Key Takeaways

- Resource requests are the foundation — every autoscaler in Kubernetes reads them, and wrong requests make every layer above wrong.
- Use `autoscaling/v2` HPAs with explicit `behavior` policies: fast scale-up, slow scale-down with a stabilization window.
- Prefer queue depth, request rate or in-flight work over CPU when the service is I/O-bound; CPU is a lagging signal.
- VPA is best run in recommendation mode first, and never let it fight an HPA over the same `cpu` request.
- KEDA adds event-driven scaling and scale-to-zero, at the cost of one more control-plane component to monitor.
- Karpenter scales nodes in seconds and consolidates them automatically, but it needs explicit NodePool `limits` to keep spend bounded.

## Frequently Asked Questions

**Should I run HPA and VPA on the same Deployment?**
Yes, but carefully. They control different dimensions, and the common failure is letting VPA manage the same `cpu` request that the HPA scales on, which creates oscillation. Restrict VPA to `memory`, or keep it in recommendation-only mode.

**Why does my HPA scale to maxReplicas and the cluster still runs out of capacity?**
Because pod scaling and node scaling are separate. Check for Pending pods and look at your node-provisioning layer's limits, quotas and instance capacity. If Karpenter or the Cluster Autoscaler cannot add nodes, more replicas will not help.

**Is the HPA slow because of the 15-second sync period?**
Usually not. A full scale-up generally completes within a minute or two. Delays of several minutes are far more often caused by missing `metrics-server`, a stabilization window, conservative default behaviour policies, or node provisioning time.

**When is scale-to-zero worth it?**
For event-driven and batch workloads with bursty traffic and no inbound synchronous traffic — queue consumers, scheduled jobs, webhook receivers. Not for user-facing APIs on the request path, where cold starts show up directly as user-facing latency.

**How do I know if Karpenter is spending more than it should?**
Watch the pending-pod count alongside node counts and cost. If pods stay pending while node counts keep rising, requests or NodePool requirements are misconfigured. Pair `NodePool.limits` with cost alerts so overspend is visible before it is billed.

## Related Articles

- [Kubernetes in 100 Scenarios: A Complete Field Guide from Core Concepts to Advanced Workloads](https://blog.example.com/kubernetes-100-scenarios)
- [Service Level Objectives and Error Budgets: The SRE Guide to Measuring Reliability](https://blog.example.com/slo-error-budgets)
- [How Docker Works Internally: Layers, Namespaces, and Networking Explained](https://blog.example.com/how-docker-works)
- [Policy as Code: Securing Kubernetes with Open Policy Agent and Kyverno](https://blog.example.com/policy-as-code)
- [Mastering Observability with Prometheus and Grafana: From Metrics to Actionable Insights](https://blog.example.com/prometheus-grafana)
