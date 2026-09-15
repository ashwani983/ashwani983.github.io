---
title: Local-First Software and CRDTs: A Practical Guide to Building Collaborative Apps Without the Cloud
date: 2026-09-15
slug: local-first-software-crdts-practical-guide
tags: [CRDTs, Local-First Software, Distributed Systems, Web Development, JavaScript, Collaboration]
category: Developer
excerpt: Learn how CRDTs enable local-first applications that work offline, sync peer-to-peer, and eliminate server bottlenecks for real-time collaboration.
readTime: 8 min read
published: true
---

# Local-First Software and CRDTs: A Practical Guide to Building Collaborative Apps Without the Cloud

The cloud has dominated software architecture for over a decade. Every keystroke, every toggle, every click travels to a remote server and back. But a growing movement among developers is flipping that model on its head: **local-first software**. Instead of treating the cloud as the source of truth, local-first apps keep data on the user's device, sync peer-to-peer, and work flawlessly offline. The technology making this possible is called **CRDTs** — Conflict-free Replicated Data Types.

This guide explains what local-first software and CRDTs are, why they matter in 2026, and how to implement them in your own applications.

## Table of Contents

- [What Is Local-First Software?](#what-is-local-first-software)
- [Why Local-First Matters Now](#why-local-first-matters-now)
- [What Are CRDTs?](#what-are-crdts)
- [Types of CRDTs](#types-of-crdts)
- [How CRDTs Resolve Conflicts](#how-crdts-resolve-conflicts)
- [Architecture of a Local-First App](#architecture-of-a-local-first-app)
- [Hands-On: Building a Collaborative Todo List with CRDTs](#hands-on-building-a-collaborative-todo-list-with-crdts)
- [Real-World Examples of Local-First Software](#real-world-examples-of-local-first-software)
- [Challenges and Trade-offs](#challenges-and-trade-offs)
- [When to Use Local-First vs. Client-Server](#when-to-use-local-first-vs-client-server)
- [Key Takeaways](#key-takeaways)
- [Frequently Asked Questions](#frequently-asked-questions)
- [Related Articles](#related-articles)

## What Is Local-First Software?

Local-first software is an approach where the user's device is the primary home of data. Applications read and write locally, and changes are synchronized to other devices or users asynchronously — often through peer-to-peer connections rather than a centralized server.

The concept was popularized by a 2019 essay from Ink & Switch researchers Martin Kleppmann, Adam Wiggins, Peter van Hardenberg, and Mark McGranaghan. They identified seven ideals for local-first software:

1. **No spinners** — data loads instantly from local storage.
2. **Your work is not trapped on one device** — sync across all your devices.
3. **The network is optional** — the app works without internet.
4. **Seamless collaboration** — multiple users can edit simultaneously.
5. **The longivity of your data** — not tied to a startup's survival.
6. **Security and privacy** — end-to-end encryption by default.
7. **User retains ownership** — data stays under user control.

Think of tools like Figma, Google Docs, or Notion. Users expect real-time collaboration, but those apps depend entirely on cloud infrastructure. Local-first apps aim to deliver the same experience without that dependency.

## Why Local-First Matters Now

Several trends in 2026 are accelerating adoption:

- **Remote and distributed work** demands tools that sync across devices and time zones.
- **Privacy regulations** (GDPR, CCPA, and newer frameworks) push developers to minimize server-side data retention.
- **Edge computing** reduces latency but still introduces a single point of failure.
- **AI-powered apps** increasingly need to run inference locally on-device, requiring local data access.
- **Developer frustration** with cloud vendor lock-in and unpredictable hosting costs is growing.

The result: more teams are asking whether the cloud is truly necessary for every data operation, or whether a hybrid local-first approach can deliver better performance, privacy, and reliability.

## What Are CRDTs?

**CRDTs** (Conflict-free Replicated Data Types) are data structures designed to be replicated across multiple nodes. Each node can update its local copy independently, and when the copies are merged, the CRDT guarantees they converge to the same state — without requiring coordination or conflict resolution.

The key insight is mathematical: CRDTs are designed so that the order of operations does not affect the final result. Commutativity, associativity, and idempotency are built into the data structure itself.

> **Key Insight:** Unlike operational transforms (used by Google Docs), CRDTs do not need a central server to mediate conflicts. Every peer can merge changes independently, making them ideal for peer-to-peer and offline-first architectures.

CRDTs come in two major flavors:

### State-Based CRDTs (CvRDTs)

Each replica ships its entire state to other replicas. The merge function combines states using a **semilattice** — a mathematical structure where the merge is commutative, associative, and idempotent.

```javascript
// Simplified state-based CRDT merge
function merge(localState, remoteState) {
  // For a G-Counter: take the max of each node's count
  const merged = {};
  for (const key of Object.keys(localState)) {
    merged[key] = Math.max(localState[key], remoteState[key] || 0);
  }
  for (const key of Object.keys(remoteState)) {
    merged[key] = Math.max(merged[key] || 0, remoteState[key]);
  }
  return merged;
}
```

### Operation-Based CRDTs (OpCRDTs)

Instead of shipping full state, each node broadcasts individual operations. The infrastructure guarantees that all operations are delivered to all replicas, but delivery order does not matter — operations are designed to commute.

```javascript
// Operation-based CRDT for a counter
// Op: { type: 'increment', node: 'A', amount: 1 }
// These ops can arrive in any order and still converge
```

## Types of CRDTs

Here are the most commonly used CRDT types:

| CRDT Type | Use Case | How It Works |
|-----------|----------|--------------|
| **G-Counter** | Counting with multiple writers | Each node tracks its own count; total is the sum of all |
| **PN-Counter** | Counting with increments and decrements | Two G-Counters: one for increments, one for decrements |
| **G-Set** | Growing-only sets | Union of all added elements; no removals |
| **OR-Set** | Sets with add and remove | Each add gets a unique tag; remove deletes specific tags |
| **LWW-Register** | Last-writer-wins registers | Each value tagged with timestamp; latest wins |
| **RGA** | Ordered sequences (text, lists) | Inserts and deletes on a linked structure with timestamps |
| **Merkle-CRDT** | File systems, trees | Combines CRDTs with Merkle trees for versioned hierarchies |

## How CRDTs Resolve Conflicts

Consider two users editing a collaborative document. Alice inserts the letter "A" at position 0, and Bob inserts "B" at position 0 simultaneously. In a naive system, this creates a conflict. With an RGA-based CRDT:

1. Each insert operation is tagged with a unique identifier (e.g., a Lamport timestamp or node ID + counter).
2. When the operations arrive at a replica, the CRDT defines a deterministic ordering rule — for example, when two inserts target the same position, the one with the higher timestamp wins.
3. Both replicas independently apply the same rule and arrive at the same document state.

No central server needed. No user-facing conflict dialog. The math handles it.

![How two users' edits converge using CRDTs](https://raw.githubusercontent.com/ashwani983/ashwani983.github.io/main/assets/images/blog/local-first-software-crdts-practical-guide-diagram-1.png)

## Architecture of a Local-First App

A typical local-first application has several key layers:

![Architecture layers of a local-first application](https://raw.githubusercontent.com/ashwani983/ashwani983.github.io/main/assets/images/blog/local-first-software-crdts-practical-guide-diagram-2.png)

### Local Storage

Data lives on the device. Common choices include:

- **IndexedDB** — built into browsers, works with service workers.
- **SQLite** — via `wa-sqlite` or `sql.js` compiled to WebAssembly.
- **OPFS** (Origin Private File System) — a newer browser API for file-based storage with worker access.

### CRDT Engine

The CRDT engine manages the in-memory data structure, handles merging, and provides APIs for reading and writing. The two most popular JavaScript libraries are:

- **Yjs** — a high-performance CRDT library with bindings for ProseMirror, CodeMirror, Monaco, and more.
- **Automerge** — a JSON-like CRDT library from the original local-first researchers, with a focus on developer ergonomics.

### Sync Transport

Changes need to reach other peers. Options include:

- **WebRTC** — direct browser-to-browser connections.
- **WebSocket relay servers** — lightweight servers that forward messages without interpreting them.
- **WebTorrent / Dat** — peer-to-peer networks for larger-scale sync.

## Hands-On: Building a Collaborative Todo List with CRDTs

Here is a minimal example using **Yjs** and a WebRTC transport.

### Step 1: Install Dependencies

```bash
npm install yjs y-webrtc y-indexeddb
```

### Step 2: Initialize the CRDT Document

```javascript
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';

// Create a CRDT document
const doc = new Y.Doc();

// Sync via WebRTC (peer-to-peer)
const provider = new WebrtcProvider('my-todos-room', doc);

// Persist to IndexedDB (local storage)
const persistence = new IndexeddbPersistence('todos', doc);

// Shared CRDT data structure
const todos = doc.getArray('todos');

// Listen for changes from any source (local or remote)
todos.observe((event) => {
  console.log('Todos changed:', todos.toArray());
  renderTodos(todos.toArray());
});
```

### Step 3: Add and Complete Todos

```javascript
function addTodo(text) {
  const todo = new Y.Map();
  todo.set('text', text);
  todo.set('completed', false);
  todo.set('id', crypto.randomUUID());
  todos.push([todo]);
}

function toggleTodo(index) {
  const todo = todos.get(index);
  if (todo) {
    const completed = todo.get('completed');
    todo.set('completed', !completed);
  }
}
```

### Step 4: Connect to Other Peers

When a second user opens the same page, the WebRTC provider automatically discovers them (via a signaling server) and begins exchanging CRDT updates. Both users see the same list, even if one goes offline temporarily. When they reconnect, the CRDT merges all changes automatically.

```javascript
// Check connection status
provider.on('peers', ({ peers }) => {
  console.log(`Connected to ${peers.length} peer(s)`);
});
```

This example demonstrates the core promise of local-first: the app works instantly (no server round-trip), survives offline, and syncs seamlessly when peers reconnect.

## Real-World Examples of Local-First Software

Several successful applications have adopted local-first principles:

- **Figma** — uses operational transforms (a cousin of CRDTs) for real-time design collaboration.
- **Linear** — a project management tool that caches data locally for instant access.
- **Apple Notes** — stores notes locally first, syncing via iCloud.
- **Notion** — increasingly moving toward local-first patterns for offline editing.
- **Ink & Switch research projects** — Automerge, Minijam, and PartyKit demonstrate CRDT-based collaboration.

The trend is clear: even cloud-heavy companies are investing in local-first capabilities because users demand offline access, instant loading, and real-time collaboration.

## Challenges and Trade-offs

Local-first is not without complications:

- **Data consistency** — CRDTs guarantee eventual convergence, but users may see intermediate states that look inconsistent. For example, two users editing the same paragraph may produce unexpected results until all operations have synced.
- **Storage limits** — keeping all data on-device can exceed browser storage quotas. Strategies like garbage collection and partial sync help, but add complexity.
- **Security** — end-to-end encryption is ideal but harder to implement. CRDT metadata (node IDs, timestamps) can leak information if not handled carefully.
- **Conflict UX** — while CRDTs prevent data loss, the merged result may not match any user's intent. Some applications still need human-in-the-loop conflict resolution for semantic conflicts.
- **Maturity** — CRDT libraries are improving rapidly, but the ecosystem is less mature than traditional databases and ORMs.

> **Important:** CRDTs solve the data-level conflict problem perfectly. They do not solve the *semantic* conflict problem — when two users make logically incompatible changes, the CRDT will merge them, but the result may not make sense. Plan your UX accordingly.

## When to Use Local-First vs. Client-Server

| Factor | Local-First | Client-Server |
|--------|------------|---------------|
| Offline support | Native | Requires service workers |
| Latency | Instant (local reads) | Network round-trip |
| Real-time collaboration | Peer-to-peer via CRDTs | Server-mediated |
| Data ownership | User-controlled | Server-controlled |
| Scalability | Limited by device storage | Scales with server infra |
| Conflict resolution | Automatic via CRDTs | Server is authority |
| Complexity | Higher (sync, merging) | Lower (traditional CRUD) |

For most applications, a **hybrid approach** works best: keep a local CRDT for instant reads and offline access, but also maintain a server that stores an authoritative copy and handles access control. This gives you the best of both worlds — the speed and resilience of local-first with the security and scalability of the cloud.

## Key Takeaways

- **Local-first software** keeps data on the user's device, enabling instant loads, offline access, and peer-to-peer sync.
- **CRDTs** are mathematically guaranteed to converge, eliminating the need for a central server to resolve conflicts.
- **Yjs and Automerge** are production-ready CRDT libraries for JavaScript that integrate with popular editors and frameworks.
- **Hybrid architectures** combining local CRDTs with cloud sync are the pragmatic choice for most applications in 2026.
- **Semantic conflicts** — where two users make logically incompatible edits — still require thoughtful UX, even with CRDTs.
- The movement toward local-first is driven by demands for **privacy, performance, and resilience** across the modern developer ecosystem.

## Frequently Asked Questions

### What is the difference between CRDTs and Operational Transforms?

Operational Transforms (OT) transform operations against each other to maintain consistency, typically requiring a central server to determine the canonical order. CRDTs, by contrast, are designed so that any order of operations converges to the same state, making them suitable for peer-to-peer architectures without a central coordinator.

### Can I use CRDTs with an existing SQL database?

Yes, but it requires a sync layer between the CRDT and the database. Libraries like **Automerge** and **ElectricSQL** are working on this integration. In practice, many teams use a CRDT for the client-side representation and replicate changes to a server-side SQL database for long-term storage and querying.

### Are CRDTs only for text collaboration?

No. CRDTs exist for many data types: counters, sets, maps, registers, graphs, and more. Text collaboration (using RGA or similar) is just one application. CRDTs are equally useful for collaborative spreadsheets, design tools, task boards, configuration files, and even distributed databases.

### How do CRDTs handle large documents?

Large documents can produce large CRDT histories. Most CRDT implementations provide garbage collection to prune old metadata. Yjs, for example, supports `doc.gc = true` to remove tombstones for deleted elements. For very large documents, techniques like chunking and lazy loading help manage memory.

### Is local-first secure?

Local-first does not automatically mean secure, but it enables strong security patterns. Because data stays on the user's device, you can apply end-to-end encryption before syncing. CRDT metadata must be handled carefully to avoid leaking information. Libraries like **libp2p** and **Hush** provide encrypted peer-to-peer transport layers.

## Related Articles

- [Model Context Protocol Explained: How to Connect AI Agents to Tools and Data with MCP](/model-context-protocol-explained-how-to-connect-ai-agents-to-tools-and-data-with-mcp)
- [RAG Explained: A Practical Guide to Building AI-Powered Applications with Retrieval-Augmented Generation](/rag-explained-a-practical-guide-to-building-ai-powered-applications-with-retrieval-augmented-generation)
- [Signals in Frontend Development: The Reactivity Pattern Reshaping Modern Web Frameworks](/signals-in-frontend-development-the-reactivity-pattern-reshaping-modern-web-frameworks)
- [WebAssembly Beyond the Browser: A Practical Guide to WASM in 2026](/webassembly-beyond-the-browser-a-practical-guide-to-wasm-in-2026)
