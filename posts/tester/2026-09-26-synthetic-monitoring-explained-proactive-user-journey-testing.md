---
title: Synthetic Monitoring Explained: Proactively Testing User Journeys Before Your Users Find the Bugs
date: 2026-09-26
slug: synthetic-monitoring-explained-proactive-user-journey-testing
tags: [Synthetic Monitoring, QA, Observability, Test Automation, Performance Testing, Reliability]
category: Tester
excerpt: Learn how synthetic monitoring simulates real user journeys from global probes to catch outages, latency regressions, and broken flows before your customers do.
readTime: 15 min read
published: true
---

# Synthetic Monitoring Explained: Proactively Testing User Journeys Before Your Users Find the Bugs

Ask a room of testers what "the system is down" means and you get confident answers. Then ask what they were doing at 02:14 on Sunday morning when a payment provider started returning `502` for one acquirer route, and the room goes quiet.

That gap — between *reactive* and *proactive* evidence — is what synthetic monitoring closes. Production telemetry tells you what already happened to real users. Synthetics tell you what is happening *right now* to a scripted version of a user, from a location you chose, at a moment you decided.

This is a testing discipline first and an observability tool second. Below: what synthetic checks are, how they differ from RUM, load testing and CI smoke tests, the metrics worth alerting on, where to place probes, and how to build a programme engineers trust instead of muting after a week.

## Table of Contents

- [Why Reactive Monitoring Is Not Enough](#why-reactive-monitoring-is-not-enough)
- [What Is Synthetic Monitoring](#what-is-synthetic-monitoring)
- [Anatomy of a Synthetic Check](#anatomy-of-a-synthetic-check)
- [The Metrics That Matter](#the-metrics-that-matter)
- [Where to Run Probes](#where-to-run-probes)
- [Designing a Synthetic Strategy That Does Not Become Noise](#designing-a-synthetic-strategy-that-does-not-become-noise)
- [Real-World Example: Probing a Checkout Journey](#real-world-example-probing-a-checkout-journey)
- [The Tooling Landscape](#the-tooling-landscape)
- [Wiring Synthetic Signals Into Pipelines and On-Call](#wiring-synthetic-signals-into-pipelines-and-on-call)
- [Common Pitfalls to Avoid](#common-pitfalls-to-avoid)
- [Conclusion](#conclusion)

## Why Reactive Monitoring Is Not Enough

Reactive monitoring — traces, logs, error rates, dashboards — is essential and structurally biased. It only produces data when a real user performs the action that failed:

1. **Blind spots on low-traffic journeys.** A B2B "Export to CSV" flow or a seasonal checkout path may run a few times a day. When it breaks, you may not find out for hours.
2. **Late confirmation.** Detection time is bounded by how often real users touch the path. For a 2%-share feature, that can be tens of minutes.
3. **No reproduction.** Once a user has moved on, you argue from partial logs. A synthetic check re-runs the journey on demand, ten times, at 03:00, with full request detail.

Synthetic monitoring is dismissed as "a fancy uptime check." That misses the point. A ping says the server answers. A synthetic check says *search → filter → add to basket → apply discount → pay* still completes end to end, in 2.4 seconds, from Frankfurt, on a residential ISP.

![Synthetic probes and real users feed the same telemetry store, but only probes a](https://raw.githubusercontent.com/ashwani983/ashwani983.github.io/main/assets/images/blog/synthetic-monitoring-explained-proactive-user-journey-testing-diagram-1.png)

## What Is Synthetic Monitoring

A **synthetic check** is an automated, scheduled simulation of a user journey or network operation, executed from a controlled location, that produces an assertion-based result: pass, fail, or degrade. Three properties define it:

- **Scripted intent.** You decide what "working" means. A check does not just collect a duration; it asserts that the code is `200`, that the body contains `orderId`, and that the total falls in an expected range.
- **Controlled vantage point.** The probe runs in a region, on a network, and at a cadence you select — not wherever your customers happen to be.
- **Repeated on a schedule.** One run proves little. A check every minute turns one observation into a time series with trends and percentiles.

Here is where it sits against the tools you already have.

| Approach | Trigger | Location | Question it answers |
|---|---|---|---|
| **Synthetic monitoring** | Scheduled by you | Your probe | "Is journey X working right now from region Y?" |
| **Real User Monitoring** | Real sessions | Real users | "What did customers actually experience?" |
| **Load / performance testing** | You, with a traffic model | Staging or prod | "How does it hold under N users?" |
| **CI smoke tests** | Every commit | Build agent | "Is this build fit to ship?" |
| **Passive uptime monitoring** | Scheduled by you | Any node | "Is the endpoint answering?" |

> **Note:** synthetic monitoring does not replace RUM, it replaces the blind spots in RUM. A check running from a Frankfurt datacentre is not a customer in Lagos on a mobile network. Synthetics give you coverage and speed of detection; RUM gives you reality of impact.

## Anatomy of a Synthetic Check

Check types fall into three families:

1. **Network-level probes.** ICMP ping, TCP connect, DNS resolution, TLS handshake. Fast and cheap, and excellent for detecting routing, certificate and resolver problems.
2. **HTTP/API checks.** A request or sequence of requests with assertions on status, headers, body and latency.
3. **Browser checks.** A real browser running a multi-step journey with DOM assertions. Highest fidelity, highest cost.

![Lifecycle of a synthetic check: schedule, probe, assert, record, then alert only](https://raw.githubusercontent.com/ashwani983/ashwani983.github.io/main/assets/images/blog/synthetic-monitoring-explained-proactive-user-journey-testing-diagram-2.png)

A well-built check has four layers: **navigate**, **act**, **assert**, **record**. That last one — a HAR file or trace captured on failure — turns a ticket generator into a diagnosis generator.

### A minimal API synthetic in k6

k6 is a good fit for scheduled API checks because you can pin the virtual-user count to one and let the scheduler drive the run, rather than ramping load.

```javascript
import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const availability = new Rate('synthetic_availability');
const latency = new Trend('synthetic_api_ms');

export const options = {
  vus: 1,          // one VU, driven by the scheduler: a check, not a load test
  iterations: 1,
  thresholds: {
    synthetic_availability: ['rate>0.995'],
    synthetic_api_ms: ['p(95)<800'],
    checks: ['rate>1'],   // fail the run if any assertion fails
  },
};

export default function () {
  const res = http.get('https://api.example.com/v1/products?page=1', {
    tags: { journey: 'browse' },
  });

  availability.add(check(res, {
    'status is 200': (r) => r.status === 200,
    'content-type is json': (r) => r.headers['Content-Type']?.includes('application/json'),
    'list is not empty': (r) => {
      try { return JSON.parse(r.body).items.length > 0; } catch { return false; }
    },
  }));

  latency.add(res.timings.duration);
}
```

Run it from cron or a scheduled container and you have a synthetic monitor that costs almost nothing.

### A browser journey in Playwright

```typescript
import { expect, test } from '@playwright/test';

test('browse to basket, eu-west probe', async ({ page, request }) => {
  // Cheap API gate first: skip browser work if the backend is already down.
  const health = await request.get('https://api.example.com/v1/health');
  expect(health.ok()).toBeTruthy();
  const startedAt = Date.now();

  await page.goto('https://www.example.com/');
  await page.getByRole('searchbox').fill('trail running shoes');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('link', { name: /Trail Runner/ }).first().click();
  await page.getByRole('button', { name: 'Add to basket' }).click();
  await expect(page.getByTestId('basket-count')).toHaveText('1');

  console.log(`journey_ms=${Date.now() - startedAt}`);  // chartable trend, not a binary
});
```

The **API gate** stops a backend outage from masquerading as fifteen browser failures; the **custom measurement** turns a binary pass/fail into an alertable trend.

## The Metrics That Matter

Raw pass/fail is a start, not a strategy. Four metric families make a programme actionable.

### 1. Availability ratio

*Successful checks / total checks* over a window, reported per journey, per region and overall — an aggregate of 99.5% can hide one region at 97%.

### 2. Latency distribution

Averages hide tails. Alert on percentiles, chosen from your user experience rather than habit: a p95 of 400 ms is fine for a background export and fatal for a payment submit. Typical targets: p95 under 600 ms for search, p99 under 3 s for payment submit, p95 under 5 s for a full purchase.

### 3. Core Web Vitals at the edge

Google's Core Web Vitals give a vendor-neutral rubric you can apply directly to synthetic browser runs:

| Vital | Measures | Good | Needs improvement | Poor |
|---|---|---|---|---|
| **LCP** — Largest Contentful Paint | Loading experience | ≤ 2.5 s | ≤ 4.0 s | > 4.0 s |
| **INP** — Interaction to Next Paint | Responsiveness | ≤ 200 ms | ≤ 500 ms | > 500 ms |
| **CLS** — Cumulative Layout Shift | Visual stability | ≤ 0.1 | ≤ 0.25 | > 0.25 |

INP replaced First Input Delay in 2024, so a dashboard still showing FID is a generation behind. Caveat: synthetic runs usually measure a cold or warmed cache, so treat them as a controlled benchmark and compare against RUM for the field picture.

### 4. Apdex-style satisfaction

Apdex folds latency into a 0–1 score based on how long users tolerate waiting for that operation. Conventional bands: 0.94–1.00 excellent, 0.85–0.93 good, 0.70–0.84 tolerable, 0.50–0.69 poor, below 0.50 unacceptable.

> **Caution:** never copy a colleague's Apdex `T` value. It is per-operation — the threshold for a checkout submit is not the threshold for a background export.

## Where to Run Probes

A probe running from the same datacentre as your application cannot see the internet. Real users hit your CDN, your DNS provider, your TLS terminator and their local ISP. Probes must reproduce that path.

![Blank world map for illustrating global probe placement](https://commons.wikimedia.org/wiki/Special:FilePath/BlankMap-World-Equirectangular.svg)

Three placement dimensions matter:

- **Geography.** Cover the regions that generate revenue. Three is a sensible floor; a payments product wants more.
- **Network type.** Datacentre probes are cheap and stable. A residential or mobile-carrier probe is how you find that 4% of your European users hit a broken middlebox while your Frankfurt datacentre sails through.
- **Inside vs outside.** Probe from *outside* the perimeter (exercising DNS and the edge) and from *inside* (isolating application behaviour). Both failing means your app; only the outside failing means the network.

The classic false-green trap is the **cache**. A probe on a warm CDN edge reports the cached experience; one bypassing it exercises the origin. Label both — "slow origin" and "slow cache fill" need different fixes.

![A warm-cache probe and an origin probe exercise different paths; only the origin](https://raw.githubusercontent.com/ashwani983/ashwani983.github.io/main/assets/images/blog/synthetic-monitoring-explained-proactive-user-journey-testing-diagram-3.png)

## Designing a Synthetic Strategy That Does Not Become Noise

Every synthetic programme dies of the same disease: too many checks, all alerting, all ignored. A disciplined sequence:

1. **Start from business journeys, not endpoints.** Nobody cares that `/v1/session` is up. Finance cares that a customer can buy something.
2. **Limit tiers.** A common three-tier model: *smoke* (3–5 journeys, every 1–5 minutes, page on-call), *vital* (10–20 journeys, every 15 minutes, ticket), *extended* (hourly or nightly, dashboard only). Cadence is a cost lever: a one-minute check runs ~1,440 times a day.
3. **Separate check from notification.** A failing check should always create a record; it should page only when a burn threshold is crossed.
4. **Suppress flapping.** Require two consecutive failures, or use a multi-window burn-rate rule, so one blip does not wake anyone.
5. **Give every check an owner.** An unowned check becomes an unfixed check.

![Grafana dashboard used as a synthetic monitoring results view](https://commons.wikimedia.org/wiki/Special:FilePath/Grafana%20screenshot%20(2018).png)

## Real-World Example: Probing a Checkout Journey

Consider a mid-size online store whose coverage was unit tests plus a nightly smoke suite, and whose monitoring was server-side only. Two incidents drove the change: a 40-minute payment outage caught by a customer, and a caching regression that doubled `Add to basket` latency for three days. They shipped seven checks across three tiers — smoke on the money path, vital on discovery, extended on admin.

### The configuration

```yaml
# synthetic-checks.yml (Checkly project config)
regions: [us-east-1, eu-west-1, ap-southeast-1]
checks:
  - name: smoke-add-to-basket
    locations: [us-east-1, eu-west-1]
    frequency: 2m
    incidentStrategy: ALERT      # smoke tier pages on-call
  - name: vital-search-filter
    frequency: 15m
    incidentStrategy: TICKET    # below that, record only
```

That `incidentStrategy` split is the quiet hero of the design: smoke tiers alert, everything below is analytics.

### What the probes found

- **An expired intermediate TLS certificate** on an edge worker. The CDN terminated fine, so server-side metrics were perfect; the browser probe failed 100% from residential networks while the datacentre probe stayed green.
- **A 900 ms regression in the discount service.** The checkout check did not fail — it completed in 4.2 s, over their 3.5 s p95 threshold. A pass/fail-only check would have stayed silent.
- **A mobile-carrier failure** in one market, found only after a residential probe was added. RUM had hidden it: the market was ~2% of traffic.

> **A useful rule:** if a check cannot fail, it is a log line, not a test. If it can only fail, it is a tripwire, not a measurement. Configure checks so the interesting outcome is *degradation*, not a binary break.

## The Tooling Landscape

| Tool | Strengths | Fits best when |
|---|---|---|
| **Grafana Synthetic Monitoring** | Blackbox Exporter + Grafana Agent, k6 scripting | You already run Grafana and Prometheus |
| **Checkly** | k6-native API and browser checks, PR preview | You want code-first checks with CI integration |
| **Datadog Synthetics** | Broad check types, APM correlation | You run Datadog and want one console |
| **DIY: k6 + Playwright + cron** | Near-zero licence cost, total control | You can operate a small container fleet |

The DIY route works at modest scale: a container running a Playwright script on a schedule, posting results to a time-series database with Prometheus alert rules. For deep routing and DNS path analysis, vendors like ThousandEyes and Catchpoint go further than HTTP checks.

## Wiring Synthetic Signals Into Pipelines and On-Call

**In the pipeline.** Reuse the journey scripts as a pre-release gate, gating on *regression against a baseline* rather than absolute pass/fail. A 25% p95 jump on a 2 s checkout is worth blocking; 120 ms to 150 ms is noise.

**On-call.** Route on severity, not on check identity. The multi-window burn-rate approach from the Google SRE workbook works well: page for fast burns (1-hour against a 5-minute window), ticket for slow burns (6-hour against 30 minutes), both required to breach. It resists flapping far better than "page on any failure."

**During incidents.** Synthetics become a reproduction tool: re-run the journey from the failing region, capture a HAR file, hand engineering an artefact.

## Common Pitfalls to Avoid

1. **Testing from inside the perimeter only.** Green from your own datacentre and broken in the real world is the most common synthetic failure.
2. **High-cardinality labels.** Unique URLs, journey IDs and email addresses as metric labels will melt most time-series backends.
3. **Paging on every failure.** Alert on burn rate. Your on-call rotation's opinion of the programme is set in week one.
4. **Shared, mutating test accounts.** Concurrent probes fighting over one account produce phantom failures and contaminated data.
5. **Confusing synthetics with load testing.** One scheduled VU is a check; ramping to thousands of iterations to find saturation is a performance test for staging.
6. **Never deleting checks.** Journey coverage decays silently as features are removed. Review the inventory like code coverage.

## Conclusion

Synthetic monitoring is the missing third leg between testing and observability. Load tests tell you how the system behaves under a traffic model you invented. RUM tells you what happened to real people. Synthetics tell you, on a schedule and from a location you control, whether a defined journey still works end to end. Start with three high-value journeys, run them from two or three real regions, assert on correctness *and* latency, and wire the noisy tier to tickets.

## Key Takeaways

- Synthetic checks are *scheduled, scripted, asserted* simulations of user journeys from controlled locations — testing first, observability second.
- They cover the blind spots RUM cannot: low-traffic flows, low-traffic regions, and reproducible failure diagnosis.
- Measure latency percentiles and Core Web Vitals, not just pass/fail. Degradation is the interesting signal.
- Place probes across geographies and network types; one inside your own datacentre cannot see the internet.
- Tier your checks and separate *recording a failure* from *paging a human*.

## Frequently Asked Questions

**Is synthetic monitoring just fancier uptime monitoring?**
No, though the network-level probes overlap. Uptime monitoring asks "does this endpoint respond?" Synthetics ask "does this multi-step journey still complete correctly, within our latency budget, from this region?" The assertion logic, the browser context and the latency thresholds are the difference.

**How many checks and regions do I need to start?**
Six to ten journeys across two or three regions is realistic for a small team. Cover the flows that would cost you money if they broke, and resist the urge to check every page.

**Should synthetic checks run against production or staging?**
Production, without exception. The value is detecting real degradation on the real path — DNS, TLS, CDN and third-party dependencies included. Staging gets your CI gates.

**Are synthetics worth the cost compared to just improving RUM?**
They solve a different problem. RUM cannot tell you about a journey nobody used today, and it will not let you reproduce a failure on demand. Most mature setups run both; where budget forces a choice, add a few business-critical synthetics *alongside* RUM.

## Related Articles

- Performance Testing Masterclass — Load, Stress, and Scalability with k6
- Flaky Tests Explained: A Practical Guide to Finding and Eliminating Test Unreliability
- Service Level Objectives and Error Budgets: The SRE Guide to Measuring Reliability
- OpenTelemetry in DevOps: Unified Traces, Metrics, and Logs for Modern Observability
