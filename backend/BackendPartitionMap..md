# Backend Partition Map

This document breaks down the backend system into clearly defined, mutually exclusive, and collectively exhaustive architectural partitions. We will use this structure for the comprehensive code review.

---

## 1. API Layer / Routing

**Responsibility:**  
Define REST/HTTP endpoints, manage incoming client requests, and route them to appropriate handlers or services. Acts as the entry point into the application.

**Key Files/Modules:**  
- `backend/server.js`  
- `backend/routes/*.js`  
  - `courses.js`  
  - `credits.js`  
  - `articles.js`  
  - `userAuth.js`  
  - `admin.js`  
  - `ai.js`  
  - `search.js`  
  - `securePdf.js`

**Inputs/Outputs:**  
- Inputs: HTTP requests (JSON payloads, FormData, URL parameters)  
- Outputs: HTTP responses (JSON, file streams, redirects)

**Data Flow:**  
Receives traffic from the client/proxy, passes it through global and route-specific middleware, forwards to business logic or data access layers, and returns the formatted response.

---

## 2. Authentication & Authorization

**Responsibility:**  
Verify user identity (Custom Users, Admins, Standard Users), enforce role-based access control, and manage secure session/JWT states.

**Key Files/Modules:**  
- `backend/middleware/auth.js`  
- `backend/middleware/userAuth.js`  
- `backend/routes/userAuth.js`  
- Supabase Auth integration

**Inputs/Outputs:**  
- Inputs: Credentials, Phone OTPs, JWT tokens, cookies  
- Outputs: Decoded user profiles, session cookies, 401/403 status codes

**Data Flow:**  
Intercepts requests early. Exchanges credentials for tokens via Supabase. Decorates the `req` object with user context for downstream processing. Security is supplemented at the DB layer via Row Level Security (RLS).

---

## 3. Request Validation & Middleware

**Responsibility:**  
Sanitize incoming payloads, enforce rate limits, handle file upload validations, inject security headers, and prevent common attacks (XSS, HPP, NoSQL injection).

**Key Files/Modules:**  
- `backend/middleware/inputSanitizer.js`  
- `backend/middleware/rateLimiter.js`  
- `backend/middleware/fileValidation.js`  
- `backend/middleware/securityHeaders.js`  
- `backend/middleware/validation.js`

**Inputs/Outputs:**  
- Inputs: Raw request objects  
- Outputs: Sanitized request objects, rejection responses (400, 429)

**Data Flow:**  
Executes after routing but before core business logic. Short-circuits the request-response cycle if constraints are violated.

---

## 4. Business Logic / Services

**Responsibility:**  
Encapsulate complex domain workflows across multiple entities or multi-step processing (e.g., redeeming credits, AI queries, video licensing).

**Key Files/Modules:**  
- `backend/services/`  
- `vdoService.js`  
- Subdirectories (e.g., `courses`, `search`)  
- Complex controller logic in route files

**Inputs/Outputs:**  
- Inputs: Validated domain parameters  
- Outputs: Processed business entities, domain errors

**Data Flow:**  
Invoked by route handlers. Orchestrates multiple data access calls or external APIs to construct the final payload.

---

## 5. Data Access Layer (Repositories / ORM / Queries)

**Responsibility:**  
Interface securely with the database to execute queries and mutations.

**Key Files/Modules:**  
- Supabase JS Client (`@supabase/supabase-js`)  
- `backend/utils/`  
  - `searchUtils.js`  
  - `phone.js`

**Inputs/Outputs:**  
- Inputs: Query parameters, abstractions  
- Outputs: Result sets (rows), DB errors

**Data Flow:**  
Translates service layer requirements into PostgREST/Supabase calls or native Postgres queries.

---

## 6. Database Schema & Models

**Responsibility:**  
Define data structure, relationships, constraints, indexes, triggers, and Row Level Security (RLS) policies.

**Key Files/Modules:**  
- `supabase/migrations/*.sql`  
  - `20260310203100_improve_credit_system.sql`  
  - `20260303090000_courses_hardening.sql`  
  - `20260323180000_attention_verification.sql`

**Inputs/Outputs:**  
- Inputs: SQL DDL/DML  
- Outputs: Persisted relational data

**Data Flow:**  
Runs inside Postgres. Enforces integrity and access control synchronously during DB operations.

---

## 7. External Integrations (Third-Party APIs)

**Responsibility:**  
Handle communication with external services (e.g., video delivery, AI workflows, search indexing).

**Key Files/Modules:**  
- `backend/services/vdoService.js`  
- Google Generative AI (`@google/generative-ai`)  
- MeiliSearch SDK  
- Sentry (`@sentry/node`)

**Inputs/Outputs:**  
- Inputs: External API requests  
- Outputs: Third-party responses, API errors

**Data Flow:**  
Data leaves the application boundary and returns synchronously or asynchronously.

---

## 8. Caching Layer

**Responsibility:**  
Reduce DB load by caching frequently accessed data and storing ephemeral state.

**Key Files/Modules:**  
- `backend/config/redis.js`  
- `backend/middleware/cache.js`  
- Redis client

**Inputs/Outputs:**  
- Inputs: Cache keys  
- Outputs: Serialized JSON objects

**Data Flow:**  
Cache lookup occurs before DB access. Misses trigger computation followed by caching.

---

## 9. Asynchronous Processing

**Responsibility:**  
Execute background jobs, scheduled tasks, and non-blocking operations.

**Key Files/Modules:**  
- `scripts/reindex_meili.js`

**Inputs/Outputs:**  
- Inputs: Background triggers/events  
- Outputs: Side effects (DB updates, indexing)

**Data Flow:**  
Detached from the HTTP request-response cycle to avoid blocking.

---

## 10. Error Handling & Logging

**Responsibility:**  
Handle errors, standardize API responses, and capture telemetry.

**Key Files/Modules:**  
- `backend/middleware/errorHandler.js`  
- `backend/middleware/requestLogger.js`  
- `backend/config/logger.js` (Winston)  
- `backend/config/sentry.js`

**Inputs/Outputs:**  
- Inputs: Errors, request metadata  
- Outputs: JSON error responses, logs, traces

**Data Flow:**  
Wraps the entire app lifecycle. Centralized error handling via middleware.

---

## 11. Configuration & Environment Management

**Responsibility:**  
Manage and validate environment variables across environments.

**Key Files/Modules:**  
- `backend/middleware/envValidator.js`  
- `.env`  
- `backend/server.js` (dotenv)

**Inputs/Outputs:**  
- Inputs: Environment variables  
- Outputs: Validated config objects

**Data Flow:**  
Validated at startup. Application fails fast if required configs are missing.

---

## 12. Testing Infrastructure

**Responsibility:**  
Ensure correctness through automated tests.

**Key Files/Modules:**  
- `backend/__tests__/`  
- `backend/test/`  
- `backend/jest.config.js`

**Inputs/Outputs:**  
- Inputs: Test scripts, mocks  
- Outputs: Reports, coverage, pass/fail results

**Data Flow:**  
Runs in local or CI/CD environments. No impact on production runtime.

---

## 13. Deployment & Infrastructure Hooks

**Responsibility:**  
Support containerization, observability, and orchestration.

**Key Files/Modules:**  
- `docker-compose.yml`  
- `prometheus.yml`  
- `backend/server.js` (`/metrics` endpoint)

**Inputs/Outputs:**  
- Inputs: Application state  
- Outputs: Health checks (`/health`), metrics

**Data Flow:**  
External systems (Docker, Prometheus) interact with the app for lifecycle and monitoring.