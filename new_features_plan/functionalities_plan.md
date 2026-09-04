# Creator Platform — Implementation Plan

This document set specifies two new capabilities for the MyClinical platform and
exactly how to build them **inside the existing architecture** (Express backend +
Supabase Postgres + two Vite/React SPAs — public `client/` and `admin/`).

| # | Feature | Doc |
|---|---------|-----|
| 1 | **Creator accounts** — logged-in users get a personal account page, can **write articles** and **publish courses**, everything is **sent to admins for approval**, and the account page doubles as a **link-in-bio** profile. | [`01-author-accounts-and-submissions.md`](./01-author-accounts-and-submissions.md) |
| 2 | **Unlisted public-health articles** — creators publish articles aimed at the general public that are **not discoverable through the main site** and are reached **only via a shareable social link** (Facebook, Instagram carousels/bio). | [`02-unlisted-public-articles.md`](./02-unlisted-public-articles.md) |

Read this README first — it captures the shared architecture facts, the data-model
strategy, security/RLS rules, rollout order, and testing that both features depend on.

---

## 1. Current-state analysis (what we are building on)

These facts were verified against the current codebase and drive every decision below.

### 1.1 Two independent auth systems

There are **two separate identity systems** — do not confuse them:

| System | Table | Auth mechanism | Middleware | Used by |
|--------|-------|----------------|------------|---------|
| **Site users** | `users` (custom) | phone + password (bcrypt), JWT in httpOnly cookie `user_session`, sessions in `user_sessions`, Redis-cached | `authenticateUser`, `optionalAuth` (`backend/middleware/userAuth.js`) | public `client/` |
| **Admins** | `admins` | Supabase Auth (`supabasePublic.auth.getUser(token)`) | `authenticateToken`, `requireRole` (`backend/middleware/auth.js`) | `admin/` panel |

Key `users` columns already present (`20260613000000_add_doctor_verification.sql`):
`role` (`'user' | 'doctor'`), `verification_status` (`'none' | 'pending' | 'approved' | 'rejected'`),
`rejection_reason`, `specialization`, `bio`, `education`, `experience_years`,
`clinic_address`, `email`, `website`, `syndicate_card_url`.

> **Creator submissions are a `users`-system feature.** They must be protected by
> `authenticateUser`, and dental (professional) articles must additionally require
> `role = 'doctor'` and `verification_status = 'approved'`.

### 1.2 The `authors` table already links to users

`authors` has: `name`, `bio`, `specialization`, `experience_years`, `education`,
`location`, `email`, `website`, `image`, `is_active`, and **`user_id uuid REFERENCES users(id)`**
(unique when not null). When an admin approves a doctor
(`backend/routes/admin/verifications.js`), an `authors` row is created and linked
via `user_id`. **The public author profile / link-in-bio page is therefore a view over
`authors` joined to the creator's `users` row.**

> ⚠️ Articles reference their author by **name string** (`articles.author TEXT`, matched
> against `authors.name`), *not* by a foreign key. This is fragile. Feature 1 adds a
> proper `articles.author_id → authors.id` FK while keeping `author` for backward compat.

### 1.3 Articles are currently 100% public and discoverable

- `articles` columns: `title`, `excerpt`, `content` (HTML), `cover_image`, `author`,
  `tags text[]`, `is_featured`, `credits_required`, `article_type` (`'article' | 'clinical_case'`),
  `slug` (unique), `publication_date`.
- RLS policy `"Anyone can read articles" ... USING (true)` — **every row is world-readable.**
- The backend reads articles through `supabasePublic` **and** `supabaseAdmin`; the admin
  client **bypasses RLS**, so RLS alone can never be the only gate. Every public read path
  must add explicit `status`/`visibility` filters (see §3).
- Public read/serve paths that must be updated: `backend/routes/articles.js`
  (`GET /`, `/featured`, `/by-tags`, `/tags`, `/:idOrSlug`, `/:id/related`),
  `backend/routes/search.js`, `backend/routes/sitemap.js`, and the Meili indexer
  (`backend/services/search/indexer.js`).

### 1.4 There is a proven moderation pattern to copy

Doctor verification (`admin/routes/admin/verifications.js` + `admin/src/pages/Verifications.tsx`
+ `admin/src/services/verificationService.ts`) already implements the exact
**pending → approve / reject(with reason)** workflow we need for content moderation.
**Mirror it** for article/course submissions instead of inventing a new pattern.

### 1.5 The client is a client-side-rendered SPA

`client/` is Vite + React Router (`client/src/App.tsx`) — **no SSR**. Social crawlers
(Facebook, Twitter/X, WhatsApp, LinkedIn) do **not** execute JavaScript, so per-article
Open Graph tags injected client-side are invisible to them. Feature 2's social-sharing
requirement therefore needs a **server-rendered HTML shell** for share URLs (see
[Feature 2, §4](./02-unlisted-public-articles.md)). Note the backend already serves
non-API HTML/XML today via `backend/routes/sitemap.js` mounted at `/`.

---

## 2. Unified content-lifecycle data model

Both features are two axes on the **same `articles` table**. Model them as two orthogonal
columns rather than overloading one enum:

| Axis | Column | Values | Meaning |
|------|--------|--------|---------|
| **Moderation status** (Feature 1) | `status` | `draft`, `pending`, `approved`, `rejected` | Where the item is in the review pipeline. Only `approved` is ever served. |
| **Audience / discoverability** (Feature 2) | `audience` | `professional`, `public` | Who it is written for. `professional` = dental peers (current behaviour). `public` = general readers. |
| | `visibility` | `listed`, `unlisted` | `listed` shows in site nav/search/sitemap. `unlisted` is reachable **only** by direct share link. |

Provenance columns (both features): `submitted_by uuid REFERENCES users(id)`,
`author_id uuid REFERENCES authors(id)`, `reviewed_by uuid`, `reviewed_at timestamptz`,
`rejection_reason text`, `share_token text` (unguessable id for unlisted URLs),
`published_at timestamptz`.

**Effective visibility matrix** (the single rule every read path enforces):

| status | audience | visibility | Shows in site lists/search/sitemap? | Reachable by share link? |
|--------|----------|------------|--------------------------------------|--------------------------|
| approved | professional | listed | ✅ (current behaviour) | ✅ |
| approved | public | listed | ✅ (in a "Public health" section) | ✅ |
| approved | public | **unlisted** | ❌ **never** | ✅ (only via `share_token`) |
| draft / pending / rejected | any | any | ❌ | ❌ (owner preview only) |

The same `status` + `submitted_by` + `reviewed_*` columns are added to `video_courses`
for the "publish your courses" half of Feature 1.

> Follows `.agent/skills/postgresql` — evolving business states use `TEXT + CHECK`
> (not native `ENUM`), FK columns get **explicit indexes**, `TIMESTAMPTZ` for time,
> and RLS is defense-in-depth on top of the app-layer filter.

### 2.1 Base migration (shared prerequisite for both features)

Create `supabase/migrations/<timestamp>_creator_platform.sql`:

```sql
-- ARTICLES: lifecycle + audience + provenance ------------------------------
ALTER TABLE articles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'professional';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'listed';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS author_id  uuid REFERENCES authors(id) ON DELETE SET NULL;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS share_token text UNIQUE;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- NOTE: existing rows default to status='approved' so nothing currently live disappears.
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_status_check;
ALTER TABLE articles ADD CONSTRAINT articles_status_check
  CHECK (status IN ('draft','pending','approved','rejected'));
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_audience_check;
ALTER TABLE articles ADD CONSTRAINT articles_audience_check
  CHECK (audience IN ('professional','public'));
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_visibility_check;
ALTER TABLE articles ADD CONSTRAINT articles_visibility_check
  CHECK (visibility IN ('listed','unlisted'));

CREATE INDEX IF NOT EXISTS idx_articles_status        ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_audience      ON articles(audience);
CREATE INDEX IF NOT EXISTS idx_articles_visibility    ON articles(visibility);
CREATE INDEX IF NOT EXISTS idx_articles_submitted_by  ON articles(submitted_by);
CREATE INDEX IF NOT EXISTS idx_articles_author_id     ON articles(author_id);
-- share_token: unique btree already created by UNIQUE; add partial for fast lookups
CREATE INDEX IF NOT EXISTS idx_articles_share_token   ON articles(share_token) WHERE share_token IS NOT NULL;

-- Backfill author_id from the legacy author-name string where possible
UPDATE articles a SET author_id = au.id
FROM authors au WHERE a.author_id IS NULL AND lower(a.author) = lower(au.name);

-- VIDEO COURSES: same moderation lifecycle ---------------------------------
ALTER TABLE video_courses ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
ALTER TABLE video_courses ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE video_courses ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES authors(id) ON DELETE SET NULL;
ALTER TABLE video_courses ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE video_courses ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE video_courses ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE video_courses DROP CONSTRAINT IF EXISTS video_courses_status_check;
ALTER TABLE video_courses ADD CONSTRAINT video_courses_status_check
  CHECK (status IN ('draft','pending','approved','rejected'));
CREATE INDEX IF NOT EXISTS idx_video_courses_status       ON video_courses(status);
CREATE INDEX IF NOT EXISTS idx_video_courses_submitted_by ON video_courses(submitted_by);
```

Author profile / link-in-bio columns are added in the Feature 1 migration (§2 of that doc).

### 2.2 RLS hardening (defense-in-depth)

The app layer is the real gate (backend uses the service-role client), but tighten the
public policy so a leaked anon key can't read unpublished/unlisted rows:

```sql
DROP POLICY IF EXISTS "Anyone can read articles" ON articles;
CREATE POLICY "Public can read published listed articles" ON articles
  FOR SELECT TO PUBLIC
  USING (status = 'approved' AND visibility = 'listed');
-- Unlisted + owner-preview + moderation reads all go through the service-role
-- backend, which bypasses RLS, so no extra anon policy is required for them.
```

---

## 3. The one rule every read path must follow

Because `supabaseAdmin` bypasses RLS, **application code is the enforcement point.**
Audit each of these and add the correct filter:

| Path | File | Required filter |
|------|------|-----------------|
| List articles | `backend/routes/articles.js` `GET /` | `.eq('status','approved').eq('visibility','listed')` (+ audience filter for section) |
| Featured | `GET /featured` | same |
| By tags | `GET /by-tags` | same |
| Tags facet | `GET /tags` | same |
| Related | `GET /:id/related` | same |
| Detail by id/slug | `GET /:idOrSlug` | serve only if `approved`; unlisted served **only** through the share-token route, not by slug |
| Search | `backend/routes/search.js` + Meili indexer | index **only** `approved && listed`; never index `unlisted` |
| Sitemap | `backend/routes/sitemap.js` | emit **only** `approved && listed`; never emit `unlisted` |

Add a shared helper `backend/utils/articleVisibility.js` exporting
`applyPublicArticleFilter(query)` and `PUBLIC_LISTED = { status:'approved', visibility:'listed' }`
so the rule lives in one place and can be unit-tested.

---

## 4. Rollout order (do these in sequence)

1. **Base migration** (§2.1) + **RLS hardening** (§2.2). Existing content defaults to
   `approved/professional/listed`, so the live site is unchanged.
2. **Harden every read path** (§3) + the `applyPublicArticleFilter` helper + tests.
   Ship this before any creator can submit, so unapproved content can never leak.
3. **Feature 1 backend** — creator submission endpoints, moderation endpoints, author profile.
4. **Feature 1 admin** — moderation queue pages (mirror `Verifications.tsx`).
5. **Feature 1 client** — creator dashboard, editors, public author/link-in-bio page.
6. **Feature 2 backend** — share-token route + server-rendered OG shell.
7. **Feature 2 client + admin** — audience/visibility controls, share UI.

---

## 5. Cross-cutting security & quality requirements

Grounded in the repo's own `.agent` skills — apply them, don't reinvent:

- **`.agent/skills/backend-security-coder` + `.agent/skills/frontend-security-coder`**
  - All user-authored HTML MUST pass `sanitizeContent` (`backend/middleware/inputSanitizer.js`)
    on write — same as `admin/routes/admin/articles.js` does today. Creators are less trusted
    than admins, so sanitize server-side on every create/update; never trust the client editor.
  - Enforce ownership on every mutation: `WHERE submitted_by = req.user.id`. A creator may
    only read/edit/delete **their own** draft/pending/rejected items, never others'.
  - Editing an `approved` item must flip it back to `pending` (re-review) — creators cannot
    silently change live content.
  - Reuse `uploadLimiter` / `aiLimiter` / `authLimiter` and `validateUploadedFile` for image
    and any media uploads; keep the 5 MB multer cap.
- **`.agent/skills/auth-implementation-patterns`** — reuse `authenticateUser`; add a small
  `requireVerifiedDoctor` guard (checks `req.user.role === 'doctor' && verificationStatus === 'approved'`)
  for professional-article and course submission.
- **`.agent/skills/api-design-principles`** — new creator routes live under a versioned,
  resource-oriented prefix `/api/me/*` (the authenticated user's own resources); admin
  moderation under `/api/admin/*` (mirrors existing structure). Use correct status codes
  (`201` create, `403` ownership/permission, `409` conflict) as the existing routes do.
- **`.agent/skills/postgresql` + `.agent/skills/sql-optimization-patterns`** — indexes as in
  §2.1; keep the `applyPublicArticleFilter` predicates index-friendly.
- **`.agent/skills/course-video-streaming`** — creator-submitted courses reuse the existing
  `video_courses` playback/billing model; a submitted course stays `status='pending'` and its
  signed playback URLs / per-minute billing are **only** wired up after approval.
- **Testing** (`.agent/skills/javascript-testing-patterns`, `e2e-testing-patterns`,
  `playwright-pro`): see the per-feature "Testing" sections. Minimum bar — a test proving an
  `unlisted` article never appears in list/search/sitemap, and a test proving a non-owner
  cannot read another creator's draft.

Continue to the two feature documents for endpoint-by-endpoint and screen-by-screen detail.