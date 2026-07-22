# API Routing & Services Layer

The backend server exposes REST endpoints to manage user credit lookup, consumption, and admin code generation. The routing layer runs rate limiters, payload schemas, and delegates transactions to logical service handlers.

---

## 1. User Routing Layer (`backend/routes/credits.js`)

All endpoints under `/api/credits` are authenticated (via `authenticateUser` or `optionalAuth` middleware) and operate under strict rate-limiting thresholds.

### A. Endpoints Specifications

#### 1. Fetch Balances: `GET /api/credits/balance`
- **Authentication**: Required (`authenticateUser`)
- **Description**: Returns all credits balances (generic and typed scoped credits).
- **Service invoked**: `getCreditBalance(supabase, userId)`
- **Response Format**:
  ```json
  {
    "balance": 150,
    "video_watch_minutes": 100,
    "article_credits": 10,
    "research_credits": 5,
    "total_earned": 500,
    "total_spent": 350,
    "typed_credits": [
      {
        "credit_type_id": "uuid-here",
        "name": "Orthodontics",
        "prefix": "ORTH",
        "balance": 25
      }
    ]
  }
  ```

#### 2. Redeem Code: `POST /api/credits/redeem`
- **Authentication**: Required
- **Rate Limiters**: `redeemLimiter` (Global IP limit), `accountRedeemLimiter` (Per-account request rate limit)
- **Validation**: Zod schema `validateRedeem`
- **Payload**: `{ "code": "GIFT-A1B2-C3D4-E5F6" }`
- **Service invoked**: `redeemLicenseCode(supabase, { code, userId, metadata })`
- **Returns**: Updated balances and credit types.

#### 3. Consume Video minutes: `POST /api/credits/consume-video`
- **Authentication**: Required
- **Rate Limiters**: `consumeLimiter` (Prevents runaway consumption requests)
- **Validation**: `validate(schemas.creditsConsumeVideo)`
- **Payload**: `{ "minutes": 10, "course_id": "uuid" }`
- **Service invoked**: `consumeVideoMinutes(supabase, { userId, minutes, courseId })`

#### 4. Consume Article credit: `POST /api/credits/consume-article`
- **Authentication**: Required
- **Rate Limiters**: `consumeLimiter`
- **Validation**: `validate(schemas.creditsConsumeArticle)`
- **Payload**: `{ "article_id": "uuid" }`
- **Service invoked**: `consumeArticleCredit(supabase, { userId, articleId })`

#### 5. Verify Article entry access: `GET /api/credits/check-article-access/:articleId`
- **Authentication**: Optional (`optionalAuth` – check access for guest users)
- **Validation**: `validate(schemas.creditsCheckArticleAccess)`
- **Parameters**: `articleId` (URL Param)
- **Services layer**: `checkArticleAccess(supabase, { articleId, userId, isAdmin })`
  > [!NOTE]
  > Admin status is verified by checking `req.user.is_admin === true` in the authentication layer and bypassing DB access table queries, protecting server bandwidth.

#### 6. Consume Research paper credit: `POST /api/credits/consume-research`
- **Authentication**: Required
- **Rate Limiters**: `consumeLimiter`
- **Validation**: `validate(schemas.creditsConsumeResearch)`
- **Payload**: `{ "research_id": "uuid" }`
- **Service invoked**: `consumeResearchCredit(supabase, { userId, researchId })`

---

## 2. Administrator Routing Layer (`backend/routes/admin/credits.js`)

All endpoints under `/api/admin/credits` require Admin Authentication (`authenticateToken` middleware).

### A. Endpoints Specifications

#### 1. Generate Codes: `POST /api/admin/credits/generate`
- **Zod Validation**: `generateCodesSchema` (Forces `credit_type_id` validation if `credit_type === 'typed'`)
- **Key Parameters**:
  - `amount`: Number of codes to generate (max 100 per request)
  - `credit_value`: Unit value of codes
  - `credit_type`: Enum `('video', 'article', 'universal', 'both', 'research', 'all', 'typed')`
  - `expires_in_days`: expiration window (default 365 days)
- **DB Trigger**: Calls PostgreSQL `generate_license_codes_v4` RPC, returning an array of generated text keys.

#### 2. Redemption Records Report: `GET /api/admin/credits/reports`
- **Zod Validation**: `reportsQuerySchema` (supports paging limit/offset and text queries)
- **Security Check**: Employs `sanitizeSearchInput` and escapes raw query patterns to block sql pattern injection.
- **Source View**: Reads database view `admin_license_quiz_report`.

#### 3. Log History Audit: `GET /api/admin/credits/history`
- **Description**: Exposes full codes log (unclaimed and claimed codes list).
- **Source Table**: Reads `license_codes`.

---

## 3. Rate Limiters & Security Policies

To prevent security attacks such as card guessing (brute-forcing code combinations) or billing loops, the system enforces the following express rate limiters:

1. **`redeemLimiter` (IP Rate Limiting)**:
   - Restricts total code validation attempts coming from a specific client IP address. Prevents random dictionary generators or script bots from scanning code permutations.
2. **`accountRedeemLimiter` (User Account Rate Limiting)**:
   - Restricts code redemption attempts on a per-user basis. If an attacker operates across multiple proxies to guess keys, their authenticated target profile gets throttled.
3. **`consumeLimiter` (Consumption Rate Limiting)**:
   - Prevents race condition attacks or logic errors that fire thousands of usage decrement calls (e.g. streaming playback issues causing quick API calls). Protects credits balance from being double-charged or drained from accidental rapid requests.
