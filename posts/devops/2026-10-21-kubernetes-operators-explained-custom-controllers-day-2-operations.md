---
title: Kubernetes Operators Explained - Building Custom Controllers That Automate Day-2 Operations
date: 2026-10-21
slug: kubernetes-operators-explained-custom-controllers-day-2-operations
tags: [Kubernetes, Operators, CRDs, Controller Runtime, Operator SDK, Automation]
category: DevOps
excerpt: How Kubernetes Operators turn hard-wired operational knowledge into code using CRDs, reconciliation loops and the Operator SDK, with a working example.
readTime: 12 min read
published: true
---

# Kubernetes Operators Explained - Building Custom Controllers That Automate Day-2 Operations

Ask any platform engineer how they provision a database cluster, rotate its credentials, or take a nightly backup. The honest answer is usually a long shell script, a wall of Helm values, and a CronJob nobody trusts. It works until reality does something unexpected, and then it fails silently at 3 a.m.

A **Kubernetes Operator** is the native answer: instead of shipping a procedure, you ship a controller that watches a custom resource, compares what you asked for with what actually exists in the cluster, and continuously drives reality back toward the request.

![The Kubernetes logo, the platform that operators extend with custom resources](https://upload.wikimedia.org/wikipedia/commons/b/be/Kubernetes.png)

This article covers the operator pattern, the reconciliation model, the tooling, and how to build one that survives production.

## Table of Contents

- [The Problem: Day-2 Operations Don't Scale with YAML](#the-problem-day-2-operations-dont-scale-with-yaml)
- [What an Operator Actually Is](#what-an-operator-actually-is)
  - [The Operator Pattern](#the-operator-pattern)
  - [CRDs: Extending the Kubernetes API](#crds-extending-the-kubernetes-api)
  - [The Reconciliation Loop](#the-reconciliation-loop)
  - [Operators vs. CronJobs, Hooks and GitOps](#operators-vs-cronjobs-hooks-and-gitops)
- [The Operator Ecosystem](#the-operator-ecosystem)
  - [Operator SDK, Kubebuilder and controller-runtime](#operator-sdk-kubebuilder-and-controller-runtime)
  - [Operator Lifecycle Manager and OperatorHub](#operator-lifecycle-manager-and-operatorhub)
- [Anatomy of a Go Operator](#anatomy-of-a-go-operator)
  - [Defining the API Types](#defining-the-api-types)
  - [Writing the Reconciler](#writing-the-reconciler)
  - [Finalizers and Cleanup](#finalizers-and-cleanup)
- [Real-World Example: A Database Backup Operator](#real-world-example-a-database-backup-operator)
  - [The CRD](#the-crd)
  - [The Custom Resource](#the-custom-resource)
  - [The Reconcile Function](#the-reconcile-function)
  - [What Happens at Runtime](#what-happens-at-runtime)
- [Testing Operators](#testing-operators)
  - [Unit Testing with envtest](#unit-testing-with-envtest)
  - [Scorecard and Integration Tests](#scorecard-and-integration-tests)
- [Production Hardening](#production-hardening)
  - [Least-Privilege RBAC](#least-privilege-rbac)
  - [High Availability and Leader Election](#high-availability-and-leader-election)
  - [Metrics and Observability](#metrics-and-observability)
- [Pitfalls and Best Practices](#pitfalls-and-best-practices)
- [Key Takeaways](#key-takeaways)
- [Frequently Asked Questions](#frequently-asked-questions)
- [Related Articles](#related-articles)

## The Problem: Day-2 Operations Don't Scale with YAML

Kubernetes has an excellent story for **Day-1**: how do I get this workload running? Manifests, Helm charts, and GitOps controllers handle that well, because "running" is a declarative, one-time transition.

**Day-2** is everything after: scaling the cluster, rotating credentials, failing over, upgrading a member, taking a backup, cleaning up old snapshots. It is the long tail, and it is where platform teams lose the most time.

Three approaches usually get attempted, and each breaks predictably:

1. **Imperative scripts in CI.** They are stateful, order-dependent, and fail halfway through leaving mixed state behind.
2. **CronJobs that do one thing.** They work, but they have no memory: a backup job cannot tell whether last night's backup succeeded.
3. **Helm hooks.** Hooks are one-shot events with `helm upgrade` semantics, not a continuous control loop.

What is missing in all three is a component that **observes, decides, acts, and re-observes** - a controller.

## What an Operator Actually Is

### The Operator Pattern

The Kubernetes documentation calls this the *operator pattern*: extend the API with a **CustomResourceDefinition (CRD)** and write a **controller** that reconciles those custom resources against the running cluster.

An operator is therefore three things packaged together:

| Component | Role |
| --- | --- |
| CRD | The API. A new noun that users can `kubectl apply`. |
| Controller | The brain. A reconciliation loop that enforces desired state. |
| Bundle / chart | The packaging. How the operator itself is installed and versioned. |

Operational knowledge moves out of wiki pages and runbooks and into **code**, reviewed, tested, and versioned like everything else.

### CRDs: Extending the Kubernetes API

A CRD registers a new kind with the API server. Here is an abbreviated version (`make manifests` generates the full schema from your Go types):

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: databasebackups.backup.example.com
spec:
  group: backup.example.com
  scope: Namespaced
  names:
    plural: databasebackups
    kind: DatabaseBackup
    shortNames: [dbbackup]
  versions:
    - name: v1alpha1
      served: true
      storage: true
      subresources:
        status: {}
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              required: [clusterRef, schedule]
              properties:
                clusterRef: {type: string}
                schedule: {type: string}
                retention: {type: integer, default: 7}
```

A few things to notice:

- **Structural schemas are mandatory.** A modern CRD must declare an OpenAPI v3 schema.
- **`spec` is the user's intent; `status` is the operator's report.** Users own `spec`, the operator owns `status`.
- **Versions are independent.** `v1alpha1` can be served while `v1beta1` is the storage version, with a conversion webhook translating between them.

Since Kubernetes 1.25, CRDs also support **CEL validation rules** via `x-kubernetes-validations`, which express cross-field constraints ("retention must not exceed schedule count") in the API server rather than in a webhook.

### The Reconciliation Loop

This is the heart of the pattern: watch events, enqueue a request, and reconcile until the world matches the spec.

![The operator reconciliation loop](https://raw.githubusercontent.com/ashwani983/ashwani983.github.io/main/assets/images/blog/kubernetes-operators-explained-custom-controllers-day-2-operations-diagram-1.png)

The properties of this loop matter more than the code inside it:

- **Level-triggered, not edge-triggered.** The reconciler acts on the *current* state, so a restart mid-flight is harmless.
- **Idempotent.** Running reconcile twice must equal running it once: create-if-missing, patch-if-different, never append to a list blindly.
- **Retries with backoff.** A failed reconcile returns an error and is requeued with exponential backoff, so a broken dependency does not spin the CPU.
- **Requeue for time.** `ctrl.Result{RequeueAfter: 30 * time.Second}` makes the loop time-driven, which is how operators handle schedules, heartbeats and leases.

### Operators vs. CronJobs, Hooks and GitOps

| Capability | Helm / GitOps | CronJob | Operator |
| --- | --- | --- | --- |
| Continuous convergence | On sync only | No | Yes |
| Rich status reporting | Poor | None | First-class conditions |
| Handles failures and retries | Limited | One retry per schedule | Exponential backoff, per-object |

These are complements, not competitors. A common architecture is: **GitOps owns the manifests, the operator owns the stateful workload.** Argo CD or Flux deploys a CR; the operator takes it from there.


## The Operator Ecosystem

### Operator SDK, Kubebuilder and controller-runtime

The [Operator Framework](https://operatorframework.io/) has three main pieces:

- **Operator SDK** - the CLI and libraries for building operators. For Go projects it scaffolds with **Kubebuilder** and runs on **controller-runtime**.
- **Operator Lifecycle Manager (OLM)** - installs, upgrades and manages operators inside a cluster.
- **OperatorHub** - a public catalog of published operators.

You can also write **Helm-based** operators (a controller that renders a Helm chart) and **Ansible-based** operators (a controller that runs Ansible roles). Both are fine for simpler cases, but a Go operator on controller-runtime is the default for anything stateful.

The scaffolding flow:

```bash
operator-sdk init --domain example.com --repo example.com/databasebackup-operator
operator-sdk create api --version v1alpha1 --kind DatabaseBackup
operator-sdk create controller --version v1alpha1 --kind DatabaseBackup
make manifests generate
```

The Kubebuilder-only equivalents are `kubebuilder init --domain example.com` and `kubebuilder create api --group backup --version v1alpha1 --kind DatabaseBackup`. Because Kubebuilder is embedded in the SDK, existing Kubebuilder projects work unchanged.

### Operator Lifecycle Manager and OperatorHub

OLM makes operators first-class cluster citizens through a few new resources: a **CSV (ClusterServiceVersion)** holds packaging metadata, owned APIs, RBAC and the upgrade path; a **Subscription** says "install this operator, this version, from this channel"; an **InstallPlan** is the resolved set of resources to install.

With the SDK you build a bundle and push it to a catalog:

```bash
operator-sdk generate bundle
operator-sdk bundle build
operator-sdk bundle push ./bundle/latest
```

OLM also handles upgrade edge cases that are painful to solve by hand, such as keeping two operator versions alive during a migration.
## Anatomy of a Go Operator

A scaffolded Go operator keeps four concerns apart: `api/` holds the versioned API types, `controllers/` holds the reconcilers, `config/` holds generated manifests and `main.go` wires the manager. Keep API packages free of business logic.

### Defining the API Types

```go
package v1alpha1

import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

// +kubebuilder:object:root=true
// +kubebuilder:subresource:status
// +kubebuilder:printcolumn:name="Schedule",type=string,JSONPath=`.spec.schedule`

type DatabaseBackup struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`
	Spec              DatabaseBackupSpec   `json:"spec,omitempty"`
	Status            DatabaseBackupStatus `json:"status,omitempty"`
}

type DatabaseBackupSpec struct {
	ClusterRef string `json:"clusterRef"` // managed cluster
	Schedule   string `json:"schedule"`   // cron expression
	// +kubebuilder:default=7
	Retention int32 `json:"retention,omitempty"`
}

type DatabaseBackupStatus struct {
	ObservedGeneration int64              `json:"observedGeneration,omitempty"`
	LastBackupTime     *metav1.Time        `json:"lastBackupTime,omitempty"`
	Conditions         []metav1.Condition `json:"conditions,omitempty"`
}
```

The kubebuilder markers are compiled into CRD YAML, RBAC rules and printer columns by `controller-gen`. Writing markers is far less error-prone than hand-maintaining CRD YAML.

### Writing the Reconciler

```go
func (r *DatabaseBackupReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	backup := &v1alpha1.DatabaseBackup{}
	if err := r.Get(ctx, req.NamespacedName, backup); err != nil {
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}
	if !backup.DeletionTimestamp.IsZero() {
		return ctrl.Result{}, r.finalize(ctx, backup)
	}

	// 1. Make sure the CronJob that performs the backup exists and matches spec.
	if _, err := r.ensureCronJob(ctx, backup); err != nil {
		return ctrl.Result{}, err
	}

	// 2. Observe the most recent Job and reflect reality in status.
	job, err := r.latestJobFor(ctx, backup)
	if err != nil {
		return ctrl.Result{}, err
	}
	if job != nil && job.Status.Succeeded > 0 {
		backup.Status.LastBackupTime = &metav1.Time{Time: job.Status.CompletionTime.Time}
	}
	backup.Status.ObservedGeneration = backup.Generation

	// 3. Publish status, then requeue to catch the next scheduled run.
	if err := r.Status().Update(ctx, backup); err != nil {
		return ctrl.Result{}, err
	}
	return ctrl.Result{RequeueAfter: 60 * time.Second}, nil
}
```

Four habits to copy from this skeleton:

1. **Ignore not-found on the primary get.** A deleted object is not an error.
2. **Use `Owns()` to watch child resources**, so the controller is re-triggered when the CronJob or Job changes.
3. **Set `status.observedGeneration`**, so consumers know whether status matches the latest spec.
4. **Use conditions, not ad-hoc booleans.** `metav1.Condition` gives you `Ready`, `Progressing` and `Degraded` with reasons that `kubectl describe` renders nicely.

```go
func (r *DatabaseBackupReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&v1alpha1.DatabaseBackup{}).
		Owns(&batchv1.CronJob{}).
		Owns(&batchv1.Job{}).
		Complete(r)
}
```

### Finalizers and Cleanup

Owner references handle garbage collection for objects **inside** the cluster. For anything outside it (object storage buckets, external DNS records, cloud credentials), you need a finalizer:

```go
const finalizer = "backup.example.com/cleanup"

func (r *DatabaseBackupReconciler) finalize(ctx context.Context, backup *v1alpha1.DatabaseBackup) error {
	if !controllerutil.ContainsFinalizer(backup, finalizer) {
		return nil
	}
	if err := r.deleteExternalArtifacts(ctx, backup); err != nil {
		return err
	}
	controllerutil.RemoveFinalizer(backup, finalizer)
	return r.Update(ctx, backup)
}
```

> **Caution:** A finalizer that never gets removed blocks deletion forever, and the resource stays in `Terminating` state. Always implement a timeout or a force-removal escape hatch, and test the delete path explicitly.

## Real-World Example: A Database Backup Operator

### The CRD

The CRD from earlier is the whole API surface: `clusterRef`, `schedule` and `retention`. Now the controller turns it into real work.

### The Custom Resource

```yaml
apiVersion: backup.example.com/v1alpha1
kind: DatabaseBackup
metadata:
  name: orders-db-nightly
  namespace: payments
spec:
  clusterRef: orders-db
  schedule: "0 2 * * *"
  retention: 7
```

Note that nothing in the YAML says "run a CronJob". The user expresses *intent*; the operator decides *implementation*. That indirection is the point: you can move from a CronJob to an in-process backup agent without touching a user manifest.

### The Reconcile Function

The interesting part is `ensureCronJob`, a textbook idempotent reconcile step:

```go
func (r *DatabaseBackupReconciler) ensureCronJob(ctx context.Context, backup *v1alpha1.DatabaseBackup) (*batchv1.CronJob, error) {
	cronJob := &batchv1.CronJob{
		ObjectMeta: metav1.ObjectMeta{
			Name:      backup.Name + "-backup",
			Namespace: backup.Namespace,
		},
	}
	_, err := controllerutil.CreateOrUpdate(ctx, r.Client, cronJob, func() error {
		cronJob.Spec.Schedule = backup.Spec.Schedule
		cronJob.Spec.ConcurrencyPolicy = batchv1.ForbidConcurrent
		cronJob.Spec.SuccessfulJobsHistoryLimit = ptr.To(backup.Spec.Retention)
		cronJob.Spec.JobTemplate.Spec.Template.Spec.Containers = []corev1.Container{{
			Name:  "pg-backup",
			Image: "ghcr.io/example/pg-backup:1.4.2",
		}}
		return controllerutil.SetControllerReference(backup, cronJob, r.Scheme)
	})
	if err != nil {
		return nil, err
	}
	return cronJob, nil
}
```

`CreateOrUpdate` fetches the object, applies the mutator, and issues a create or an update only if something changed - removing the entire class of "apply twice, fight the second apply" bugs.

### What Happens at Runtime

![Lifecycle of a DatabaseBackup custom resource](https://raw.githubusercontent.com/ashwani983/ashwani983.github.io/main/assets/images/blog/kubernetes-operators-explained-custom-controllers-day-2-operations-diagram-2.png)

The sequence at the end matters: the operator learns about the completed Job because it *watches* Jobs, not because the Job calls it.

## Testing Operators

### Unit Testing with envtest

`envtest` runs a real `kube-apiserver` and `etcd` locally - no cluster, no container runtime. It is fast enough for unit-test suites and catches schema, RBAC and status-subresource mistakes that mocks never will.

```go
func TestDatabaseBackupReconciler(t *testing.T) {
	testEnv := &envtest.Environment{
		CRDDirectoryPaths:     []string{filepath.Join("..", "..", "config", "crd", "bases")},
		ErrorIfCRDPathMissing: true,
	}
	cfg, err := testEnv.Start()
	require.NoError(t, err)
	defer func() { _ = testEnv.Stop() }()

	require.NoError(t, v1alpha1.AddToScheme(scheme.Scheme))
	k8sClient, err := client.New(cfg, client.Options{Scheme: scheme.Scheme})
	require.NoError(t, err)

	// Create a custom resource, run the reconciler, assert convergence.
	backup := &v1alpha1.DatabaseBackup{ObjectMeta: metav1.ObjectMeta{Name: "test", Namespace: "default"}}
	require.NoError(t, k8sClient.Create(ctx, backup))
}
```

Binaries are downloaded automatically on macOS and Linux; elsewhere point `KUBEBUILDER_ASSETS` at a directory with `etcd` and `kube-apiserver`.

### Scorecard and Integration Tests

The Operator SDK's **Scorecard** suite runs a black-box checklist against a running operator: does it survive CR deletion, handle an invalid spec, restore from a backup, support upgrades. It is the closest thing to a conformance suite for operators.

```bash
operator-sdk test scorecard --scenario basic-check.spec
operator-sdk test e2e --go-test-flags "-v"
```

## Production Hardening

![Rows of servers in a data center rack running containerized workloads](https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80)

### Least-Privilege RBAC

RBAC rules are declared with markers next to the code that needs them, and `make manifests` turns them into a ClusterRole:

```go
// +kubebuilder:rbac:groups=backup.example.com,resources=databasebackups,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=backup.example.com,resources=databasebackups/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=backup.example.com,resources=databasebackups/finalizers,verbs=update
// +kubebuilder:rbac:groups=batch,resources=cronjobs;jobs,verbs=get;list;watch;create;update;patch;delete
```

Grant `list` and `watch` on exactly what you watch, `patch` rather than `update` where you can, and nothing else. An operator with `cluster-admin` is one compromised dependency away from cluster compromise.

### High Availability and Leader Election

Run at least two replicas and let them elect a leader:

```go
mgr, err := ctrl.NewManager(ctrl.GetConfigOrDie(), ctrl.Options{
	Scheme:                  scheme,
	LeaderElection:          true,
	LeaderElectionID:        "databasebackup-operator.backup.example.com",
	LeaderElectionNamespace: "operators",
	HealthProbeBindAddress:  ":8081",
})
```

The leader does the reconciling; the standby takes over if the leader dies. Leader election is lease-based, so handover takes roughly the lease duration (commonly 15 seconds).

### Metrics and Observability

controller-runtime ships Prometheus metrics on a separate port: reconcile counters, error counters, duration histograms and work queue depth under the `controller_runtime_` namespace. The most valuable operator-specific metric is almost always **reconcile errors by reason**:

```go
var reconcileErrors = prometheus.NewCounterVec(prometheus.CounterOpts{
	Name: "operator_reconcile_errors_total",
	Help: "Total reconcile errors by reason",
}, []string{"reason"})
```

A good operator exposes three things to on-call: an error metric, how long the last successful reconcile took, and a status condition on the object. Alert on the condition, not on the operator pod - a healthy pod says nothing about whether backups are happening.

## Pitfalls and Best Practices

**Pitfalls**

- **Non-idempotent reconciles.** Appending to a list on every pass is the classic bug; the loop keeps calling you.
- **Storing state in memory.** The controller may restart or the leader may change; the API server is the only source of truth.
- **Long-running work in the reconcile function.** A backup that takes 40 minutes must be a Job, not a `for` loop inside `Reconcile`.
- **Writing `spec` from the controller.** Users own `spec`; the operator owns `status`.
- **Missing `observedGeneration`.** Without it, consumers cannot tell whether status is current.
- **Owner references across namespaces.** They are not allowed, forcing you into finalizers.

**Best practices**

- Keep `Reconcile` small and delegate to testable functions in `internal/`.
- Use `CreateOrUpdate` and `SetControllerReference` instead of hand-rolled create logic.
- Model failure with conditions (`Ready`, `Progressing`, `Degraded`) plus reasons.
- Make every external side effect idempotent or guarded, because you will get retried.
- Version the CRD: serve `v1alpha1` while you learn, then promote to `v1beta1` and `v1`.
- Ship the operator with the same rigor as your product: SBOM, image scanning, pinned digests, a rollback path.

## Key Takeaways

- An operator is a controller plus a CRD: an API for intent and a loop that enforces it.
- Reconciliation is level-triggered, idempotent and retried with backoff, which is why operators survive restarts and missed events.
- The CRD defines the contract, the reconciler defines the behaviour, and `status` plus conditions are how the operator reports back.
- Use `Owns()` for child resources, finalizers for anything outside the cluster, and `observedGeneration` so consumers can trust status.
- Tools divide cleanly: Operator SDK and Kubebuilder for writing, controller-runtime for the loop, OLM for installing and upgrading.
- Production readiness comes down to least-privilege RBAC, leader election, metrics and a real test suite.

## Frequently Asked Questions

**Do I need an operator, or is a CronJob enough?**
A CronJob is fine for a single, stateless, fire-and-forget task. Write an operator when you need continuity (knowing the last outcome), multi-object orchestration, or configuration that non-experts can use safely.

**Should I write it in Go?**
Go with controller-runtime is the default because it is the most mature path, but operators can be written in any language with a Kubernetes client - Helm-based and Ansible-based operators exist for teams that avoid Go.

**How is this different from Argo CD or Flux?**
GitOps controllers reconcile *manifests from Git*. Operators reconcile *the runtime state of a stateful system*. GitOps delivers the custom resource; the operator delivers the reality.

**Can an operator be written without a webhook?**
Yes. CRD structural schemas plus CEL rules handle validation inside the API server. Webhooks are needed only for defaulting CEL cannot express, cross-object validation, or mutation.

**What breaks operators most often in production?**
Finalizers that block deletion, non-idempotent updates causing hot loops, overly broad RBAC, and reconcile functions that perform long-running work inline.

## Related Articles

- Kubernetes Autoscaling Explained: HPA, VPA, KEDA, Cluster Autoscaler and Karpenter
- Policy as Code: Securing Kubernetes with Open Policy Agent and Kyverno
- Mastering Helm: The Complete Guide to Kubernetes Package Management
- Push vs Pull Deployment Models - Understanding GitOps and Continuous Delivery
