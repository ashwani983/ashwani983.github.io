---
title: OAuth 2.0 and OpenID Connect Explained: The Complete Guide to Modern Authentication and Authorization
date: 2026-09-02
slug: oauth-2-0-and-openid-connect-explained
tags: [OAuth 2.0, OpenID Connect, Authentication, Authorization, Security, API Security]
category: Others
excerpt: A comprehensive guide to OAuth 2.0 and OpenID Connect covering flows, tokens, best practices, and real-world implementation patterns for modern apps.
readTime: 12 min read
published: true
---

# OAuth 2.0 and OpenID Connect Explained: The Complete Guide to Modern Authentication and Authorization

Every time you click "Sign in with Google" or authorize a third-party app to access your GitHub repositories, you are using OAuth 2.0 and OpenID Connect under the hood. These two protocols have become the backbone of modern identity and access management on the web, powering everything from mobile apps and single-page applications to microservices and machine-to-machine communication.

Yet despite their ubiquity, OAuth 2.0 and OpenID Connect remain widely misunderstood. Developers often conflate the two, misuse grant types, or overlook critical security pitfalls that can expose user data. This guide breaks down both protocols from first principles, explains how they work together, and provides actionable guidance for implementing them correctly in production.

## Table of Contents

- [Understanding the Problem: Authentication vs. Authorization](#understanding-the-problem-authentication-vs-authorization)
- [What is OAuth 2.0?](#what-is-oauth-20)
- [OAuth 2.0 Grant Types](#oauth-20-grant-types)
- [What is OpenID Connect?](#what-is-openid-connect)
- [How OAuth 2.0 and OIDC Work Together](#how-oauth-20-and-oidc-work-together)
- [Token Types and Their Lifecycle](#token-types-and-their-lifecycle)
- [Security Best Practices and Common Pitfalls](#security-best-practices-and-common-pitfalls)
- [Real-World Implementation Example](#real-world-implementation-example)
- [Key Takeaways](#key-takeaways)
- [Frequently Asked Questions](#frequently-asked-questions)

## Understanding the Problem: Authentication vs. Authorization

Before diving into protocols, it is critical to understand two distinct concepts that are often confused:

- **Authentication (AuthN):** Verifying *who* the user is. "Is this person actually Alice?"
- **Authorization (AuthZ):** Determining *what* the user is allowed to do. "Can Alice access Bob's private repository?"

OAuth 2.0 is an **authorization** framework. It does not inherently tell you who the user is — it tells you what a client application is permitted to do on behalf of a user. OpenID Connect (OIDC) is a thin **authentication** layer built on top of OAuth 2.0 that fills this gap.

> **Important:** OAuth 2.0 alone should never be used for authentication. Using an OAuth 2.0 access token to derive user identity is a well-documented security vulnerability. Always layer OpenID Connect on top when you need to verify user identity.

## What is OAuth 2.0?

OAuth 2.0 is an authorization framework defined in [RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749) that allows a third-party application to obtain limited access to an HTTP service on behalf of a resource owner. Instead of sharing credentials, the user grants the application delegated access through a series of defined flows.

### Core Roles

| Role | Description | Example |
|------|-------------|---------|
| **Resource Owner** | The entity (usually a user) who owns the protected data | You, the GitHub user |
| **Client** | The application requesting access to the resource | A CI/CD tool requesting repo access |
| **Authorization Server** | The server that authenticates the resource owner and issues tokens | GitHub's OAuth server |
| **Resource Server** | The server hosting the protected resources | GitHub's API servers |

### The High-Level Flow

At a high level, every OAuth 2.0 interaction follows this pattern:

1. The **Client** redirects the **Resource Owner** to the **Authorization Server**.
2. The Resource Owner authenticates and grants consent.
3. The Authorization Server issues tokens back to the Client.
4. The Client uses those tokens to access protected resources on the **Resource Server**.

```mermaid
sequenceDiagram
    participant RO as Resource Owner (User)
    participant Client as Client App
    participant AS as Authorization Server
    participant RS as Resource Server

    Client->>RO: Redirect to Authorization Server
    RO->>AS: Authenticate & Grant Consent
    AS->>Client: Issue Authorization Code
    Client->>AS: Exchange Code for Tokens
    AS->>Client: Access Token + ID Token (OIDC)
    Client->>RS: Request with Access Token
    RS->>Client: Protected Resource
```

## OAuth 2.0 Grant Types

OAuth 2.0 defines several grant types (also called flows) to accommodate different client types and use cases. Selecting the correct grant type is one of the most important decisions in your implementation.

### Authorization Code Grant

The most common and recommended flow for most applications. The client receives a short-lived authorization code that it exchanges server-side for tokens.

**Best for:** Web applications, SPAs (with PKCE), mobile apps, server-side applications.

```text
Authorization Request:
GET /authorize?
  response_type=code
  &client_id=YOUR_CLIENT_ID
  &redirect_uri=https://yourapp.com/callback
  &scope=openid profile email
  &state=随机防CSRF令牌

Token Exchange:
POST /token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=AUTHORIZATION_CODE
&redirect_uri=https://yourapp.com/callback
&client_id=YOUR_CLIENT_ID
&client_secret=YOUR_CLIENT_SECRET
```

### Authorization Code with PKCE

Proof Key for Code Exchange (PKCE, pronounced "pixy") is an extension that secures the authorization code flow for public clients (mobile apps, SPAs, CLI tools) that cannot safely store a client secret. PKCE is now **strongly recommended** for all clients, including confidential ones, per the latest OAuth 2.1 draft.

**Best for:** Single-page applications, mobile apps, CLI tools, any public client.

### Client Credentials Grant

Used for machine-to-machine (M2M) communication where no user is involved. The client authenticates directly with the authorization server using its own credentials.

**Best for:** Microservice-to-microservice calls, background jobs, daemons.

```text
POST /token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=service_a_id
&client_secret=service_a_secret
&scope=read:data write:data
```

### Implicit Grant (Deprecated)

Historically used for SPAs running entirely in the browser. This flow returns tokens directly in the URL fragment, which is now considered insecure due to token leakage risks.

> **Caution:** The Implicit grant is deprecated as of OAuth 2.1. If you are still using it, migrate to Authorization Code with PKCE. The Implicit flow exposes tokens in the browser's URL bar and history, making it vulnerable to token interception.

### Device Authorization Grant

Designed for input-constrained devices such as smart TVs, CLI tools, or IoT devices that cannot easily handle browser-based redirects. The device displays a code that the user enters on a separate device with a browser.

**Best for:** Smart TVs, gaming consoles, IoT devices, CLI tools.

## What is OpenID Connect?

OpenID Connect (OIDC) is an identity layer built on top of OAuth 2.0. While OAuth 2.0 tells the client *what it can do*, OIDC tells the client *who the user is*. It does this by introducing a new token type — the **ID Token** — and a **UserInfo endpoint** for fetching user profile data.

### How OIDC Extends OAuth 2.0

When you include `openid` in the `scope` parameter of an OAuth 2.0 authorization request, you are invoking OpenID Connect. The authorization server responds with an additional **ID Token** alongside the access token.

The ID Token is a [JSON Web Token (JWT)](https://datatracker.ietf.org/doc/html/rfc7519) that contains standardized claims about the user:

```json
{
  "iss": "https://auth.example.com",
  "sub": "user-12345",
  "aud": "your-client-id",
  "exp": 1725312000,
  "iat": 1725225600,
  "nonce": "abc123",
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "picture": "https://cdn.example.com/alice.jpg"
}
```

### Key OIDC Claims

| Claim | Description |
|-------|-------------|
| `iss` | Issuer — the authorization server that issued the token |
| `sub` | Subject — the unique identifier for the user |
| `aud` | Audience — the intended recipient(s) of the token |
| `exp` | Expiration time (Unix timestamp) |
| `iat` | Issued-at time (Unix timestamp) |
| `nonce` | A value used to prevent replay attacks |
| `email` | The user's email address (if the `email` scope was requested) |
| `name` | The user's display name (if the `profile` scope was requested) |

### OIDC Scopes

OIDC defines three standard scopes that control which claims are returned:

- **`openid`** — Required. Enables OIDC and returns the `sub` claim.
- **`profile`** — Returns claims like `name`, `family_name`, `given_name`, `picture`, `locale`.
- **`email`** — Returns `email` and `email_verified`.

## How OAuth 2.0 and OIDC Work Together

In practice, most modern authentication systems use both protocols simultaneously. A typical sign-in flow looks like this:

```mermaid
flowchart TD
    A[User Clicks Sign In] --> B[Client Redirects to Auth Server]
    B --> C{User Authenticated?}
    C -->|No| D[Login Page Displayed]
    D --> E[User Submits Credentials]
    E --> F[Auth Server Validates]
    C -->|Yes| G[Consent Screen]
    F --> G
    G --> H[Auth Server Issues Tokens]
    H --> I[ID Token - Verify User Identity]
    H --> J[Access Token - Access Resources]
    H --> K[Refresh Token - Get New Access Tokens]
    I --> L[Client Creates User Session]
    J --> M[Client Calls Protected APIs]
    K --> N[Silent Token Renewal]
```

The key insight is that **OIDC authenticates the user while OAuth 2.0 authorizes the application**. Together, they provide a complete identity and access management solution without ever exposing the user's credentials to the client application.

## Token Types and Their Lifecycle

Understanding tokens and their lifecycles is essential for secure implementation.

### Access Token

The access token is a credential used to access protected resources. It is typically short-lived (5–60 minutes) and is sent in the `Authorization` header of HTTP requests.

```text
GET /api/user/profile HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

Access tokens can be opaque strings (random tokens that only the authorization server can validate) or JWTs (self-contained tokens that the resource server can validate locally).

### ID Token

The ID Token is an OIDC-specific JWT that carries identity claims about the user. It is meant for the client application to consume — not for accessing APIs. It should never be sent to a resource server as an access credential.

### Refresh Token

Refresh tokens are long-lived credentials used to obtain new access tokens without requiring the user to re-authenticate. They are stored securely on the server side and are vulnerable if leaked.

### Token Lifecycle Best Practices

| Practice | Rationale |
|----------|-----------|
| Keep access tokens short-lived (5–15 min) | Limits the window of exposure if a token is compromised |
| Rotate refresh tokens on use | Prevents replay attacks with stolen refresh tokens |
| Store tokens server-side when possible | Prevents client-side token theft (XSS, local storage exposure) |
| Validate all token claims on every request | Ensures tokens have not expired, been revoked, or been issued for a different audience |
| Use token revocation endpoints | Allows immediate invalidation when a user logs out or a breach is detected |

## Security Best Practices and Common Pitfalls

### Always Validate the `state` Parameter

The `state` parameter in the authorization request is your primary defense against Cross-Site Request Forgery (CSRF) attacks. Always generate a cryptographically random `state` value, store it in the user's session, and verify it when the authorization server redirects back to your application.

### Never Store Secrets in Client-Side Code

Public clients (SPAs, mobile apps) cannot securely store client secrets. Use PKCE instead of client secrets for public clients. For server-side applications, keep client secrets in environment variables or a secrets manager — never in source code.

### Use PKCE for All Flows

The OAuth 2.1 specification strongly recommends PKCE for all clients, even confidential ones. PKCE prevents authorization code injection attacks and adds a layer of defense even when the client secret is compromised.

### Validate Issuer and Audience

Always verify that the `iss` claim in a JWT matches your expected authorization server and that the `aud` claim contains your client ID. Without these checks, an attacker could use a token issued for a different application.

### Implement Token Revocation

OAuth 2.0 does not inherently provide token revocation. Implement the [Token Revocation endpoint (RFC 7009)](https://datatracker.ietf.org/doc/html/rfc7009) to allow users to log out and to invalidate compromised tokens.

### Scope Down Permissions

Request only the minimum scopes your application needs. If your app only needs to read a user's email, do not request `write` or `admin` scopes. This follows the principle of least privilege.

> **Key Takeaway:** Most OAuth 2.0 vulnerabilities stem from implementation errors, not protocol flaws. Always use a well-maintained library rather than implementing token handling from scratch. Libraries like `oidc-client-ts`, `Authlib`, and `Spring Security` have battle-tested security built in.

## Real-World Implementation Example

Consider a typical SaaS application that needs to let users sign in with Google and then access their Google Calendar on their behalf.

### Step 1: Register Your Application

Register your application in the Google Cloud Console. You will receive a `client_id` and `client_secret`. Configure the authorized redirect URI to point to your application's callback endpoint.

### Step 2: Initiate the Authorization Flow

When the user clicks "Sign in with Google," your server redirects them to Google's authorization endpoint:

```text
https://accounts.google.com/o/oauth2/v2/auth?
  response_type=code
  &client_id=YOUR_GOOGLE_CLIENT_ID
  &redirect_uri=https://yourapp.com/auth/callback
  &scope=openid email profile https://www.googleapis.com/auth/calendar.readonly
  &state=<random_string>&
  code_challenge=<sha256_hash_of_verifier>&
  code_challenge_method=S256
```

### Step 3: Handle the Callback

When Google redirects back to your app with an authorization code, exchange it for tokens:

```python
import requests
import hashlib
import base64

token_url = "https://oauth2.googleapis.com/token"
payload = {
    "grant_type": "authorization_code",
    "code": "YOUR_AUTHORIZATION_CODE",
    "redirect_uri": "https://yourapp.com/auth/callback",
    "client_id": "YOUR_GOOGLE_CLIENT_ID",
    "client_secret": "YOUR_GOOGLE_CLIENT_SECRET",
    "code_verifier": "YOUR_PKCE_VERIFIER"
}

response = requests.post(token_url, data=payload)
tokens = response.json()
# tokens contains: access_token, id_token, refresh_token, expires_in
```

### Step 4: Verify the ID Token and Create a Session

Decode the ID Token to extract the user's identity and create an application session. Use the `sub` claim as the unique user identifier.

### Step 5: Use the Access Token to Call APIs

```python
headers = {
    "Authorization": f"Bearer {tokens['access_token']}"
}
calendar_response = requests.get(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    headers=headers
)
calendars = calendar_response.json()
```

### Step 6: Handle Token Refresh

When the access token expires, use the refresh token to obtain a new one without requiring the user to sign in again:

```python
refresh_payload = {
    "grant_type": "refresh_token",
    "refresh_token": tokens["refresh_token"],
    "client_id": "YOUR_GOOGLE_CLIENT_ID",
    "client_secret": "YOUR_GOOGLE_CLIENT_SECRET"
}
new_tokens = requests.post(token_url, data=refresh_payload).json()
```

## Key Takeaways

- **OAuth 2.0 is for authorization; OpenID Connect is for authentication.** Never use OAuth 2.0 alone for user sign-in.
- **Always use Authorization Code flow with PKCE.** The Implicit and Resource Owner Password grants are deprecated and insecure.
- **Treat tokens as credentials.** Store them securely, validate them on every request, and keep access tokens short-lived.
- **Use a well-maintained library.** Rolling your own token handling introduces avoidable security risks.
- **Scope down permissions.** Request only the minimum scopes your application needs to function.
- **Implement token revocation and refresh token rotation.** These are not optional for production systems — they are security requirements.

## Frequently Asked Questions

### Is OAuth 2.0 the same as OpenID Connect?

No. OAuth 2.0 is an authorization framework that controls what a client application can access. OpenID Connect is an authentication layer built on top of OAuth 2.0 that verifies who the user is. In practice, most modern sign-in systems use both together.

### Which OAuth 2.0 grant type should I use?

For most applications, use the **Authorization Code flow with PKCE**. It is secure for both public clients (SPAs, mobile apps) and confidential clients (server-side apps). Use **Client Credentials** for machine-to-machine communication with no user involved. Avoid the Implicit grant entirely.

### Can I use access tokens for user authentication?

You should not. Access tokens are designed for API access, not for identifying users. Use ID Tokens (from OpenID Connect) to verify user identity. Access tokens may be opaque and lack the standardized claims needed for reliable authentication.

### How long should an access token be valid?

There is no single correct answer, but a common practice is **5 to 15 minutes**. Shorter lifetimes reduce the risk of token leakage. Use refresh tokens to silently renew access tokens for a seamless user experience.

### What happens if a refresh token is compromised?

If you detect or suspect a refresh token has been compromised, revoke it immediately using the authorization server's token revocation endpoint. Implement refresh token rotation so that each use of a refresh token generates a new one, making stolen tokens quickly invalid.

## Related Articles

- [Mastering Security Fundamentals: A Comprehensive Guide to Cybersecurity Basics](/mastering-security-fundamentals)
- [AWS Security Best Practices: A Practical Checklist for Protecting Your Cloud Environment](/aws-security-best-practices)
- [gRPC Essentials: A Practical Guide to High-Performance Remote Procedure Calls](/grpc-essentials)
- [System Design Handbook: A Practical Guide to Scalable Architectures](/system-design-handbook)
