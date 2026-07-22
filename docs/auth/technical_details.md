# Technical Details & Security Safeguards

This document covers route middleware, brute-force lockout prevention, browser cookie security, and session management fail-closed safety systems.

---

## 1. Route Authentication Middleware

The MyClinical backend employs three dedicated middleware hooks to resolve security contexts:

### `authenticateUser` (User Auth Middleware)
1. **Token Resolution**: Inspects the HTTP request in a strict priority:
   - First targets the `user_session` read-only HTTP cookie.
   - If absent, checks the HTTP `Authorization: Bearer <JWT>` header (used by mobile apps and testing scripts).
2. **JWT Decoding**: Decodes the token using the local `JWT_SECRET`. If signature verification fails, returns `403 Token Expired` or `403 Invalid Token`.
3. **Redis Session Check**: Hashes the token using SHA-256 and searches for `session:<hash>` in Redis.
   - **Cache Hit**: Attaches `req.user` and `req.sessionId` then passes control to `next()`.
   - **Cache Miss**: Queries the Postgres database `user_sessions` table JOINed with the `users` table where `token_hash = hash` and `is_active = true` and `expires_at > NOW()`.
4. **Validation & Refresh**:
   - If the session is inactive or expired, blocks the request (`403 Session Expired`).
   - If the user's `is_active` flag in the users table is false, blocks access (`403 Account Disabled`).
   - If validator checks assert successfully, saves the dataset in Redis for 300 seconds and resolves the request context.

### `optionalAuth` (Soft User Middleware)
Performs identical validation checks to `authenticateUser`, but rather than terminating requests with a `401` or `403` status upon invalidation or token absence, it silently clears `req.user` to `null` and calls `next()`. This is used on public content feeds (such as articles or courses) where optional user attributes customize the layout but do not govern raw access.

### `authenticateToken` (Admin Middleware)
1. **Token Resolution**: Inspects `Authorization: Bearer <Token>` or the `session` cookie.
2. **Redis Check**: Hashes the token and checks Redis for `auth_token_v1:<hash>`.
3. **Supabase Verification**: If cache misses, calls `supabasePublic.auth.getUser()`, which validates the token cryptographically against GoTrue.
4. **Authorization**: Queries the local `admins` table for the resolved User ID. If no matching row is returned, access is denied (`403 Forbidden`). Caches positive results in Redis for 60 seconds.

---

## 2. Lockout Protections & Rate Limiting

To balance protection against brute-force attacks with availability, MyClinical implements a distributed rate limiter in Redis to mitigate targeted Account-Lockout Denial of Service (DOS).

```
Login Request ──> Compute Composite Identifier (Identifier + IP)
                                 │
                                 ▼
                     Check Limit Status in Redis
                                 │
                 ┌───────────────┴───────────────┐
             [Locked]                        [Allowed]
                 │                               │
                 ▼                               ▼
          429 Rate Limited             Forward to Password Check
                                                 │
                                         ┌───────┴───────┐
                                      [Success]       [Failure]
                                         │               │
                                         ▼               ▼
                                    Clear Limit    Increment counter + 
                                                   Lock if >= 5 attempts
```

### Composite Identifier Locking
- **Standard Lockout Problem**: Lockouts based solely on an identifier (e.g., standard phone number) allow malicious attackers to lock legitimate users out of their accounts.
- **MyClinical Mitigation**: Keys are stored as a composite hash matching both the login identifier and the client's request IP:
  ```javascript
  const key = `login_attempts:${identifier.toLowerCase()}:${ip.replace(/[^\w.:]/g, '_')}`;
  ```
- **Thresholds**: 
  - Allows 5 consecutive incorrect inputs.
  - Upon matching 5 failed attempts, sets `lockedUntil` for **15 minutes**.
  - Subsequent requests from that specific IP for that account are blocked with a `429 Account Locked` response.
  - Attackers on separate IPs cannot exhaust another user's attempt limit.

### Fail-Closed Redis Configuration
If the Redis database is unreachable:
- Rate limits cannot be validated safely.
- **Security Posture**: Fail-closed (M5 audit fix).
- Rather than bypassing checks (fail-open), `checkLoginAllowed` and `trackLoginAttempt` block logins immediately, returning `503 Service Unavailable` with details to the client. This protects against brute-force attacks during redis failovers.

---

## 3. Cookie Configuration (CSRF & XSS Mitigation)

To prevent Cross-Site Scripting (XSS) token-theft and Cross-Site Request Forgery (CSRF) session hijackings, authentication tokens are delivered via state-protected cookies.

```javascript
const USER_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
};
```

- `httpOnly: true`: Prevents client-side scripts (such as `document.cookie` queries) from accessing the session token, mitigating XSS.
- `secure: true`: Restricts cookie transfer to SSL/TLS-encrypted HTTPS connections (disabled for local HTTP development).
- `sameSite: 'strict'`: Restricts token dispatch to same-site navigations, protecting the site against CSRF vulnerabilities.

---

## 4. Compensating Transactions (Zombie Record Prevention)

Actions like user registration change states across multiple schemas and storage engines. To prevent partial state failures (which create corrupt or "zombie" entries), endpoints use compensating transactions.

```
                    ┌─────────────────────────┐
                    │  1. Create User in DB   │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │  2. Allocate Credits    │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │  3. Create Session      │
                    └────────────┬────────────┘
                                 │
                 ┌───────────────┴───────────────┐
             [Success]                       [Failure]
                 │                               │
                 ▼                               ▼
           Commit Session            [COMPENSATING TRANSACTION]
                                     - Delete Credits record
                                     - Delete User record
                                     - Clear uploaded file (if doctor)
                                     - Return 500 error
```

### Standard Register Transaction
During `/api/auth/register`, if the database inserts the user and credits but session setup fails:
- The backend catches the error.
- Asserts a compensating transaction by deleting the newly created credits row.
- Deletes the newly created user record.
- Ensures the system remains clean, preventing users from registering with unusable credentials.

### Doctor Register Transaction
During `/api/auth/register-doctor`, physical storage additions (professional syndicate ID card images) are uploaded to a private bucket `syndicate-cards` via the dashboard admin client:
- If DB user insertion or session creation fails, the server:
  1. Issues a DELETE query targeting the user's credits.
  2. Deletes the user database record.
  3. Triggers storage cleanups via `supabaseAdmin.storage.from('syndicate-cards').remove([path])` to remove orphan files.
