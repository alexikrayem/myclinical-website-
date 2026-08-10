# Feature 1 — Creator accounts, submissions & link-in-bio

> Read [`README.md`](./README.md) first — it defines the shared data model (§2), the
> single visibility rule (§3), rollout order (§4), and security requirements (§5) that
> this document assumes.

## Goal

A logged-in user can:

1. Open a **personal account (creator) page** — a dashboard of their own content.
2. **Write articles** and **submit courses**.
3. Everything is **sent to the site admins**; only after **approval** does it go live.
4. Their account page also works as a **public link-in-bio** profile that lays out who
   they are and links to their published work + external socials.

Modeling: submissions ride the shared `articles` / `video_courses` lifecycle
(`status = draft → pending → approved → rejected`) and reuse the doctor-verification
moderation pattern (`backend/routes/admin/verifications.js`).

---

## 1. Who can submit what

| Content | Requirement | Rationale |
|---------|-------------|-----------|
| Professional article (`audience='professional'`) | logged-in **and** `role='doctor'` **and** `verification_status='approved'` | dental peer content must come from verified professionals (matches current author/verification model) |
| Public-health article (`audience='public'`) | logged-in (any verified creator; policy configurable) | see [Feature 2](./02-unlisted-public-articles.md) |
| Course | logged-in **and** verified doctor | courses are premium/billed content |

Add a guard `backend/middleware/requireCreator.js`:

```js
// requireVerifiedDoctor: gate professional submissions & courses.
export const requireVerifiedDoctor = (req, res, next) => {
  if (req.user?.role === 'doctor' && req.user?.verificationStatus === 'approved') return next();
  return res.status(403).json({
    error: 'يتطلب النشر حساب طبيب موثّق',
    code: 'CREATOR_NOT_VERIFIED'
  });
};
```

`req.user.role` / `req.user.verificationStatus` are already populated by
`authenticateUser` (`backend/middleware/userAuth.js`). Users who aren't verified doctors
see a CTA to the existing **doctor verification** flow (`register-doctor`).

---

## 2. Data model — author profile / link-in-bio

The base migration (README §2.1) already added `status`, `submitted_by`, `author_id`,
`reviewed_*`, `rejection_reason`. Add profile fields to `authors` in
`supabase/migrations/<timestamp>_author_profiles.sql`:

```sql
ALTER TABLE authors ADD COLUMN IF NOT EXISTS slug text UNIQUE;          -- link-in-bio: /u/:slug
ALTER TABLE authors ADD COLUMN IF NOT EXISTS headline text;             -- short tagline
ALTER TABLE authors ADD COLUMN IF NOT EXISTS avatar_url text;           -- replaces default pexels image
ALTER TABLE authors ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(social_links) = 'object');                        -- {instagram,facebook,x,linkedin,website,...}
ALTER TABLE authors ADD COLUMN IF NOT EXISTS is_profile_public boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_authors_slug ON authors(slug) WHERE slug IS NOT NULL;

-- Backfill slugs for existing authors (reuse the article slug generator style)
UPDATE authors SET slug = lower(regexp_replace(name, '[^\u0621-\u064Aa-z0-9]+', '-', 'g'))
WHERE slug IS NULL;
```

> An `authors` row is created automatically today when an admin approves a doctor
> (`verifications.js`). That row is the creator's profile; the account page edits it, and
> the link-in-bio page renders it. Non-doctor "public health" creators who don't have an
> `authors` row yet get one created on first submission (name = `users.display_name`).

---

## 3. Backend — creator ("my content") API

New router `backend/routes/me.js`, mounted in `backend/server.js`:

```js
import meRoutes from './routes/me.js';
app.use('/api/me', meRoutes); // all routes behind authenticateUser
```

All routes use `authenticateUser`; write routes reuse `uploadLimiter`,
`validateUploadedFile`, and `sanitizeContent` exactly like `admin/routes/admin/articles.js`.

### 3.1 Profile (link-in-bio owner side)

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/me/profile` | returns the creator's `authors` row (create-on-read if missing) + submission stats |
| `PUT` | `/api/me/profile` | update `headline`, `bio`, `avatar_url`, `social_links`, `is_profile_public`, `slug` (validate slug uniqueness & charset) |
| `POST` | `/api/me/profile/avatar` | multipart image → `uploadToSupabase(file,'images')` (reuse `backend/routes/admin/utils.js`) |

`social_links` is validated server-side to an allow-list of known keys
(`instagram, facebook, x, tiktok, youtube, linkedin, website`) and each value must be a
valid `https://` URL — prevents `javascript:` injection into the public bio page
(`.agent/skills/frontend-security-coder`).

### 3.2 Articles

| Method | Path | Behaviour |
|--------|------|-----------|
| `GET` | `/api/me/articles` | list **only** `submitted_by = req.user.id` (all statuses) |
| `POST` | `/api/me/articles` | create as `status='draft'`; `submitted_by=req.user.id`; `author_id` = creator's author row; `sanitizeContent` on `content`/`excerpt`; generate `slug` |
| `PUT` | `/api/me/articles/:id` | **ownership check** `submitted_by=req.user.id`; if current `status='approved'` → set back to `pending` (re-review) |
| `POST` | `/api/me/articles/:id/submit` | `draft`/`rejected` → `pending`; clears `rejection_reason` |
| `DELETE` | `/api/me/articles/:id` | ownership check; only when not `approved` (or soft-delete) |

Professional articles require `requireVerifiedDoctor`; enforce
`audience` from body against the caller's permissions (README §2).

### 3.3 Courses

Mirror the article endpoints under `/api/me/courses`, writing to `video_courses` with
`status='pending'` on submit. Reuse the provider/billing validation helpers already in
`backend/routes/admin/courses.js` (`normalizePlaybackProvider`, `normalizeBillingModel`,
`assertProviderCapabilities`, `parseMuxPlaybackSource`) — extract them into
`backend/services/courses/courseValidation.js` so both admin and creator routes share one
implementation (`.agent/skills/course-video-streaming`).

> Playback signing and per-minute billing stay disabled until approval; a `pending` course
> is never returned by the public `GET /api/courses` list.

### 3.4 Public author profile (link-in-bio, read side)

Add to `backend/routes/authors.js`:

| Method | Path | Behaviour |
|--------|------|-----------|
| `GET` | `/api/authors/by-slug/:slug` | public profile if `is_profile_public` — returns author fields, `social_links`, and their **approved + listed** articles/courses (via `applyPublicArticleFilter`). Unlisted items are **never** listed here. |

---

## 4. Backend — admin moderation API

New router `backend/routes/admin/submissions.js`, mounted in `backend/routes/admin.js`:

```js
import submissionRoutes from './admin/submissions.js';
router.use('/submissions', submissionRoutes); // authenticateToken (admin)
```

Directly mirrors `admin/routes/admin/verifications.js`:

| Method | Path | Behaviour |
|--------|------|-----------|
| `GET` | `/api/admin/submissions?type=article\|course&status=pending` | moderation queue with submitter (`users`) + author info |
| `GET` | `/api/admin/submissions/article/:id` | full item for review (raw content, submitter, history) |
| `POST` | `/api/admin/submissions/article/:id/approve` | `status='approved'`, `published_at=now()`, `reviewed_by`, `reviewed_at`; then `indexArticle(...)` + `invalidateCachePattern('cache:/api/articles*')` |
| `POST` | `/api/admin/submissions/article/:id/reject` | requires `rejection_reason` (like verifications); `status='rejected'` — **never** indexed |
| same | `/api/admin/submissions/course/:id/(approve\|reject)` | same for `video_courses` (`indexCourse`) |

Approval side-effects to copy from existing admin article/course create:
`indexArticle`/`indexCourse` (search) and `invalidateCachePattern`. **On reject or
un-approve, call `removeArticle`/`removeCourse`** so rejected content leaves the index.

---

## 5. Client (`client/`) — creator dashboard & public profile

### 5.1 Routing (`client/src/App.tsx`)

```tsx
const AccountPage       = lazy(() => import('./pages/account/AccountPage'));       // dashboard
const ArticleEditorPage = lazy(() => import('./pages/account/ArticleEditorPage'));
const CourseSubmitPage  = lazy(() => import('./pages/account/CourseSubmitPage'));
const AuthorProfilePage = lazy(() => import('./pages/AuthorProfilePage'));         // public link-in-bio
// ...
<Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
<Route path="/account/articles/new" element={<RequireAuth><ArticleEditorPage /></RequireAuth>} />
<Route path="/account/articles/:id/edit" element={<RequireAuth><ArticleEditorPage /></RequireAuth>} />
<Route path="/account/courses/new" element={<RequireAuth><CourseSubmitPage /></RequireAuth>} />
<Route path="/u/:slug" element={<AuthorProfilePage />} />  {/* public bio link */}
```

Add a small `RequireAuth` wrapper using `useAuth()` (`client/src/context/AuthContext.tsx`),
redirecting unauthenticated users to `/login`. Add an "حسابي / لوحة الكاتب" entry to
`client/src/components/auth/UserMenu.tsx`.

### 5.2 Account dashboard (`/account`)

- Tabs: **Articles**, **Courses**, **Profile**.
- Each submission row shows a **status badge** (`draft`/`pending`/`approved`/`rejected`)
  and, when rejected, the admin's `rejection_reason` with an "Edit & resubmit" action.
- "Verify as doctor" banner if `role !== 'doctor'` or `verification_status !== 'approved'`,
  linking to the existing doctor-registration flow.
- Data via SWR against `/api/me/*` (add methods to `client/src/lib/api.ts`).

### 5.3 Editor

Reuse a rich-text editor consistent with the admin one
(`admin/src/components/editor/RichTextEditor.tsx`). The editor sets `audience`
(professional vs public) and, for public, the `visibility` toggle from
[Feature 2](./02-unlisted-public-articles.md). Client sanitizes for preview, but the
**server is authoritative** (`sanitizeContent`).

### 5.4 Public link-in-bio page (`/u/:slug`)

- Header: avatar, name, `headline`, specialization, verified badge.
- Social buttons from `social_links` (render only allow-listed `https` links,
  `rel="noopener noreferrer nofollow"`).
- Grid of the creator's **approved + listed** articles/courses (from
  `/api/authors/by-slug/:slug`).
- "Share my page" using existing `client/src/components/article/ShareButtons.tsx`.
- Because this is a stable, intentionally-public URL, give it OG tags via the same
  server-rendered shell mechanism described in Feature 2 §4 (so the bio link previews
  nicely on socials).

---

## 6. Admin panel (`admin/`) — moderation UI

Mirror the verification screens:

- `admin/src/pages/Submissions.tsx` — queue (copy structure from
  `admin/src/pages/Verifications.tsx`), filter by type/status, approve / reject-with-reason.
- `admin/src/services/submissionService.ts` — copy `verificationService.ts`.
- Add a **"Submissions"** item to `admin/src/components/layout/Sidebar.tsx` with a
  pending-count badge.
- Reviewers see the fully rendered article/course exactly as it will publish before approving.

---

## 7. Testing (per README §5)

- **Unit** (`backend/__tests__`): `applyPublicArticleFilter`; ownership guard rejects
  cross-user edits (`submitted_by` mismatch → 403); editing an approved article resets it
  to `pending`; `requireVerifiedDoctor` gating.
- **Integration**: submit → appears in `/api/admin/submissions?status=pending`; approve →
  appears in public `GET /api/articles` and is Meili-indexed; reject → stays hidden and is
  removed from the index.
- **E2E** (`client/e2e`, `admin/e2e` with `.agent/skills/playwright-pro`): creator writes &
  submits an article; admin approves; article becomes publicly visible; link-in-bio page
  lists it and loads for an anonymous visitor.

## 8. Definition of done

- [ ] Base + author-profile migrations applied; existing content still `approved/listed`.
- [ ] `/api/me/*` creator API with ownership + verified-doctor guards and server-side sanitize.
- [ ] `/api/admin/submissions/*` approve/reject mirrors verification flow, with index + cache side-effects.
- [ ] Creator dashboard, editor, and `/u/:slug` link-in-bio page shipped.
- [ ] Admin Submissions queue shipped.
- [ ] Tests from §7 green.
