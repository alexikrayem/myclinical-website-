# Authentication & Session Flows

This page provides sequence flow models for registration, login, and authorization validation within the MyClinical platform.

---

## 1. User Registration Flow

Illustrates standard phone registration, database initialization, and compensating rollbacks upon session failure.

```mermaid
sequenceDiagram
    autonumber
    actor Client as User Client
    participant API as Backend Server
    participant DB as Supabase DB
    participant Cache as Redis Cache

    Client->>API: POST /api/auth/register { phone_number, password, display_name }
    Note over API: Normalize Phone Number<br/>(Strip symbols, parse digits)
    API->>DB: Query User existence by phone_number
    DB-->>API: No matching record found
    
    Note over API: Hash Password (bcrypt cost=12)
    API->>DB: Insert User with hashed password
    DB-->>API: Created record ID (User UUID)
    
    API->>DB: Verify User actually exists
    DB-->>API: User Record returned
    
    API->>DB: Insert Default Credits (user_credits table)
    DB-->>API: Record created
    
    Note over API: Generate local JWT
    Note over API: Capture User-Agent and Request IP
    
    rect rgb(255, 235, 235)
        Note over API, DB: Session Creation & Fallback
        API->>DB: Insert Session (user_sessions table)
        alt Session Creation Fails
            DB-->>API: Error (DB connection crash/timeout)
            Note over API: Trigger Compensating Transaction
            API->>DB: DELETE FROM user_credits WHERE custom_user_id = User UUID
            API->>DB: DELETE FROM users WHERE id = User UUID
            API-->>Client: HTTP 500 Session Create Failed (Registrations wiped)
        else Session Creation Succeeds
            DB-->>API: Session Created (ID generated)
        end
    end
    
    API-->>Client: HTTP 201 Created (Set-Cookie: user_session=<JWT>)
```

---

## 2. Customer & Admin Login Flows

Illustrates authentication, Redis integration, and rate limiting protections.

### Customer Login Flow
```mermaid
sequenceDiagram
    autonumber
    actor Client as User Client
    participant API as Backend Server
    participant Cache as Redis Cache
    participant DB as Supabase DB

    Client->>API: POST /api/auth/login { phone_number, password }
    Note over API: Normalize Phone Number
    
    API->>Cache: GET login_attempts:<normalizedPhone>:<IP>
    Cache-->>API: Returned attempt count (current < 5)
    
    API->>DB: Fetch User password_hash, status by phone_number
    DB-->>API: User Record returned (is_active = true)
    
    Note over API: Validate Password with bcrypt
    
    alt Password Match Successful
        API->>Cache: DEL login_attempts:<normalizedPhone>:<IP>
        Note over API: Generate User JWT Token
        API->>DB: Insert session state into user_sessions
        DB-->>API: Success
        API->>DB: Update last login / updated_at
        API-->>Client: HTTP 200 Success (Set-Cookie: user_session=<JWT>)
    else Password Match Fails
        API->>Cache: Increment login_attempts:<normalizedPhone>:<IP> (TTL=15m)
        alt Attempt Count >= 5
            API->>Cache: Set lockedUntil timestamp in memory
            API-->>Client: HTTP 429 Account Locked (15 minutes)
        else Attempt Count < 5
            API-->>Client: HTTP 401 Unauthorized (Invalid password, X remaining attempts)
        end
    end
```

### Admin Login Flow
```mermaid
sequenceDiagram
 autonumber
    actor Admin as Admin Dashboard
    participant API as Backend Server
    participant SupaAuth as Supabase GoTrue
    participant DB as Postgres Admins Table
    participant Cache as Redis Cache

    Admin->>API: POST /api/admin/login { email, password }
    API->>Cache: Check lockout attempts:<email>:<IP>
    Cache-->>API: Allowed
    
    API->>SupaAuth: signInWithPassword({ email, password }) (Anon Client)
    
    alt Credentials Invalid
        SupaAuth-->>API: Error (Invalid Credentials)
        API->>Cache: Increment lockout count
        API-->>Admin: HTTP 401 Unauthorized
    else Credentials Valid
        SupaAuth-->>API: Auth Resolved (Supabase User UUID + session dataset)
        
        API->>DB: Query Admin role by verified UUID
        alt UUID not in Admins Table
            DB-->>API: Record Null
            API-->>Admin: HTTP 403 Forbidden (Access Denied)
        else UUID exists
            DB-->>API: Admin Info & Role
            API->>Cache: Reset lockout attempts
            API-->>Admin: HTTP 200 Success (Set-Cookie: session=<SupaAccessToken>)
        end
    end
```

---

## 3. Session Verification & Cookie Interceptors

Shows the token validation pipeline and Axios automated interception.

```mermaid
sequenceDiagram
    autonumber
    actor Web as Frontend Browser
    participant Interceptor as Axios Interceptor
    participant API as Backend Server
    participant Cache as Redis Cache
    participant DB as Supabase DB

    Web->>Interceptor: Request protected endpoint (e.g., /api/auth/profile)
    Note over Interceptor: Attaches cookies automatically (withCredentials=true)
    Interceptor->>API: Send request with cookie
    Note over API: Compute SHA-256 hash or token
    
    API->>Cache: Check cacheKey session:<tokenHash> or auth_token_v1:<tokenHash>
    alt Cache Hit
        Cache-->>API: Cached User details
    else Cache Miss
        API->>DB: Query session state (or Supabase auth if admin)
        alt Session Valid & Active
            DB-->>API: Valid session / auth details
            API->>Cache: Cache session details (TTL 5m user / 1m admin)
        else Session Expired / Revoked
            DB-->>API: Session dead or revoked
            API-->>Interceptor: HTTP 403 Session Expired (returns INVALID_TOKEN/SESSION_EXPIRED)
        end
    end

    alt Session Verified
        API-->>Interceptor: HTTP 200 Data Payload
        Interceptor-->>Web: Success page rendering
    else Session Expired (HTTP 403)
        Note over Interceptor: Detects target status code (401/403)<br/>& dead-session flag
        Interceptor->>Interceptor: Dispatch custom event (auth:session-expired)
        Note over Web: App catches event & resets Local Context (auto-shows Login Modal)
    end
```

---

## 4. Session Revocation Flows (Logout / Logout-All)

Illustrates database cleanup and Redis cache clearing.

### Logout Flow
```mermaid
sequenceDiagram
    autonumber
    actor Client as Client Browser
    participant API as Backend Server
    participant DB as Supabase DB
    participant Cache as Redis Cache

    Client->>API: POST /api/auth/logout (Authenticated context)
    API->>DB: Get session token_hash for current req.sessionId
    DB-->>API: Return token_hash
    
    API->>DB: UPDATE user_sessions SET is_active = false WHERE id = req.sessionId
    DB-->>API: Success
    
    API->>Cache: DEL session:<token_hash>
    Cache-->>API: Success
    
    API-->>Client: HTTP 200 (Clear-Cookie: user_session)
```

### Logout-All Flow
```mermaid
sequenceDiagram
    autonumber
    actor Client as Client Browser
    participant API as Backend Server
    participant DB as Supabase DB
    participant Cache as Redis Cache

    Client->>API: POST /api/auth/logout-all (Authenticated context)
    API->>DB: SELECT token_hash FROM user_sessions WHERE user_id = req.user.id AND is_active = true
    DB-->>API: List of token hashes [hash1, hash2, ...]
    
    API->>DB: UPDATE user_sessions SET is_active = false WHERE user_id = req.user.id
    DB-->>API: Success
    
    Note over API: Map hashes to Redis keys:<br/>[session:hash1, session:hash2, ...]
    API->>Cache: DEL session:hash1 session:hash2 ...
    Cache-->>API: Success
    
    API-->>Client: HTTP 200 (Clear-Cookie: user_session)
```
