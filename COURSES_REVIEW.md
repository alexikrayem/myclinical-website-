# Courses Functionality — Comprehensive Technical Review

**Repository:** `alexikrayem/myclinical-website-`
**Scope:** End-to-end review of the course / video-streaming subsystem (catalog, playback, billing, access control, attention verification, quizzes, Mux integration) across `backend/`, `client/`, `admin/`, and `supabase/`.
**Reference material consulted:** `.agent/skills/course-video-streaming/*` (SKILL, references, examples, `check_hls_leaks.js`), `docs/guides/MUX_MASTER_REFERENCE.md`, `docs/guides/MUX_DOCS_INDEX.md`, and all course-related migrations.
**Date:** 2026-07-22

---

## 1. Executive Summary

The courses subsystem is a mature, multi-provider video-learning platform. It is well-architected: the backend cleanly separates concerns into dedicated services (`courseCatalogService`, `coursePlaybackService`, `courseBillingService`, `coursePurchaseService`, `courseAccessService`, `courseQuizService`, `muxService`, `hlsService`, `attentionService`), input is validated with Zod, credit mutations are pushed into `SECURITY DEFINER` Postgres RPCs with row-level locking and idempotency, and the frontend player is a well-contained multi-provider component.

It supports **five playback providers** (VdoCipher, HLS-from-Supabase, Mux, YouTube, MP4), **three billing models** (`free`, `per_course`, `per_minute`), AI-generated quizzes, and a server-driven **attention-verification** system.

Overall grade: **solid and production-oriented**, but there are **several correctness and revenue-integrity issues** that should be addressed — most importantly a **per-minute billing bypass** tied to long-lived signed media URLs, **HLS signed-segment expiry** on long videos, and **broken playback-state/attention wiring for the VdoCipher provider**. None of the streaming/security concerns contradict the honest caveat in the skill docs ("this system does NOT fully prevent piracy"), but the revenue-integrity items are worth prioritizing.

### Severity legend
- **P0 — Critical:** revenue loss, data integrity, or security exposure in normal operation.
- **P1 — High:** incorrect behavior for a supported configuration; user-visible breakage.
- **P2 — Medium:** correctness edge cases, robustness, or hardening gaps.
- **P3 — Low:** polish, consistency, documentation, and maintainability.

---

## 2. System Architecture

### 2.1 Data model (Supabase / Postgres)

| Object | Purpose | Defined in |
| --- | --- | --- |
| `video_courses` | Source of truth for a course (private table, RLS-locked) | `20251125120000_…`, hardened in `20260303090000_courses_hardening.sql` |
| `courses_public` (VIEW) | Public projection excluding `playback_source`/`transcript`; granted to `anon`/`authenticated` | `20260303090000`, extended `20260323180000` |
| `course_access` | Per-user per-course entitlement (`per_course` model); unique on `(custom_user_id, course_id)` | hardening migration |
| `course_playback_sessions` | Issued playback session (`active`/`terminated`), `expires_at`, attention score/failures | hardening + attention migration |
| `course_progress` | Cumulative `seconds_watched` per `(course, user)`; drives per-minute billing | hardening migration |
| `course_playback_heartbeats` | Idempotency ledger, unique `(session_id, idempotency_key)` | hardening migration |
| `attention_checks` | Scheduled challenges with HMAC token, `trigger_at_seconds`, status | attention migration |
| `quizzes` / `user_quiz_attempts` | AI-generated quiz + attempt records | base + hardening |
| `user_credits` / `user_typed_credits` / `credit_transactions` | Credit balances (generic + typed) and ledger | credit migrations |

**Key RPCs (all `SECURITY DEFINER`):**
- `consume_video_minutes_v2` — per-minute billing with idempotency and `FOR UPDATE` locking.
- `purchase_course_access` — typed-credit-first, then universal-balance course purchase, idempotent.
- `verify_attention_challenge` — atomic challenge verification, failure counting, session termination, score recompute.
- `consume_article_credit` / `consume_research_credit` / `redeem_license_code_v3` — adjacent credit flows (reviewed for the C1 TOCTOU race fix in `20260702150000`).

### 2.2 Backend API surface (`backend/routes/courses.js`)

| Method & Path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/courses` | public | Paginated catalog (Meili search + FTS fallback) |
| `GET /api/courses/featured` | public | Featured list |
| `GET /api/courses/categories` | public | Distinct category list |
| `GET /api/courses/:id` | optional | Course metadata + `has_access` + applicable typed credits |
| `POST /api/courses/:id/playback` | user | Create session, return playback descriptor + attention plan |
| `POST /api/courses/:id/heartbeat` | user | Per-minute billing tick |
| `GET /api/courses/:id/hls/manifest` | user | Signed, rewritten HLS manifest (Supabase-hosted) |
| `POST /api/courses/:id/access` | user | Purchase per-course access |
| `GET /api/courses/:id/attention-check` | user | Poll for due challenge |
| `POST /api/courses/:id/attention-check/verify` | user | Verify / expire challenge |
| `POST /api/courses/:id/generate-quiz` | admin token | AI quiz generation |
| `GET /api/courses/:id/quiz` | user | Fetch quiz (access-gated) |
| `POST /api/courses/:id/quiz/submit` | user | Score + persist attempt |

Admin CRUD lives in `backend/routes/admin/courses.js` (create/update/list/get/delete, provider + billing normalization, Mux source fail-fast validation, Meili re-index).

### 2.3 Frontend

- **Client** (`client/src/`): `CoursesPage` (catalog + search + categories), `CourseDetailPage` (orchestrates playback/billing/attention/quiz), `SecureVideoPlayer` (multi-provider player), `AttentionCheckModal`, `QuizModal`, `CourseCard`/`CourseList`, `lib/api.ts` (axios + cookie auth + session-expiry interceptor).
- **Admin** (`admin/src/`): `Courses`, `CreateCourse`, `EditCourse`, `services/courseService.ts`.

### 2.4 Playback flow (happy path)

1. `GET /courses/:id` returns metadata + `has_access`.
2. Client auto-requests `POST /courses/:id/playback` when logged in and entitled.
3. `createPlaybackSession` verifies entitlement, inserts a session row, builds a provider-specific descriptor, and (if `attention_required`) bulk-generates challenges.
4. Player renders per `playback.type`; `per_minute` courses start a 30s heartbeat loop; attention polling runs every 10s.

---

## 3. Findings by Severity

### P0 — Critical

#### P0-1. Per-minute billing bypass via full-duration signed media URLs
**Where:** `coursePlaybackService.createPlaybackSession` + `muxService.createMuxPlaybackDescriptor` + `CourseDetailPage` heartbeat loop.

`createPlaybackSession` deliberately does **not** pre-check the credit balance for `per_minute` courses (documented as a fix for a racy check). Enforcement is left entirely to the first heartbeat via `consume_video_minutes_v2`. However:

- The Mux playback token TTL is computed as `max(sessionExpiry, now + duration + grace, configuredTtl)` — i.e. **valid for the entire video duration** (plus a 900s grace). The same is effectively true for the session TTL (`buildSessionExpiry` uses `max(600, duration + 900)`).
- Billing is client-driven: the heartbeat runs only while `isPlaying`, first fires at **30 seconds**, and charges only on whole-minute boundaries.
- On heartbeat failure the **client** stops playback (`setPlayback(null)`), but nothing revokes the already-issued signed URL server-side.

**Impact:** A user with **zero credits** can start a session, receive a signed Mux (or public MP4/HLS) URL valid for the whole video, and — with a lightly modified client or by ignoring the pause — watch the entire course without ever successfully paying. Even the honest client grants the first ~30–60 seconds free every session, and re-watch is effectively free (see P0-2).

**Recommendations:**
- Reinstate a **transactional pre-authorization** at session creation (e.g. an RPC that verifies a minimum balance under `FOR UPDATE` and optionally escrows the first minute) before issuing any signed URL.
- Cap the signed-token/session TTL to a **short window** (e.g. 60–120s) and require periodic re-issue gated on balance, rather than minting a full-duration token up front.
- Consider Mux **playback restrictions** + short token rotation so a leaked/awaited token dies quickly.

#### P0-2. Re-watching a per-minute course is free (cumulative progress gates billing)
**Where:** `consume_video_minutes_v2` (migration `20260303090000`).

Billing charges `FLOOR(new_seconds/60) − FLOOR(prev_seconds/60)` where `seconds_watched` is the **cumulative, monotonically increasing** `course_progress` value (unique per `course + user`, persisted across sessions). Once a user has watched N minutes total, the billable boundary never advances again, so **all subsequent viewing of the same course is charged 0**.

**Impact:** Per-minute revenue is collected essentially once per course per user (up to the max minute-boundary ever reached), not per actual minute watched. This may be intentional ("pay once for the minutes you unlock"), but it is not documented and conflicts with the "per-minute" label and the UI that shows a live decreasing minute balance.

**Recommendation:** Decide the intended semantics explicitly. If truly per-view, bill against a **per-session** watched counter, not cumulative `course_progress`. If "unlock minutes once," rename/relabel the model and document it.

---

### P1 — High

#### P1-1. VdoCipher provider: playback state stuck `true`, no pause control, attention unusable
**Where:** `SecureVideoPlayer.tsx`.

For `playback.type === 'vdocipher'` the component renders a raw `<iframe>` and fires `onPlaybackStateChange?.(true)` **once**, but:
- Never sets it back to `false` (no `pause`/`ended` events from the cross-origin iframe).
- Does **not** wire `videoControlRef`, so `videoControlRef.current?.pause()` during an attention check is a no-op.
- Provides no `onTimeUpdate`, so attention `current_seconds` never advances for VdoCipher.

**Impact:** On VdoCipher courses (a) the per-minute heartbeat loop keeps `isPlaying === true` forever and will bill even while the user has paused inside the iframe; (b) attention checks can neither be triggered (no time updates) nor enforced (video can't be paused). VdoCipher is also the **default provider** in the admin create form, so this is the most likely production configuration.

**Recommendation:** Integrate the VdoCipher player SDK (not a bare iframe) to expose play/pause/timeupdate, or disable `per_minute` + `attention_required` for VdoCipher and document the limitation.

#### P1-2. HLS signed segment URLs can expire mid-playback on long videos
**Where:** `hlsService.buildSignedManifest` (`HLS_SIGNED_URL_TTL`, default **600s**).

When the manifest is built, **every** segment (`.ts`) URI is rewritten to a Supabase signed URL with a fixed 600s TTL, computed at manifest-fetch time. For a video longer than ~10 minutes, segments near the end will have **already expired** by the time the player reaches them, producing fatal network errors.

**Impact:** HLS-from-Supabase playback breaks for any course longer than the TTL. The player's retry logic (`HLS_MAX_RETRIES = 3`, then `fatalError`) will surface the generic error state.

**Recommendations:**
- Set the segment TTL to at least `duration + grace`, or
- Rewrite segment URLs through the app's own authenticated proxy (like the manifest endpoint) and sign per-segment on demand, or
- Use variant-playlist re-signing (client re-requests the manifest endpoint, which is already supported for nested `.m3u8`).

#### P1-3. Attention challenges are trivially scriptable / partially non-secured
**Where:** `attentionService.generateChallengeData` + `AttentionCheckModal`.

- The **`confirm`** challenge's correct answer is the hard-coded string `'confirmed'`, known to any client — it provides **no** attention assurance (only a UI nudge).
- For **`color`** challenges, the challenge payload sent to the client contains each option's `nameEn`, and the question text embeds the target color name; a script can parse the question and submit the matching `nameEn` without a human present.
- Challenge scheduling (`current_seconds`) is **client-reported** via `onTimeUpdate`, so a modified client controls when (or whether) checks fire.

**Impact:** The attention system raises the bar for casual users but does not withstand a determined/automated bypass. This is broadly consistent with the skill's "raise the cost, not prevent" philosophy, but the `confirm` type in particular is security theater and the certificate gating (`attention_score >= 80%`) can be defeated.

**Recommendations:** Remove or de-weight `confirm`; for `color`, avoid sending human-readable answer labels (send only swatches + an opaque option id, keep the mapping server-side); treat attention scoring as advisory, not a hard security control.

---

### P2 — Medium

#### P2-1. No Mux webhook handling; asset lifecycle and `duration` are manual
**Where:** entire backend (no `@mux/mux-node`, no webhook route — confirmed by search).

Playback IDs and `duration` are typed by an admin in the course form. There is no `video.asset.ready` webhook, no signature verification, and no automatic duration sync. The MUX docs explicitly recommend webhooks over polling and warn against hardcoding playback URLs.

**Impact:** Admin can save a course whose asset isn't `ready` yet, or with a wrong `duration` — and `duration` feeds session TTL, Mux token TTL, per-minute UI, and attention scheduling. Incorrect duration silently degrades all four.

**Recommendation:** Add a Mux webhook endpoint with signature verification (`verify-webhook-signatures`) to sync `status`/`duration`/playback IDs; optionally support direct uploads via `@mux/mux-node`.

#### P2-2. `per_minute` first-tick granularity grants ~30–60s free per session
**Where:** `CourseDetailPage` heartbeat interval (30s) + minute-boundary billing.

Because the heartbeat fires every 30s and charges only whole crossed minutes, the initial partial minute is effectively free every session, and stopping before a minute boundary avoids the charge. Combined with P0-1, this compounds leakage.

**Recommendation:** Charge on session start for the first minute, or bill fractional accrued seconds server-side.

#### P2-3. No server-side rate limiting on playback/session/attention endpoints
**Where:** `backend/routes/courses.js`.

The skill's `hls-playback-service.md` example explicitly rate-limits the key-delivery endpoint. Here, `POST /:id/playback` (creates a DB session + bulk-inserts challenges) and the attention endpoints have no dedicated limiter (only admin upload has `uploadLimiter`).

**Impact:** A user can spam session creation, inflating `course_playback_sessions` / `attention_checks` rows.

**Recommendation:** Add an `express-rate-limit` limiter to playback/heartbeat/attention routes.

#### P2-4. Stale/abandoned sessions are never reaped
**Where:** `course_playback_sessions` lifecycle.

Sessions are only ever set to `terminated` by attention failure; expiry is enforced lazily at read time (`expires_at < now()` checks in billing/manifest/attention). There is no cleanup job, so the table grows unbounded with `active` rows that are actually expired.

**Recommendation:** Add a scheduled job (or a partial index + periodic `UPDATE … SET status='expired'`) to reap expired sessions and their pending challenges.

#### P2-5. `MUX_REQUIRE_SIGNED_PLAYBACK` referenced but undocumented
**Where:** `muxService.js` reads `process.env.MUX_REQUIRE_SIGNED_PLAYBACK`, but it is absent from both `.env.example` files (only `MUX_DEFAULT_PLAYBACK_POLICY=signed` is documented). The test file also exercises it. Operators may not realize this flag exists.

**Recommendation:** Document `MUX_REQUIRE_SIGNED_PLAYBACK` and `MUX_SIGNED_URL_TTL_SECONDS` in `.env.example`.

#### P2-6. `manifestUrl` with token is redundant/unused for Mux path
**Where:** `muxService` returns `manifestUrl: …?token=<playbackToken>`, but `SecureVideoPlayer` routes `type==='mux'` to `<MuxPlayer>` (which uses `playbackId` + `tokens`) and never consumes `manifestUrl`. Harmless, but the signed manifest URL is passed to the client for no reason and slightly widens token exposure surface.

**Recommendation:** Drop `manifestUrl` from the Mux descriptor (or keep only for an explicit non-MuxPlayer fallback).

---

### P3 — Low / Polish

- **P3-1. `MOCK_VIDEO_API=true` is the default in `backend/.env.example`.** Safe for dev, dangerous if copied to prod — VdoCipher would silently serve Big Buck Bunny. Flip the documented default to `false` and add a comment.
- **P3-2. Duplicated `Course` interfaces** across `CoursesPage.tsx`, `CourseDetailPage.tsx`, and `admin/.../courseService.ts` risk drift (e.g. `level`, `attention_required` present in some, not others). Extract a shared type.
- **P3-3. Duplicated `MAX_FILE_SIZE` key** in `backend/.env.example` (declared twice).
- **P3-4. `check_hls_leaks.js` heuristic won't recognize the current player.** It matches `new Hls(`/`new Plyr(` and `timeupdate` listeners; `SecureVideoPlayer` does create these and does clean them up correctly (`detachMedia()` + `destroy()`, listener removal), so it should pass — but the script is string-based and won't catch the Mux/VdoCipher branches. Treat it as advisory only.
- **P3-5. Skill vs. implementation drift.** The skill/examples describe an AES-128 + custom key-delivery HLS model that the app does **not** implement (it uses Mux/VdoCipher for real security and Supabase-signed URLs for self-hosted HLS). Update the skill docs to match the actual multi-provider architecture to avoid future confusion.
- **P3-6. `getNextChallenge` uses `.single()`** on a possibly-empty result and relies on catching the resulting error. `.maybeSingle()` would be cleaner and avoid noisy error paths.
- **P3-7. Quiz gating uses `course_access`** (`getLatestQuizForCourse`) which only exists for `per_course`. For `per_minute`/`free` courses the quiz fetch throws `Forbidden`, and `CourseDetailPage` only requests the quiz for `per_course` anyway — so `per_minute`/`free` courses can never show a quiz. Confirm this is intended.

---

## 4. What the Code Does Well

- **Clean service decomposition** and consistent `AppError` usage with error codes.
- **Money-touching logic lives in `SECURITY DEFINER` RPCs** with `FOR UPDATE` locking and idempotency keys — the credit race (C1 TOCTOU) fix and idempotent heartbeats/purchases are genuinely well done.
- **Mux signing is correct and fails closed**: separate `v`/`t`/`s` audience tokens, `playback_restriction_id` only on the playback token, session id embedded as a custom claim, and a hard error when signed playback is required but keys are missing — all covered by unit tests.
- **HLS manifest rewriting** sanitizes playlist paths (`..`/leading-slash rejection) and proxies nested playlists through the authenticated endpoint.
- **Player lifecycle** follows the skill's rules: `hls.detachMedia()` then `hls.destroy()`, Plyr `destroy()`, explicit listener cleanup, capped retry counters, and throttled progress (no per-second `setState`).
- **Attention verification** is atomic in a single RPC with HMAC + `timingSafeEqual` comparison and cryptographic RNG (`crypto.randomInt`, Fisher–Yates).
- **Public/private separation**: raw `video_courses` is RLS-locked and `playback_source`/`transcript` are never exposed through `courses_public`.
- **Good test coverage** across `courses`, `courses_extended`, and unit suites for access/billing/playback/purchase/mux/credits services.

---

## 5. Prioritized Remediation Plan

1. **P0-1 / P0-2 / P2-2 — Revenue integrity (per-minute):** add transactional pre-auth at session start, short-lived rotating tokens/sessions, and decide cumulative-vs-per-session billing semantics.
2. **P1-2 — HLS segment TTL:** extend TTL to `duration + grace` or proxy/sign segments on demand.
3. **P1-1 — VdoCipher wiring:** adopt the VdoCipher SDK for play/pause/timeupdate, or gate out `per_minute`/`attention` for it.
4. **P2-1 — Mux webhooks:** sync asset status/duration; verify signatures.
5. **P1-3 — Attention hardening:** drop `confirm`, hide answer labels, treat scoring as advisory.
6. **P2-3 / P2-4 — Rate limiting + session reaping.**
7. **P2-5 / P3-x — Docs, shared types, `.env` cleanup, skill-doc alignment.**

---

## 6. Files Reviewed

**Backend services:** `courseCatalogService.js`, `coursePlaybackService.js`, `courseBillingService.js`, `coursePurchaseService.js`, `courseAccessService.js`, `courseQuizService.js`, `muxService.js`, `hlsService.js`, `attentionService.js`, `vdoService.js`
**Backend routes/middleware:** `routes/courses.js`, `routes/admin/courses.js`, `middleware/validation.js`
**Client:** `pages/CoursesPage.tsx`, `pages/CourseDetailPage.tsx`, `components/courses/SecureVideoPlayer.tsx`, `AttentionCheckModal.tsx`, `lib/api.ts`
**Admin:** `pages/CreateCourse.tsx`, `services/courseService.ts`
**Migrations:** `20260303090000_courses_hardening.sql`, `20260323180000_attention_verification.sql`, `20260402000001_verify_attention_challenge.sql`, `20260314223500_typed_credit_collections.sql`, `20260622000000_add_mux_course_playback.sql`, `20260702150000_fix_credit_consume_race_condition.sql`
**Skill & docs:** `.agent/skills/course-video-streaming/*`, `docs/guides/MUX_MASTER_REFERENCE.md`, `docs/guides/MUX_DOCS_INDEX.md`
**Config:** `.env.example`, `backend/.env.example`
**Tests (referenced):** `backend/__tests__/unit/muxService.test.js` and adjacent course unit suites
