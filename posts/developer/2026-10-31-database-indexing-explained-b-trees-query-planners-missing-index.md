---
title: Database Indexing Explained - B-Trees, Query Planners, and the True Cost of a Missing Index
date: 2026-10-31
slug: database-indexing-explained-b-trees-query-planners-missing-index
tags: [Database Indexing, B-Tree, SQL, Query Optimization, Databases, Performance]
category: Developer
excerpt: Learn how B-tree indexes work, how query planners choose them, and how to read execution plans, avoid redundant indexes, and keep writes fast.
readTime: 15 min read
published: true
---

# Database Indexing Explained - B-Trees, Query Planners, and the True Cost of a Missing Index

A query that takes 40 milliseconds in development can take 40 seconds in production. The SQL is unchanged, the application code is unchanged, and the server may even be larger. What changed is the data: more rows, different value distributions, and a query plan that no longer has a useful path through the table.

Indexes are the primary tool for fixing that class of problem. They are also one of the easiest database features to misuse. Adding an index can make one query fast while quietly making every write slower. Adding the wrong index can consume gigabytes and still leave the slow query untouched. Understanding how indexes are structured, how the optimizer reasons about them, and how to verify the result with an execution plan is therefore a core developer skill.

This guide walks through the mechanics of B-tree indexes, the way query planners choose an access path, the design of composite and covering indexes, and the operational habits that keep indexes useful rather than merely numerous.

![Rows of servers in a data center](https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80)

## Table of Contents

- [Why an Index Exists](#why-an-index-exists)
- [How a B-Tree Index Is Structured](#how-a-b-tree-index-is-structured)
- [What the Query Planner Actually Does](#what-the-query-planner-actually-does)
- [Composite, Covering, and Partial Indexes](#composite-covering-and-partial-indexes)
- [Reading an Execution Plan](#reading-an-execution-plan)
- [When Indexes Hurt](#when-indexes-hurt)
- [A Real-World Example](#a-real-world-example)
- [Operational Practices That Keep Indexes Healthy](#operational-practices-that-keep-indexes-healthy)
- [Key Takeaways](#key-takeaways)
- [Frequently Asked Questions](#frequently-asked-questions)

## Why an Index Exists

A table is stored as a collection of rows spread across fixed-size pages. Without an index, the database must read those pages to find matching rows. A sequential scan is not inherently bad: it reads pages in physical order, which is friendly to the operating system and to storage hardware. For a small table, a selective query that returns most of the table, or an analytics workload that genuinely needs every row, a sequential scan is often the correct choice.

An index is a separate data structure that maps key values to row locations. Instead of inspecting every row, the database can navigate to a small number of candidate entries and then fetch the corresponding rows. The trade-off is straightforward:

| Access path | Best for | Main cost |
| --- | --- | --- |
| Sequential scan | Small tables, low selectivity, full-table analytics | Reads many pages |
| Index scan | Highly selective equality or range predicates | Random I/O to fetch table rows |
| Index-only scan | Queries covered by the index | Larger indexes, visibility checks |
| Bitmap index scan | Medium selectivity with many matches | Building and sorting the bitmap |

The important word is *selective*. An index on a column where 80 percent of rows share the same value may not save meaningful work. The optimizer knows this, at least approximately, because it maintains statistics about value distributions.

> An index is not free. Every insert, update, and delete must maintain every affected index, and each index consumes disk and cache. A missing index slows reads; an unnecessary index slows writes and can push a healthy database into I/O contention.

## How a B-Tree Index Is Structured

Most relational databases use a B-tree variant for general-purpose indexes. PostgreSQL calls its default index type B-tree, while InnoDB, the default storage engine in MySQL, uses a B+tree structure. The names differ, but the central idea is the same: a shallow, balanced tree with a high fanout, where each node is a database page.

A B-tree keeps keys sorted. Internal pages contain separator keys and pointers to child pages. Leaf pages contain the indexed keys and references to the table rows. Because each page can hold hundreds of keys, a tree covering millions of rows is often only three or four levels deep. Finding a key may require just a handful of page reads instead of thousands.

![Diagram of a B-tree with a root, internal nodes, and leaf nodes](https://commons.wikimedia.org/wiki/Special:FilePath/B-tree.svg?width=800)

The sorted order provides more than point lookups. It supports range predicates, prefix matching, `ORDER BY` without an explicit sort, and efficient `MIN` and `MAX` operations. That is why a B-tree is usually the first index type to consider for ordinary application queries. Other index types serve different shapes of data: hash indexes for equality, inverted indexes for text search, GiST and GIN indexes for geometric or array data in PostgreSQL, and geospatial indexes for location queries.

In a clustered index, such as the primary key index in InnoDB, the leaf pages contain the actual row data. Secondary indexes then store the primary key value and require a second lookup into the clustered index. PostgreSQL tables are heap-organized by default, so index entries point to a physical row location, and an update that moves a row must update its index entries.

![How a B-tree index turns a table scan into a short navigation path](https://raw.githubusercontent.com/ashwani983/ashwani983.github.io/main/assets/images/blog/database-indexing-explained-b-trees-query-planners-missing-index-diagram-1.png)

## What the Query Planner Actually Does

The query planner, also called the optimizer, compares possible execution strategies and estimates their cost. It does not simply see an index and use it. It considers statistics, predicate selectivity, table and index sizes, correlation between physical row order and indexed values, available memory, and the expected number of rows.

For a query such as:

```sql
SELECT id, total_cents
FROM orders
WHERE tenant_id = 42
  AND created_at >= now() - interval '30 days'
ORDER BY created_at DESC
LIMIT 50;
```

the optimizer might choose an index scan that reads the index in reverse order and stops after 50 matching rows. If the predicate matches a large fraction of the table, a sequential scan followed by a sort may be cheaper. If the table is small enough to fit in memory, the difference may be negligible.

Statistics are central to these decisions. PostgreSQL collects them through `ANALYZE`, and it can track extended statistics for correlated columns. MySQL uses persistent optimizer statistics for InnoDB tables. Out-of-date statistics are a common reason for a plan to change unexpectedly after a bulk load, a data migration, or a sudden shift in tenant sizes.

Planner estimates can also be wrong. A query that returns 50 rows in a test database may return 500,000 rows in production. The optimizer might estimate a uniform distribution when the real data is heavily skewed. This is why diagnosing a slow query means comparing the estimated row count with the actual row count in an execution plan, not just looking for the word "index" in the output.

## Composite, Covering, and Partial Indexes

Single-column indexes are the simplest case. Real application queries often filter and sort by multiple columns, which is where column order matters.

A composite index on `(tenant_id, created_at)` is ordered first by `tenant_id`, then by `created_at` within each tenant. It supports:

- `WHERE tenant_id = 42`
- `WHERE tenant_id = 42 AND created_at >= '2026-10-01'`
- `WHERE tenant_id = 42 ORDER BY created_at DESC`

It does not efficiently support a query that filters only on `created_at`, because the leading column is absent. This is the leftmost-prefix rule. It is a property of the index structure, not an arbitrary convention.

A useful design heuristic is: equality predicates first, range predicates next, and sort columns arranged so the index can satisfy the ordering. But heuristics are not laws. A column with very low cardinality, such as a boolean flag or a status with three values, may not be a strong leading column unless queries almost always include it and the values are unevenly distributed.

A covering index includes every column needed by a query, allowing an index-only scan and avoiding table lookups. PostgreSQL supports this with `INCLUDE`:

```sql
CREATE INDEX CONCURRENTLY orders_tenant_created_cover_idx
ON orders (tenant_id, created_at DESC)
INCLUDE (id, total_cents);
```

InnoDB behaves differently because secondary indexes already contain the primary key. Adding every selected column to an index can still help, but it increases index size and write cost. A covering index should be justified by a high-frequency query, not added speculatively.

Partial indexes index only a subset of rows:

```sql
CREATE INDEX orders_pending_idx
ON orders (created_at)
WHERE status = 'pending';
```

This is valuable when the important query touches a small, well-defined slice of a large table. The index is smaller, cheaper to maintain, and more likely to remain in cache.

## Reading an Execution Plan

Execution plans are the ground truth for index decisions. In PostgreSQL, start with `EXPLAIN (ANALYZE, BUFFERS)`. `ANALYZE` actually runs the query and reports real timings and row counts; `BUFFERS` shows how many pages were read from cache or storage. In MySQL, use `EXPLAIN ANALYZE` where available, or `EXPLAIN FORMAT=JSON` for detailed cost and row estimates.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, total_cents
FROM orders
WHERE tenant_id = 42
  AND created_at >= now() - interval '30 days'
ORDER BY created_at DESC
LIMIT 50;
```

An illustrative plan for a well-indexed query might look like this:

```text
Limit  (cost=0.56..18.90 rows=50 width=16) (actual time=0.041..0.212 rows=50 loops=1)
  Buffers: shared hit=24
  ->  Index Scan Backward using orders_tenant_created_idx on orders
        (cost=0.56..74210.00 rows=208000 width=16)
        (actual time=0.038..0.190 rows=50 loops=1)
        Index Cond: ((tenant_id = 42) AND (created_at >= (now() - '30 days'::interval)))
        Buffers: shared hit=24
```

The exact numbers will differ, but the shape tells a story. The index condition contains both predicates, the scan is backward to satisfy the descending order, and only 24 buffer accesses were needed. A sequential scan with a large `rows removed by filter` count would suggest a missing or unusable index.

Look for these warning signs:

1. A large gap between estimated and actual rows.
2. A sequential scan on a large table with a highly selective filter.
3. A sort step operating on far more rows than the final limit.
4. Repeated index lookups where a composite or covering index would avoid them.
5. Buffer reads that significantly exceed cache hits on a repeated query.

## When Indexes Hurt

Indexes are not a default good. They are a physical design choice with measurable costs.

- **Write amplification.** Every index must be updated when indexed columns change, and some databases update multiple index entries when a row moves. A table with twelve indexes can turn a simple insert into thirteen write operations.
- **Storage and cache pressure.** Large indexes compete with table data for memory. An index that is rarely used can evict a hotter index from the buffer cache.
- **Low selectivity.** An index on a column with only a few distinct values may not reduce the number of pages read enough to justify the lookup overhead.
- **Function-wrapped columns.** A predicate such as `WHERE lower(email) = 'user@example.com'` cannot use a plain index on `email` unless a matching expression index exists.
- **Type mismatches and implicit casts.** Comparing a string parameter to an integer column, or a timestamp with a different time zone type, can prevent index use.
- **Leading wildcards.** `LIKE '%term'` generally cannot use a normal B-tree index. Full-text or trigram indexes are better fits.
- **Redundant indexes.** An index on `(a)` is redundant if `(a, b)` already exists, because the composite index supports the same prefix queries.

## A Real-World Example

Consider a multi-tenant SaaS application with an `orders` table. The original schema has a primary key on `id` and a single index on `tenant_id`. In the first year, queries are fast. After several years and hundreds of millions of rows, the dashboard query becomes the slowest endpoint in the product.

The query filters by tenant, restricts to the last 30 days, orders by creation time, and returns 50 rows. The existing `tenant_id` index finds every order for that tenant. For a large tenant, that could be millions of rows. The database then sorts those rows by `created_at` and discards almost all of them. The index is doing work, but not the right work.

A composite index on `(tenant_id, created_at DESC)` changes the shape of the operation. The database navigates to the tenant's recent entries, reads them in the required order, and stops after 50 rows. The sort disappears from the plan, and the number of buffer accesses falls sharply.

This example is deliberately simple, but the reasoning generalizes. The question is not "Is there an index on this column?" The questions are:

- Which predicates are selective?
- Which columns determine the access path?
- Does the index satisfy the ordering?
- Can the query avoid table lookups?
- What does the plan say about estimated versus actual rows?

An illustrative before-and-after comparison might look like this:

| Metric | Before | After |
| --- | --- | --- |
| Access path | Index scan plus sort | Ordered index scan |
| Rows examined | Hundreds of thousands | Enough to satisfy the limit |
| Sort step | Present | Eliminated |
| Write overhead | One small index | One wider composite index |

The numbers are not a benchmark; they are a model for the change in plan shape. Real measurements must come from your own database, data distribution, and hardware.

## Operational Practices That Keep Indexes Healthy

Index design does not end when the migration is merged. Production databases change continuously, and indexes need periodic review.

**Find the expensive queries first.** PostgreSQL's `pg_stat_statements` extension ranks queries by total execution time. MySQL's performance schema provides similar visibility. Optimize the queries that consume the most time, not the ones that merely look inefficient in code review.

**Check whether indexes are used.** PostgreSQL exposes index usage through `pg_stat_user_indexes`. An index with zero scans over a representative period is a candidate for removal, after accounting for rare reporting jobs and constraints.

**Create indexes concurrently.** On PostgreSQL, `CREATE INDEX CONCURRENTLY` avoids blocking writes, at the cost of a longer build and additional validation work. Plan index migrations separately from application deployments.

**Watch for bloat and fragmentation.** Heavy update workloads can leave indexes larger than necessary. PostgreSQL's `pg_stat_user_indexes` and `pgstattuple` can help diagnose bloat. InnoDB users should understand page merging and rebuild behavior rather than assuming that an index always remains compact.

**Refresh statistics after large changes.** Run `ANALYZE` after bulk loads or major data migrations. Stale statistics can cause the planner to choose a plan that was reasonable for yesterday's data but is wrong for today's.

**Test with realistic data volumes and distributions.** A query plan on a thousand rows says very little about behavior on a hundred million rows. Include production-like skew in performance tests, especially for multi-tenant systems.

## Key Takeaways

- A B-tree index is a sorted, page-based structure that trades additional storage and write work for faster lookups, ranges, and ordering.
- The query planner chooses an access path based on statistics and estimated cost; the presence of an index does not guarantee that it will be used.
- Composite index column order matters. Equality predicates, range predicates, and sort requirements should drive the design.
- Execution plans with actual row counts and buffer statistics are the most reliable way to diagnose index problems.
- Every index has a maintenance cost. Remove redundant and unused indexes, and measure the effect on writes before adding more.
- Create indexes concurrently in production and refresh statistics after large data changes.

## Frequently Asked Questions

### Does every foreign key need an index?

Not automatically, but it is often a good idea. Many databases do not create an index on the referencing column by default. Without one, deletes or updates on the parent table may require scanning the child table, and joins on the foreign key can be slow. Check the query workload and the database's behavior rather than assuming.

### Why is my index not being used?

Common causes include low selectivity, stale statistics, a type mismatch or implicit cast, a function applied to the indexed column, a leading wildcard in `LIKE`, or a planner estimate that a sequential scan is cheaper. Read the execution plan and compare the predicate with the index definition.

### Is a composite index better than several single-column indexes?

It depends on the queries. A composite index can satisfy a multi-column filter and avoid extra lookups, but it is wider and may not support queries that use only the second column. Several single-column indexes can sometimes be combined with a bitmap scan, but that is not guaranteed to be efficient. Design around actual query patterns.

### How many indexes are too many?

There is no universal number. The limit is determined by write throughput, storage, cache pressure, and maintenance time. A read-heavy analytics table may tolerate many indexes; a high-volume transactional table may suffer with even a few unnecessary ones. Measure insert and update latency as well as read performance.

### Should I index a boolean column?

Usually not as a standalone index, because the value has very low cardinality. A partial index on the rare value can be effective, such as indexing only rows where `status = 'pending'`. A composite index that includes the boolean alongside a more selective column may also make sense.

