---
title: Flaky Tests Explained: A Practical Guide to Finding and Eliminating Test Unreliability
date: 2026-09-22
slug: flaky-tests-guide
tags: [Flaky Tests, Test Automation, Software Testing, QA, Test Reliability, CI/CD]
category: Tester
excerpt: Flaky tests erode trust in your suite. Learn how to detect, classify, and eliminate flakiness with quarantine flows, root-cause patterns, and CI practices.
readTime: 9 min read
published: true
---

# Flaky Tests Explained: A Practical Guide to Finding and Eliminating Test Unreliability

There are few things that destroy a team's trust in automated testing faster than a suite that fails for no reason. One run passes, the next run fails, the third run passes again — and nothing in the product code changed. Those unreliable tests are called **flaky tests**, and they are one of the most common, most expensive problems in modern test automation.

Flakiness is not a cosmetic annoyance. It trains developers to ignore red builds, it slows down every merge, and it hides real regressions behind a wall of noise. The good news is that flakiness is measurable, classifiable, and — once you understand its root causes — usually fixable.

In this guide we will cover what flaky tests actually are, why they matter to the business, the most common root causes with concrete code examples, how to detect flakiness systematically, and a practical playbook for eliminating it and keeping it from coming back.

## Table of Contents

- [What Is a Flaky Test?](#what-is-a-flaky-test)
- [Why Flaky Tests Matter](#why-flaky-tests-matter)
- [The Most Common Root Causes of Flakiness](#the-most-common-root-causes-of-flakiness)
- [How to Detect Flaky Tests Systematically](#how-to-detect-flaky-tests-systematically)
- [The Flaky Test Lifecycle: From Detection to Prevention](#the-flaky-test-lifecycle-from-detection-to-prevention)
- [A Real-World Example: Taming a Flaky Checkout Test](#a-real-world-example-taming-a-flaky-checkout-test)
- [Best Practices That Keep Suites Stable](#best-practices-that-keep-suites-stable)
- [Key Takeaways](#key-takeaways)
- [Frequently Asked Questions](#frequently-asked-questions)
- [Related Articles](#related-articles)

## What Is a Flaky Test?

A flaky test is a test that produces **nondeterministic results**: it can pass or fail when run against the same code under ostensibly the same conditions. The standard working definition used by large engineering organizations is:

> A test is flaky if it has both passed and failed in the same code revision, without any change to the production code or the test itself.

Flakiness is a property of the test *system*, not just the test function. A perfectly deterministic assertion can still flake because of shared state, timing assumptions, network dependencies, or test ordering.

Common symptoms of flaky tests include:

- The test fails on CI but always passes locally (or vice versa).
- Re-running a failed job makes it pass with no code changes.
- Failures cluster around specific environments, machines, or times of day.
- Failures increase when the suite runs in parallel or under load.
- Different tests fail on different runs for unexplained reasons.

Flakiness exists on a spectrum. At one end is a *rare flake* that fails perhaps 1% of runs and goes unnoticed for months. At the other end is a *chronically flaky* test that fails often enough that everyone has already learned to ignore it — the most dangerous state of all.

## Why Flaky Tests Matter

It is tempting to treat flakiness as a minor annoyance. The data suggests otherwise. Research published on large industrial test suites — most notably Google's widely cited work on flaky tests in monorepos — has consistently shown that a small percentage of tests account for a disproportionate share of flaky failures, and that the cost compounds over time.

The concrete costs fall into four buckets:

| Cost Area | What Happens |
|---|---|
| **Lost engineering time** | Developers re-run pipelines, manually inspect logs, and file "unrelated failure" comments instead of shipping. |
| **Eroded trust** | When red builds are routinely ignored, real regressions slip through the same inattention. |
| **Slower feedback** | Teams add retries, serial execution, or longer timeouts to compensate — making the suite slower for everyone. |
| **Bad prioritization** | Flaky failures mask genuine bugs in triage queues; real issues get mislabeled as "flaky" and never fixed. |

The trust problem is the most insidious. A test suite is a communication channel between the codebase and the team. Every unexplained failure degrades the signal-to-noise ratio of that channel. Once developers learn that a red build usually means "retry it," the suite has effectively stopped doing its job.

> **Caution:** Never "fix" flakiness by simply adding retries as a permanent solution. Retries can be a temporary containment measure, but they mask root causes, double execution time, and make the suite appear healthy while the underlying nondeterminism remains.

## The Most Common Root Causes of Flakiness

Almost every flaky test traces back to one of a handful of categories of nondeterminism. Learning to classify failures into these buckets makes diagnosis far faster.

### 1. Time and Timing Assumptions

Tests that depend on the clock are among the most frequent offenders: hardcoded sleeps, "today"-sensitive date logic, timezone assumptions, and deadlines that are too tight under CI load.

```python
# Flaky: assumes 2 seconds is always enough for the async job
def test_order_is_processed():
    place_order()
    time.sleep(2)
    assert get_order_status() == "processed"

# Deterministic: wait on the actual condition, with a bounded timeout
def test_order_is_processed():
    place_order()
    wait_until(lambda: get_order_status() == "processed", timeout=10)
    assert get_order_status() == "processed"
```

The fix pattern is universal: replace fixed sleeps with **condition-based waits** that poll until a specific observable state is reached (or time out with a clear error).

### 2. Shared State and Test Ordering

Tests that mutate shared database rows, files, caches, or global variables create hidden coupling. Whether the suite passes then depends on which tests ran before — and on CI, ordering often changes with parallelization.

Typical patterns:

- Two tests write to the same fixture record.
- A test leaves the database in a dirty state that breaks the next one.
- Module-level singletons are initialized once and mutated across tests.

The remedy is isolation: fresh fixtures per test, transactional cleanup, unique data per run (for example, suffixing emails with a run ID), and in-process state reset in setup/teardown.

### 3. Reliance on External Systems

Networks, third-party APIs, DNS, message brokers, and rate-limited services introduce latency and failures that your code does not control. A test that calls a real payment sandbox or a live webhook endpoint is flaky by construction.

Strategies here are about **control**:

- Replace external calls with stubs or containers at the integration boundary.
- If a live dependency is unavoidable, mark the test as non-blocking and monitor it separately.
- Bound every network call with explicit timeouts and meaningful failure messages.

### 4. Concurrency and Race Conditions

Async code, background threads, and event-driven systems can produce genuinely nondeterministic interleavings. A test may assert before a background task has finished updating state — or observe an intermediate state.

```javascript
// Flaky: click happens before the button is actually interactive
await page.click('#submit');
await page.click('#confirm');

// More stable: wait for the element to be visible AND enabled
await expect(page.locator('#confirm')).toBeEnabled();
await page.click('#confirm');
```

Selenium and Playwright both have built-in auto-waiting; fighting it with manual pauses is a classic source of flake.

### 5. Resource Contention on CI

Shared runners run out of memory, CPU throttling slows timeouts, ports collide, and containers are killed mid-test. A suite that is stable on a beefy laptop can fall apart on a small CI ephemeral runner.

Mitigations include sizing runners appropriately, bounding parallelism, staggering port allocation, and adding resource cleanup between jobs.

### 6. Randomness and Time Dependence

Property-based generators with unseeded randomness, tests that depend on the current date crossing midnight, and locale/timezone-sensitive formatting all inject nondeterminism. Seed and log randomness; freeze the clock; set the timezone explicitly in the test environment.

### Root-Cause Cheat Sheet

| Symptom | Likely Root Cause |
|---|---|
| Passes locally, fails only on CI | Timing under load, resource contention, environment config |
| Fails only when run in parallel | Shared state, port/file collisions, ordering |
| Fails after midnight or month boundaries | Hardcoded dates, clock dependence |
| Fails only against live staging APIs | External dependency latency or flakiness |
| Re-run makes it pass | Timing, async race, transient resource issue |
| Fails only in one browser/OS | Platform-specific timing or rendering differences |

## How to Detect Flaky Tests Systematically

You cannot fix what you do not measure. The most effective detection method is **rerun analysis**: run the same code revision multiple times and flag any test whose verdict differs.

A lightweight pipeline looks like this:

![Flaky test detection and quarantine pipeline](https://raw.githubusercontent.com/ashwani983/ashwani983.github.io/main/assets/images/blog/flaky-tests-guide-diagram-1.png)

Practical detection techniques include:

1. **CI rerun modes.** Many CI systems (and test runners like Jest with `--retry`, Playwright's `--retries`, and pytest-rerunfailures) can automatically retry failures and report which tests needed retries. Treat any retried-but-eventually-green test as a flaky candidate.
2. **Dedicated soak jobs.** Schedule a nightly job that runs the suite 5–10 times on the same revision purely for flake detection. It does not gate merges; it feeds a flake dashboard.
3. **Historical verdict mining.** Store pass/fail per test per run in a database and query for tests with both outcomes on the same commit SHA. This is how large organizations compute a true *flake rate*.
4. **Flake rate as a metric.** Track `flaky failures / total runs` per test over a rolling window. A test with a flake rate above roughly 1% deserves attention; above 5% it should not gate merges.

## The Flaky Test Lifecycle: From Detection to Prevention

Detection alone does not improve anything. You need a lightweight process that moves each flaky test from discovery to permanent resolution. A proven flow is:

1. **Detect.** Rerun analysis or soak job flags the test.
2. **Triage.** Classify the root cause using the cheat sheet above. Is it timing, shared state, an external dependency, or a genuine intermittent product bug? (Sometimes "flakiness" is actually a real race condition in production code — a valuable find.)
3. **Quarantine.** Move the test out of the blocking merge gate but keep it running and visible. Open a ticket with a owner and a deadline. Quarantine is a *containment* state, not a solution.
4. **Fix.** Apply the deterministic fix: condition-based waits, isolation, stubbing, seeding, environment hardening.
5. **Verify.** Re-run the test repeatedly (ideally in the soak job) and confirm zero divergent verdicts over a defined window.
6. **Restore.** Return the test to the blocking gate and remove it from the quarantine list.
7. **Prevent.** Add the pattern that caused the flake to your review checklist or lint rules so it does not reappear.

> **Important note:** Quarantine lists rot fast. Every quarantined test must have an owner and an expiry date. Teams that quarantine without enforcing expiry end up with suites where 20% of tests run outside the gate — a false sense of coverage that is arguably worse than not having those tests at all.

## A Real-World Example: Taming a Flaky Checkout Test

Consider an e-commerce team whose end-to-end checkout test failed roughly one CI run in six. The test placed an order, published an event, and asserted that the confirmation email appeared in a shared mailbox.

Diagnosis took a few hours of mining historical results:

- The test only failed **in parallel runs** → shared mailbox state.
- Two other tests also sent emails to the same mailbox → shared-state root cause.
- A fixed `sleep(3)` waited for "email delivery," which occasionally took longer under load → timing root cause.

The fixes were straightforward:

- Generate a unique mailbox address per test run (`run-<uuid>@test.local`).
- Replace the fixed sleep with a bounded condition wait on the mailbox API.
- Move the email assertion behind a test-specific idempotency key so retries could not create duplicate orders.

After the change, the team ran the test 50 times in the nightly soak job with zero divergent verdicts, then restored it to the merge gate. Flake-related CI failures for the checkout suite dropped to zero, and the average pipeline duration fell because the team no longer needed the blanket `--retries 2` flag they had added as a stopgap.

Notice what made this tractable: the team had **data** (per-run verdicts), a **classification scheme** (parallel + timing), and a **process** (quarantine with verification before restore). Flaky-test work done by vibes tends to fail; flaky-test work done as a measurable loop tends to succeed.

## Best Practices That Keep Suites Stable

Once the existing backlog is under control, prevention is cheaper than cure:

- **Prefer deterministic tests by design.** Inject the clock, seed randomness, set the timezone explicitly, and avoid real network calls in unit and integration layers.
- **Use condition-based waits everywhere.** Ban fixed `sleep` calls with a lint rule where possible (`no-focused-tests`-style linting exists for most ecosystems).
- **Isolate aggressively.** Unique fixtures per test, transactional rollback, fresh containers per job, no shared mutable globals.
- **Make failures diagnostic.** A flaky failure that produces a clear message ("condition X not met within 10s") is far cheaper to triage than a bare assertion error.
- **Gate on signal, not volume.** Track flake rate alongside coverage. A suite with 90% coverage and a 3% flake rate is less valuable than one with 80% coverage and zero flake.
- **Review tests like production code.** New tests that introduce sleeps, live external calls, or shared fixtures should fail code review the same way risky production code does.

Flakiness is ultimately a quality signal about your *engineering system*, not just your test code. Suites that are isolated, clock-controlled, and dependency-bounded tend to mirror teams that have clean module boundaries and explicit contracts — which is why investing in flake reduction pays dividends far beyond the test runner.

## Key Takeaways

- A flaky test is one that both passes and fails on the same revision; treat divergent verdicts as the definition, not "it failed once."
- Root causes cluster into a handful of categories: timing, shared state, external dependencies, concurrency, CI resource contention, and randomness/clock dependence.
- Detect flakiness with systematic reruns and track a per-test **flake rate** as a first-class metric; do not rely on anecdote.
- Quarantine is containment, not a fix — every quarantined test needs an owner, an expiry date, and a verification loop before it returns to the merge gate.
- Replace fixed sleeps with condition-based waits, isolate test data per run, and bound every external interaction with explicit timeouts.
- Sometimes "flaky" means a real race condition in production code; triage carefully before dismissing a failure as noise.

## Frequently Asked Questions

**Q1. What is a good flake rate for a healthy test suite?**
Aim for near zero on tests that gate merges. As a practical threshold, investigate any test that shows a flake rate above roughly 1% over a rolling window, and remove tests above ~5% from the blocking gate until they are fixed. Exact numbers vary by team, but the trend line matters more than any single cutoff.

**Q2. Should I use retries to deal with flaky tests?**
Only as a short-lived containment measure. Retries hide root causes, increase pipeline duration, and can let genuinely broken behavior pass. If you use retries, log every retry as a first-class event and feed those events into your flaky-test dashboard so the underlying problem stays visible.

**Q3. Are flaky tests ever a sign of real bugs in the product?**
Yes. Intermittent failures often reveal genuine race conditions, missing idempotency, or resource leaks in production code. During triage, ask whether the nondeterminism could occur for real users under load — if it can, fix the product, not just the test.

**Q4. How is flakiness different from a test that fails in one environment only?**
An environment-specific failure is usually deterministic within that environment (for example, a browser-only rendering bug). That is an environment compatibility issue, not flakiness. Flakiness specifically means *nondeterministic* outcomes under the same conditions.

**Q5. What is a test quarantine, and how long should something stay in it?**
Quarantine means the test still runs and reports results but does not fail the merge gate. Keep entries short-lived — days, not months — with a named owner and an expiry date. If a test cannot be fixed quickly, either rewrite it or delete it; a test that lives in quarantine indefinitely is technical debt disguised as coverage.

## Related Articles

- Mutation Testing Explained: How Breaking Your Code Proves Your Tests Actually Work
- Property-Based Testing Explained: Finding Bugs Your Example-Based Tests Will Never Catch
- Visual Regression Testing: The Complete Guide to Catching Broken UIs Before Your Users Do
- Chaos Engineering and Resilience Testing: A Practical Guide to Breaking Your Systems Before They Break Themselves
- Test-Driven Development (TDD) Explained: The Complete Guide with Real-World Examples
