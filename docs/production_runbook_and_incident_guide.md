# MyClinical Production Operations & Incident Runbook

This guide details the operational procedures, deployment patterns, telemetry monitoring, incident remediation, and disaster recovery plans for the MyClinical platform. It is designed to ensure production-readiness, prevent user-facing downtime, protect database integrity, and enable systems engineers to react swiftly to unexpected outages.

---

## 1. System Architecture & Topology

```mermaid
graph TD
    Client["Client Web App (React/Vite)<br>Port: Static CDN"] -->|REST API over HTTPS| ExpressBackend["Express.js API Gateway<br>Port: 5001"]
    Admin["Admin Panel (React/Vite)<br>Port: Static CDN"] -->|REST API over HTTPS| ExpressBackend
    
    subgraph Storage & Cache
        ExpressBackend -->|Read/Write Pool| Supabase["Supabase (PostgreSQL)<br>Port: 5432"]
        ExpressBackend -->|Rates/Sessions/Caching| Redis["Redis Cluster<br>Port: 6379"]
    end
    
    subgraph External Infrastructure Services
        ExpressBackend -->|Video Transcoding & JWTs| Mux["Mux Video API<br>Port: HTTPS"]
        ExpressBackend -->|Global Error Logging| Sentry["Sentry Dashboard<br>Port: HTTPS"]
        ExpressBackend -->|Search Indexes| Meilisearch["Meilisearch Server<br>Port: 7700"]
    end

    subgraph Observability Stack
        Prometheus["Prometheus Server<br>Port: 9090"] -.->|Pulls Metrics| ExpressBackend
        Grafana["Grafana UI<br>Port: 3000"] -->|Visualizes| Prometheus
    end
```

---

## 2. Pre-Launch Readiness & Validation Checklist

Before exposing the platform to public traffic, the deployment team must verify these checks:

```mermaid
graph TD
    Start[Run Pre-Launch Checklist] --> V1[Validate envValidator Requirements]
    V1 --> V2[Disable MOCK_VIDEO_API]
    V2 --> V3[Harden CORS Allowed Origins]
    V3 --> V4[Force STRICT_SECURITY=true]
    V4 --> V5[Test Health Endpoint]
    V5 --> End[Platform Ready for Public Traffic]
```

### 2.1 Boot Environment Verification
Ensure the backend server boots under strict checking. The `backend/middleware/envValidator.js` validates configurations automatically.
* **`NODE_ENV`**: Set strictly to `production`.
* **`STRICT_SECURITY`**: Set to `true` in the environment settings to force the node process to exit immediately if critical environment parameters are not present or validated.
* **`PORT`**: Verify it routes through safe, open ports (e.g. `5001`).

### 2.2 Dependency Mock Settings
* Ensure **`MOCK_VIDEO_API`** is set to `false` in production. If set to `true`, the platform bypasses Mux checks, allowing users to watch media without signed token playback checks.

### 2.3 Network Origin Check
* Inspect `ALLOWED_ORIGINS` in `backend/.env`. It must contain the specific production domains (e.g., `https://myclinical.com,https://admin.myclinical.com`). 
* **NEVER** use wildcards (`*`) or comma-separated lists with trailing wildcards in production, as credentials (cookies) are enabled.

### 2.4 Health Check Verification
Verify all dependencies are successfully resolved by hit testing the API endpoint:
```bash
curl -i http://localhost:5001/health
```
A system in normal operational health responds with status code `200` (or `207` if degraded):
```json
{
  "status": "OK",
  "security": "enabled",
  "timestamp": "2026-08-03T17:09:55+03:00",
  "environment": "production",
  "dependencies": {
    "supabase": "CONNECTED",
    "redis": "CONNECTED",
    "meilisearch": "CONNECTED"
  }
}
```

---

## 3. Telemetry, Dashboards & Metrics

### 3.1 Prometheus & Grafana Configuration
The backend tracks application state using `express-prom-bundle` (exposing `/metrics` to Prometheus scraping instances).

1. **Prometheus Scraping Rule** (`prometheus.yml`):
   ```yaml
   global:
     scrape_interval: 15s
   scrape_configs:
     - job_name: 'myclinical-backend'
       metrics_path: '/metrics'
       static_configs:
         - targets: ['backend:5001']
   ```
2. **Essential Prometheus Metrics**:
   * **API Availability**: `up{job="myclinical-backend"}` (should return `1`).
   * **Request Throughput**: `rate(http_requests_total[5m])` (analyzes call rate per window).
   * **Latency Quantiles**: `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))` (tracks 95th-percentile response latency).
   * **Error Rates**: `rate(http_requests_total{status_code=~"5.."}[5m])` (returns rate of server error codes).

---

## 4. Emergency Remediation Runbooks (The "What if?" Playbooks)

Use these procedures to remediate issues if they arise in production.

### Case A: Database Connection Interruption (Supabase)
**Symptoms**: Health endpoint reports `"supabase": "ERROR"`, API requests return `500 Server Error`, or client logs show database timeout.

```mermaid
flowchart TD
    Detect[Database Connection Failures Detected] --> Ping[Check Network Ping to Supabase Domain]
    Ping -->|Unreachable| ISP[Check Supabase Status Dashboard status.supabase.com]
    Ping -->|Reachable| Credentials[Check backend/.env for SERVICE_ROLE_KEY and URL]
    Credentials -->|Invalid| UpdateEnv[Correct variables & restart Express process]
    Credentials -->|Valid| PoolMax[Check PostgreSQL Connection Pool Size]
    PoolMax -->|Pool Exhausted| KillIdle[Terminate stuck connections via Supabase Console SQL Console]
```

#### Detailed Remediation:
1. **Network Diagnostics**: Confirm network accessibility from the application containers to Supabase servers:
   ```bash
   ping db.[your-project-ref].supabase.co
   ```
   *If the host is unreachable, verify DNS settings, egress firewalls, or check the global status dashboard at [status.supabase.com](https://status.supabase.co).*
2. **Key Expiry Check**: Validate that `SUPABASE_SERVICE_ROLE_KEY` hasn't been rotated or expired.
3. **Database Client Pool Settings**: Under high request concurrency, the PostgreSQL pooling system can become exhausted.
   * Log in to the Supabase Database dashboard interface.
   * Run the SQL statements to identify active database client connections and clear stuck ones:
     ```sql
     -- Check current connection counts
     SELECT count(*), state FROM pg_stat_activity GROUP BY state;

     -- Terminate active queries running longer than 5 minutes
     SELECT pg_terminate_backend(pid) 
     FROM pg_stat_activity 
     WHERE state = 'active' 
       AND query_start < now() - interval '5 minutes';
     ```

---

### Case B: Redis Cache Lockups and Rate Limit Issues
**Symptoms**: Users report rate-limit locking errors on their login pages, or the health check lists Redis as `DISCONNECTED`.

```mermaid
flowchart TD
    RedisDown[Redis Outage / Lockups] --> CheckState[Execute CLI connection test: redis-cli PING]
    CheckState -->|Returns PONG| CacheClear[Execute safe flush command sequence]
    CheckState -->|No Response| RestartCtrl[Restart local Redis service: docker-compose restart redis]
```

#### Detailed Remediation:
1. **Connection Diagnostic**:
   Log into the host machine and verify that Redis is active:
   ```bash
   redis-cli -u redis://localhost:6379 PING
   ```
   If Redis returns `PONG`, the service is operating. If it times out or refuses connection, restart the Redis container target:
   ```bash
   docker-compose restart redis
   ```
2. **Clearing Rate-Limiter Overrides**:
   If an administrator or user is blocked by rate-limiting middleware (e.g. `apiLimiter`, `redeemLimiter`), you can clear their records in Redis by deleting their matching IP keys:
   ```bash
   # Query matches using SCAN (never use KEYS in production to prevent DB lock)
   redis-cli --eval scripts/clear_ip_limit.lua , 192.168.1.100
   ```
3. **Invalidating Application Cache Safely**:
   Use the built-in cache invalidation system in the application controllers to purge stale content:
   ```javascript
   import { invalidateCachePattern } from './middleware/cache.js';
   // Always execute using asynchronous SCAN matching to avoid blocking events
   await invalidateCachePattern('cache:/api/articles*');
   ```

---

### Case C: Credit ledger Sync Mismatch & RPC Concurrency Errors
**Symptoms**: Concurrent credit deductions fail, ledger logs show race conditions, or users run into database key conflict warnings (PostgreSQL error code `23505`).

#### Detailed Remediation:
1. **Idempotency and Conflict Catching**: Deducting balance values requires strict transactional locks. Multiple simultaneous requests (double-spending attempts) are mitigated by using Supabase database functions (RPCs).
2. **SQL Unique Key Violations (`23505`)**:
   Ensure the backend controllers catch this code and resolve it without throwing a client exception when users reload elements they already unlocked:
   ```javascript
   if (error.code === '23505') {
     logger.warn('Conflict duplicate transaction 23505 - fallback with success return', { userId, articleId });
     return { success: true }; // Resolve safely
   }
   ```
3. **Audit Ledger Reconciliation Statement**:
   If a user's credit balance is out of sync with their purchase ledger, run a validation query in the Supabase console to recalculate their total credits:
   ```sql
   SELECT user_id, 
          SUM(CASE WHEN transaction_type = 'purchase' THEN amount ELSE -amount END) as manual_calc_balance 
   FROM credit_ledger 
   GROUP BY user_id;
   ```

---

### Case D: Mux Video Playback Failures
**Symptoms**: Videos fail to load, showing "Signature verification failed" or "Invalid playing token" on Plyr/Mux players.

#### Detailed Remediation:
1. **Verify Playback Token TTL**:
   Playback security parameters are governed by `PLAYBACK_SESSION_TTL_SECONDS` (minimum `60`s, maximum `120`s, default `75`s). If client systems synchronize slowly or experience network lag, increase this TTL slightly inside the backend `.env` variables:
   ```env
   PLAYBACK_SESSION_TTL_SECONDS=100
   ```
2. **Check Certificate Key Mismatch**:
   Verify the Mux secret key is configured correctly in the backend `.env` file:
   * **`MUX_SIGNING_PRIVATE_KEY`** (or `MUX_SIGNING_KEY_PRIVATE_KEY`): Must contain a valid, Base64-encoded RS256 private key.
   * If the key value has formatting errors or includes unescaped newlines, the signature process will fail. Correct the formatting using a single-line Base64 format.

---

### Case E: Attention Check Heartbeat Failures
**Symptoms**: User course progression freezes, video playback halts repeatedly, or log files show cryptographically failing validations.

#### Detailed Remediation:
1. All client attention verify calls must be signed using `ATTENTION_HMAC_SECRET`. If verification fails, verify that:
   * `ATTENTION_HMAC_SECRET` is synchronized between the primary and fallback servers.
   * Client-side heartbeat payload parameters are not being altered in transit.
2. **Timing Clamping**:
   Ensure validation thresholds set in the database conform to expected ranges (`attention_check_interval_min` to `attention_check_interval_max`). If validation checks arrive outside these thresholds, the API drops the heartbeat update as page manipulation.

---

### Case F: Meilisearch Index Sync Corruption / Outages
**Symptoms**: Global search fields return empty arrays, autocomplete freezes, or newly created articles do not show up in searches.

#### Detailed Remediation:
1. **Availability Verification**: Ensure Meilisearch is reachable on port `7700`:
   ```bash
   curl -i -H "Authorization: Bearer [MEILI_MASTER_KEY]" http://localhost:7700/health
   ```
   *Expected response: `{"status":"ok"}`. If returning errors, check Meilisearch server CPU and memory allocations.*
2. **Rebuilding Search Indices**:
   If indexes are out of sync with the Supabase database, trigger a complete reindex:
   ```bash
   cd backend
   node scripts/reindex_meili.js
   ```
3. **Meilisearch Key Rotations**:
   If index modifications fail with `401 Unauthorized`, ensure `MEILI_MASTER_KEY` configured in the backend `.env` matches the `--master-key` parameter supplied to the Meilisearch container during startup in `docker-compose.yml`.

---

### Case G: File Upload Service Disruption
**Symptoms**: Administrators/authors receive `400 Bad Request` or `500 Server Error` when uploading courses materials, PDF documents, or graphics.

#### Detailed Remediation:
1. **Size Limits Limits**:
   Multer limits are programmatically capped in `backend/server.js` (`limit: '10mb'`). Uploads exceeding this threshold bypass validation and fail. Adjust limit attributes inside size validations if larger documents are required.
2. **Disk Space Exhaustion**:
   Check if the system's active uploads mount directory has run out of storage space:
   ```bash
   df -h /Users/iskandermac/Downloads/project\ 6/uploads
   ```
3. **Mime Type Filter Validation**:
   Review server-side filters to verify file uploads are permitted. Check the file type signature checks:
   * Only approved mime formats (e.g., `image/jpeg`, `image/png`, `application/pdf`) are supported.
   * Temporary execution files (.exe, .sh, .js) are strictly rejected by the validator to mitigate remote code execution (RCE) vulnerabilities.

---

## 5. Security & XSS Mitigation

* **CORS Settings**: Do not use `Access-Control-Allow-Origin: *` when handling cookie credential authorizations. The backend expects strict URL values matching `ALLOWED_ORIGINS`.
* **Cookie Isolation**: Enforce `httpOnly` secure attributes on the session cookies to protect them from browser script access (XSS):
  ```javascript
  res.cookie('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 Days
  });
  ```
* **HTML Sanitization**: To protect client systems from rich text payloads, always process input blocks through `DOMPurify.sanitize(input)` before rendering inside React:
  ```javascript
  import DOMPurify from 'dompurify';
  const CleanContent = ({ htmlString }) => {
    const cleanHtml = DOMPurify.sanitize(htmlString);
    return <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
  };
  ```

---

## 6. Disaster Recovery and Database Backups

If a system partition fails or data corruption occurs, execute standard recovery procedures:

1. **Daily Automatic Backups**:
   Supabase operates automated daily backups of schema configurations and database data. Ensure this policy is enabled in the Supabase management console under **Project Settings > Backups**.
2. **Manual DB Export (Before migrations or patch deployment)**:
   ```bash
   # Export schema structure and database records using Supabase CLI
   supabase db dump --data-only > production_backup_data.sql
   supabase db dump --schema-only > production_backup_schema.sql
   ```
3. **Database Restoration**:
   To recover a backup, target the PostgreSQL instance directly using the service role credentials connection string:
   ```bash
   psql "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" -f production_backup_schema.sql
   psql "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" -f production_backup_data.sql
   ```
4. **Deploying Recovery Rollbacks**:
   If a newly deployed backend version triggers runtime crashes:
   * Roll back the Git deployment branch to the last stable release tag:
     ```bash
     git checkout tags/v1.2.4
     npm install
     npm run dev -- --watch
     ```
   * Re-run health checks at `/health` to confirm the backend services connect successfully.
