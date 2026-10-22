---
title: CORS Explained: The Complete Guide to Cross-Origin Resource Sharing, Preflight Requests and Secure API Access
date: 2026-10-22
slug: cors-explained-cross-origin-resource-sharing
tags: [CORS, Web Security, HTTP, APIs, Browser Security, Same-Origin Policy]
category: Others
excerpt: Learn how CORS works, why browsers block cross-origin API calls, and how to fix CORS errors with preflights, correct headers and proxy patterns.
readTime: 13 min read
published: true
---

# CORS Explained: The Complete Guide to Cross-Origin Resource Sharing, Preflight Requests and Secure API Access

Somewhere in your browser console you will find a wall of text like this:

```text
Access to fetch at 'https://api.example.com/v1/orders' from origin
'https://app.example.com' has been blocked by CORS policy: Response to
preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin'
header is present on the requested resource.
```

It looks like a server bug. It is not. It is a browser doing what it was designed to do: refusing to hand a response from one origin to a page loaded from another. Behind that red text is a small set of rules, a handful of HTTP headers, and one architectural decision — proxy or allow — that shapes how your frontend talks to your backend.

This guide covers what an origin actually is, when the browser sends a preflight, which headers decide the outcome, how credentials change the rules, how to configure CORS in common stacks, and how to avoid CORS entirely with a proxy.

## Table of Contents

- [What Is Cross-Origin Resource Sharing?](#what-is-cross-origin-resource-sharing)
- [Why the Same-Origin Policy Exists](#why-the-same-origin-policy-exists)
- [Simple Requests vs. Preflighted Requests](#simple-requests-vs-preflighted-requests)
- [The Response Headers That Decide Everything](#the-response-headers-that-decide-everything)
- [Walking Through a Real CORS Failure](#walking-through-a-real-cors-failure)
- [Credentials, Cookies and the Wildcard Trap](#credentials-cookies-and-the-wildcard-trap)
- [Configuring CORS Across the Stack](#configuring-cors-across-the-stack)
- [The Proxy Pattern: Avoiding CORS Entirely](#the-proxy-pattern-avoiding-cors-entirely)
- [CORS for Static Assets, Fonts and WASM](#cors-for-static-assets-fonts-and-wasm)
- [Security Misconfigurations to Avoid](#security-misconfigurations-to-avoid)
- [Best-Practice Checklist](#best-practice-checklist)
- [Key Takeaways](#key-takeaways)
- [Frequently Asked Questions](#frequently-asked-questions)

## What Is Cross-Origin Resource Sharing?

An **origin** is the combination of three things:

```text
scheme://host:port
```

That is the whole definition. `https://app.example.com` and `https://app.example.com:443` are the same origin (443 is the default for HTTPS), but `http://app.example.com`, `https://api.example.com` and `https://app.example.com:8443` are three different origins — scheme and port both count.

**Cross-Origin Resource Sharing (CORS)** lets a page on one origin read a response from another. It is a browser-enforced permission system built on standard HTTP headers:

1. The browser attaches an `Origin` header to cross-origin requests.
2. The server responds with `Access-Control-Allow-Origin` and friends.
3. The browser compares the two. If the server said no, the response is withheld from JavaScript.

Three consequences explain most CORS confusion:

- **CORS is enforced by the browser only.** A `curl` request, a mobile app or a server-to-server call is unaffected.
- **CORS is not authentication.** It says nothing about *who* the user is or *what* they may do. It is a read-permission gate for JavaScript, not an identity system.
- **A failed CORS check does not mean the request failed.** For a simple request, the request *did* reach your server and *did* run your code. The browser simply refused to hand the response back to the page.

## Why the Same-Origin Policy Exists

The same-origin policy is the rule that makes the web safe. If any page could read any other page you visited, a random tab at `https://evil.example` could read your webmail, your bank dashboard or your admin panel, then quietly exfiltrate the results.

![Diagram showing how the same-origin policy isolates pages from each other on the web](https://upload.wikimedia.org/wikipedia/commons/e/e7/Same_Origin_Policy.png)

So the browser draws a hard line around each origin. Cross-origin requests are still *sent* — the browser cannot pretend they do not exist — but the **response** is withheld from the calling script unless the server opts in via CORS headers.

CORS is the escape hatch for that rule, standardised as part of the Fetch Standard, which also underpins `fetch()` and XMLHttpRequest.

> **Note:** CORS grants a page the ability to *read* a cross-origin response. It does not grant the ability to *make* the request. A cross-origin `POST` can still mutate your database even if the browser blocks the response — which is exactly why CORS is not a substitute for CSRF protection or server-side authorization checks.

## Simple Requests vs. Preflighted Requests

The browser splits cross-origin requests into two categories, and the category determines how much work your server must do.

### Simple requests

A request is *simple* when both of the following hold:

- The HTTP method is `GET`, `HEAD` or `POST`.
- The only non-safelisted header sent is `Content-Type`, and its value is one of `application/x-www-form-urlencoded`, `multipart/form-data` or `text/plain`.

For a simple request, the browser sends the actual request straight away. The server adds `Access-Control-Allow-Origin` to the response and the browser checks it. One round trip, no `OPTIONS`. A `POST` with `Content-Type: text/plain` is the classic example.

### Preflighted requests

Anything else triggers a **preflight**: an automatic `OPTIONS` request the browser sends *before* the real request, asking the server "would you allow this?"

```javascript
// Preflighted: non-simple method OR non-simple content-type OR a custom header
const res = await fetch('https://api.example.com/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ sku: 'A-1', qty: 2 })
})
```

The browser sends:

```http
OPTIONS /orders HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: content-type, authorization
```

And expects a response granting the method and headers:

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: POST, GET, OPTIONS
Access-Control-Allow-Headers: content-type, authorization
Access-Control-Max-Age: 600
```

Only after the preflight succeeds does the browser send the real `POST`.

![The preflight round trip for a non-simple cross-origin request](https://raw.githubusercontent.com/ashwani983/ashwani983.github.io/main/assets/images/blog/cors-explained-cross-origin-resource-sharing-diagram-1.png)

![Flowchart comparing simple and preflighted XHR requests](https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Flowchart_showing_Simple_and_Preflight_XHR.svg/1280px-Flowchart_showing_Simple_and_Preflight_XHR.svg.png)

### Why preflights are worth optimising

Every preflight is an extra round trip on the critical path. Preflights are cached per (origin, URL, method, headers) tuple, and the server controls the cache lifetime with `Access-Control-Max-Age`. Browsers cap that value — Chrome clamps it at two hours, Safari is stricter — so treat anything above ten minutes as approximate.

Two common sources of accidental preflights:

- **A custom header** such as `Authorization`, `X-Api-Key` or `X-Request-Id`.
- **`Content-Type: application/json`**, which is *not* one of the three simple types.

You cannot avoid a preflight for those requests — but you can avoid *repeated* preflights with a sensible `Access-Control-Max-Age`.

## The Response Headers That Decide Everything

| Header | Direction | Purpose |
| --- | --- | --- |
| `Access-Control-Allow-Origin` | Response | Which origin may read the response: `*` or one exact origin. |
| `Access-Control-Allow-Methods` | Response (preflight) | Methods permitted, e.g. `GET, POST, PUT, DELETE`. |
| `Access-Control-Allow-Headers` | Response (preflight) | Request headers the client may send, e.g. `content-type, authorization`. |
| `Access-Control-Expose-Headers` | Response | Which *response* headers JavaScript may read (e.g. `X-Total-Count`). |
| `Access-Control-Allow-Credentials` | Response | Whether cookies/TLS client certs may be included. Requires an explicit origin, never `*`. |
| `Access-Control-Max-Age` | Response (preflight) | How long the browser may cache this preflight result, in seconds. |
| `Origin` | Request | The origin of the caller. |
| `Vary: Origin` | Response | Tells caches the response varies by origin. |

A few subtleties that trip people up:

- **`Access-Control-Expose-Headers` only affects response headers.** A custom header like `X-Total-Count` is invisible to `fetch()` unless you expose it. `Content-Type`, `Content-Language`, `Cache-Control`, `Expires`, `Last-Modified` and `ETag` are exposed by default.
- **`Vary: Origin` is not optional** when your server reflects the request's `Origin` back. Without it, a shared cache can serve one origin's response to another origin, producing intermittent, hard-to-reproduce bugs.
- **`Allow-Methods` and `Allow-Headers` are only consulted during preflight.** Including them on a normal response is harmless but pointless.
- **`Origin` is not `Referer`.** `Origin` can be `null` for sandboxed iframes, `file://` pages and some redirect chains. If your allowlist contains `null`, you have effectively allowed sandboxed and local documents.

## Walking Through a Real CORS Failure

Imagine a dashboard SPA at `https://app.example.com` calling an API at `https://api.example.com` with a bearer token. The API is correct, the token is valid, and the endpoint returns `200 OK` to `curl`. The browser console says:

```text
Blocked a request to 'https://api.example.com/orders' from origin
'https://app.example.com' to be blocked by CORS policy: Request header
field authorization is not allowed by Access-Control-Allow-Headers
in preflight response.
```

The error names the problem precisely: the preflight response is missing `Access-Control-Allow-Headers: authorization`.

### Step 1: Reproduce the preflight outside the browser

This is the single most useful debugging habit — reproduce the preflight exactly as the browser sends it:

```bash
curl -i -X OPTIONS https://api.example.com/orders \
  -H "Origin: https://app.example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type, authorization"
```

If this response lacks the right headers, no amount of frontend tweaking will help.

### Step 2: Answer the preflight correctly

```http
HTTP/2 204
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: content-type, authorization
Access-Control-Max-Age: 600
Vary: Origin
```

### Step 3: Make sure the real response agrees

A common and confusing failure: the preflight passes but the actual response fails. The real response must carry `Access-Control-Allow-Origin` too — plus `Access-Control-Allow-Credentials: true` when credentials are involved.

## Credentials, Cookies and the Wildcard Trap

Credentialed requests change the rules in two ways.

**First, the wildcard dies.** When the request includes cookies, HTTP authentication or TLS client certificates, the browser rejects `Access-Control-Allow-Origin: *`. The server must echo the exact origin:

```http
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Credentials: true
Vary: Origin
```

**Second, the client must opt in.** `fetch` sends credentials only when asked, and classic XHR exposes the same switch as `withCredentials = true`:

```javascript
const res = await fetch('https://api.example.com/session', {
  credentials: 'include'
})
```

### The SameSite interaction

CORS and `SameSite` are separate layers, and both must be satisfied:

- `SameSite=Lax` (the modern default) means cookies are **not** sent on cross-site `fetch()` calls, only on top-level GET navigations. A cross-site XHR to your API will arrive without cookies no matter how generous your CORS headers are.
- `SameSite=None` allows the cookie on cross-site requests, but modern browsers require the `Secure` attribute, so it only works over HTTPS.

### A misconfiguration that removes authentication

Reflecting any origin while allowing credentials is the classic CORS bug:

```javascript
// VULNERABLE: effectively hands your logged-in session to any site
app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true
}))
```

Any page on the internet can then issue authenticated requests to your API using the victim's cookies, read the responses, and exfiltrate data. That is an account takeover primitive, not a theoretical concern.

## Configuring CORS Across the Stack

### Node.js and Express

```javascript
const cors = require('cors')

const ALLOWED_ORIGINS = new Set([
  'https://app.example.com',
  'https://admin.example.com'
])

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser callers (no Origin header) and allowlisted origins
    if (!origin || ALLOWED_ORIGINS.has(origin)) return callback(null, true)
    return callback(new Error(`CORS rejected for origin: ${origin}`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 600,
  optionsSuccessStatus: 204
}))
```

Note `exposedHeaders` — it maps to `Access-Control-Expose-Headers`, one of the most commonly forgotten settings.

### FastAPI

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://app.example.com"],   # never use ["*"] with credentials
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    expose_headers=["X-Total-Count"],
    max_age=600,
)
```

### Spring Boot

```java
@RestController
@RequestMapping("/api/orders")
@CrossOrigin(
    origins = "https://app.example.com",
    methods = { "GET", "POST", "OPTIONS" },
    allowedHeaders = { "Content-Type", "Authorization" },
    exposedHeaders = { "X-Total-Count" },
    allowCredentials = "true",
    maxAge = 600
)
public class OrderController { /* ... */ }
```

Django does not ship CORS support; the community package `django-cors-headers` does, via `CORS_ALLOWED_ORIGINS` in `settings.py`.

## The Proxy Pattern: Avoiding CORS Entirely

There is a third option that is often the best one: never make the request cross-origin at all. If your frontend and API are served from the same origin — via a reverse proxy, an edge function or a backend-for-frontend — the same-origin policy never triggers and there are no CORS headers to maintain.

![Direct cross-origin calls versus a same-origin reverse proxy](https://raw.githubusercontent.com/ashwani983/ashwani983.github.io/main/assets/images/blog/cors-explained-cross-origin-resource-sharing-diagram-2.png)

Against a direct cross-origin call, a proxy removes the preflight, lets you use ordinary same-origin cookies instead of `SameSite=None`, collapses CORS configuration to one place at the edge, and gives you a single host and log stream to debug.

A typical Nginx proxy for this pattern:

```nginx
server {
    listen 443 ssl;
    server_name app.example.com;
    root /srv/app;

    location / { try_files $uri /index.html; }

    location /api/ {
        proxy_pass http://api_upstream/v1/;
        proxy_set_header Host api.example.com;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

The frontend then simply calls `/api/orders`, which is same-origin. Serverless platforms offer similar primitives — API Gateway HTTP APIs, Cloudflare Workers, Vercel rewrites and Next.js rewrites all forward requests without a browser-visible origin change.

## CORS for Static Assets, Fonts and WASM

CORS is not only about API calls. Several asset types have their own cross-origin rules:

- **Web fonts** loaded from a CDN must be served with `Access-Control-Allow-Origin`, or the font silently fails to load.
- **`crossorigin` scripts** — adding `crossorigin="anonymous"` to a `<script>` tag (usually alongside Subresource Integrity) makes the browser CORS-check the script.
- **Web workers** created from a cross-origin script URL require CORS headers.
- **WebAssembly** fetched via `WebAssembly.instantiateStreaming()` requires CORS headers on the `.wasm` response.
- **`SharedArrayBuffer`** and precise timers require the separate cross-origin isolation headers `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.

For genuinely public, content-addressed assets a permissive policy is usually right:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, HEAD, OPTIONS
```

## Security Misconfigurations to Avoid

> **Caution:** `Access-Control-Allow-Origin: *` together with `Access-Control-Allow-Credentials: true` is rejected by browsers, and echoing `Access-Control-Allow-Origin: null` permits requests from sandboxed iframes and local files — a common way to slip past a naive allowlist.

The mistakes that show up most often:

1. **Reflecting any origin with credentials enabled.** Allows any website to act as the logged-in user. Always use an explicit allowlist.
2. **Forgetting `Vary: Origin`.** Caches serve the wrong CORS response to the wrong origin, producing bugs that only appear for some users.
3. **Allowing `null`.** Treat it as a public, untrusted origin.
4. **Believing CORS protects the API.** Any non-browser client ignores it entirely; enforce authorization on the server for every request.
5. **Using CORS instead of CSRF defence.** A form POST from a malicious page still reaches your server. Keep CSRF tokens and `SameSite` cookies.
6. **Debugging with `no-cors` mode.** `fetch(url, { mode: 'no-cors' })` returns an opaque response with no readable body and no error — it hides the problem instead of solving it.
7. **CORS headers only on 200 responses.** Error responses (4xx/5xx) need them too, or the browser reports a confusing CORS error instead of the real status.

## Best-Practice Checklist

1. Prefer a **reverse proxy** when you control the deployment; it removes the problem instead of permitting it.
2. Maintain an **explicit allowlist** of origins — never reflect arbitrary ones.
3. Use `Access-Control-Allow-Origin: *` only for **public, unauthenticated** resources.
4. Always send **`Vary: Origin`** alongside a specific allowlisted origin.
5. Handle **`OPTIONS` requests** in every code path, including at the gateway, or preflights will 404/405.
6. Set **`Access-Control-Max-Age`** to a sensible value (600 seconds is a good default) to reduce preflight chatter.
7. Preflight responses must **not** be a redirect; handle HTTP-to-HTTPS redirects explicitly.
8. **Test preflights with `curl`** in CI so header regressions are caught before the browser finds them.
9. Keep CORS configuration in **one place** per service, driven by environment configuration.

## Key Takeaways

- An origin is `scheme + host + port`; anything different is cross-origin, and CORS is the browser's permission check for cross-origin responses.
- Simple requests (`GET`/`HEAD`/`POST` with safelisted headers and content types) go straight to the server; everything else triggers an `OPTIONS` preflight.
- The decision is made by `Access-Control-Allow-Origin`, refined by `Allow-Methods`, `Allow-Headers`, `Expose-Headers`, `Allow-Credentials` and `Max-Age`.
- Credentials and the `*` wildcard are mutually exclusive — with cookies you must echo the exact origin and add `Vary: Origin`.
- CORS is enforced only by browsers and is only about *reading* responses; it is neither authentication nor CSRF protection, and the request itself still executes on your server.
- A same-origin reverse proxy eliminates CORS entirely, and `curl -X OPTIONS` is the fastest way to debug a failing preflight.

## Frequently Asked Questions

**Does CORS stop other people from calling my API?**
No. A `curl` command, a Python script or a mobile app can call your API regardless of your CORS headers. Authorization must be enforced server-side.

**Why does my API work in Postman but fail in the browser?**
Postman and similar tools do not enforce CORS; the browser does. The API server is probably missing the appropriate `Access-Control-Allow-*` headers.

**Should I ever use `Access-Control-Allow-Origin: *`?**
Yes, for public resources that do not depend on the caller's identity — web fonts, CDN-hosted WASM, public image or JSON assets, and anonymous read-only APIs. Never for user-specific endpoints, and never together with `Access-Control-Allow-Credentials: true`.

**Why is my preflight returning 404 or 405?**
The server is not handling `OPTIONS` for that route. Many frameworks and API gateways only register the methods you declared, so make sure `OPTIONS` is routed, or handle it in middleware before the route matcher.

**Does CORS protect against CSRF?**
No. CORS governs whether the *response* can be read; it does not stop the request from being sent or taking effect. Keep CSRF tokens, `SameSite` cookies and server-side authorization.

## Related Articles

- OAuth 2.0 and OpenID Connect Explained: The Complete Guide to Modern Authentication and Authorization
- WebSockets Explained: A Complete Guide to Real-Time Communication
- HTTP Status Codes Every API Tester Should Know
- gRPC Essentials: A Practical Guide to High-Performance Remote Procedure Calls
