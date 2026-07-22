# MyClinical Authentication Flow Documentation

Welcome to the end-to-end documentation for the MyClinical authentication system. This directory provides a deep technical review of how identification, session management, and authorization operate within the application.

## Directory Structure

This documentation is split into separate modules for readability and detail:

1. **[System Architecture](architecture.md)**
   Comprehensive review of the dual-system design, database schema tables, Row-Level Security (RLS), and two-tier Redis caching.
2. **[Technical Details & Security Safeguards](technical_details.md)**
   Details of backend middleware operations, dual-route rate limiting to prevent account lockouts, secure cookie settings, Axios interceptors, fail-closed Redis behaviors, and compensating transaction database rollbacks.
3. **[Sequence Flows & Logic Diagrams](flows.md)**
   Step-by-step visual models for user registration, user and admin logins, and multi-device session invalidations using Mermaid sequence flows.

---

## Codebase Map

When navigating or updating the authentication flows, consult the following key files:

| Component | Path | Description |
|---|---|---|
| **User Controller (API Routes)** | [userAuth.js](file:///Users/iskandermac/Downloads/project%206/backend/routes/userAuth.js) | Defines register, register-doctor, login, logout, profile endpoints. |
| **Admin Controller (API Routes)** | [auth.js](file:///Users/iskandermac/Downloads/project%206/backend/routes/admin/auth.js) | Defines login, logout, profile endpoints for dashboard admins. |
| **User Auth Middleware** | [userAuth.js](file:///Users/iskandermac/Downloads/project%206/backend/middleware/userAuth.js) | Resolves user cookies/headers, verifies JWTs, caches session IDs. |
| **Admin Auth Middleware** | [auth.js](file:///Users/iskandermac/Downloads/project%206/backend/middleware/auth.js) | Checks token against Supabase GoTrue, verifies against `admins` table. |
| **Database Migrations** | [20251221_phone_auth_and_credits.sql](file:///Users/iskandermac/Downloads/project%206/supabase/migrations/20251221_phone_auth_and_credits.sql) | Table schemas and PL/pgSQL database level checks. |
| **Client Context** | [AuthContext.tsx (client)](file:///Users/iskandermac/Downloads/project%206/client/src/context/AuthContext.tsx) | Manages web user login/logout states and credits. |
| **Admin Context** | [AuthContext.tsx (admin)](file:///Users/iskandermac/Downloads/project%206/admin/src/context/AuthContext.tsx) | Handles admin login/logout states and session expiry events. |

> [!NOTE]
> All code interactions must preserve this dual structure. Any modifications to user authentication schemas or tables should not bleed into GoTrue admin tables, and vice versa.
