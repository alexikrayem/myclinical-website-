# Code Review — Efficiency of the Articles & Courses Flows

**Scope:** Read-only efficiency review of the Articles and Courses flows across the
`backend/` (Express + Supabase) and `client/` (React + Vite) packages.
**Goal:** Reduce redundant work (DB round-trips, network calls, re-renders, full-table
scans) **without changing behaviour or breaking functionality.**
**Method:** Static review guided by the repo's own `.agent/skills`
(`code-reviewer`, `sql-optimization-patterns`, `application-performance-*`).

> Every recommendation below is behaviour-preserving. Nothing here changes what the
> user sees or the access/billing rules — it only removes wasted work. Items are
> ordered by impact. Suggested code is illustrative, not a patch.

---

## Files reviewed

| Layer | Files |
|-------|-------|
| Backend routes | `backend/routes/articles.js`, `backend/routes/courses.js`, `backend/routes/admin/courses.js` |
| Backend services | `services/courses/courseCatalogService.js`, `courseAccessService.js`, `coursePlaybackService.js`, `courseBillingService.js` |
| Backend middleware/util | `middleware/cache.js`, `utils/queryFields.js` |
| Client hooks | `hooks/useArticles.ts` |
| Client pages/components | `pages/ArticlesPage.tsx`, `ArticleDetailPage.tsx`, `CoursesPage.tsx`, `CourseDetailPage.tsx`, `components/article/ArticleList.tsx`, `components/courses/SecureVideoPlayer.tsx` |

---

## Summary of findings

| # | Severity | Area | Issue | Est. win |
|---|----------|------|-------|----------|
| 1 | **High** | Client / Articles | `ArticleDetailPage` fires 2–3 redundant `checkArticleAccess` calls that duplicate data already in `getById` | −2 requests / article view |
| 2 | **High** | Backend / Courses | HLS `manifest` + `segment` routes run **2 sequential DB queries per request**; segment runs for *every* segment of a video | Big reduction on the hottest path |
| 3 | **High** | Client / Articles | No debounce on `ArticleList` search — one API request **per keystroke** (and hits `searchLimiter`) | Fewer requests + no rate-limit errors |
| 4 | **Med** | Backend / Articles | `/articles/:idOrSlug` checks access *before* the free short-circuit, so free articles run 2 needless queries; admin+access checks are sequential | −1 to −2 queries / detail view |
| 5 | **Med** | Backend / both | `/articles/tags`, `/articles/by-tags`, `courses/categories` do **full-table scans** and flatten in JS | Lower DB load, faster p95 |
| 6 | **Med** | Backend / Courses | `courses/featured` and `courses/categories` have **no cache**, unlike the articles equivalents | Cheap cache hits |
| 7 | **Med** | Client / Courses | `CoursesPage` re-fetches `featured` on every search/category change and doesn't use React Query | Fewer requests, cache reuse |
| 8 | **Med** | Backend / Courses | `getCourseAccessDetails` and `getApplicableTypedCredits` run sequential queries that can be parallelised | Lower latency on course detail |
| 9 | **Low** | Client / Courses | `CourseDetailPage` playback-refresh `useEffect` depends on the `playback` object, tearing down/recreating the timer each cycle | Stable timers |
| 10 | **Low** | Client / Articles | `ArticleList` recomputes `availableTags` from the current page only; per-item `animationDelay` inline styles | Minor |
| 11 | **Low** | Backend | Public list endpoints emit no `ETag`/`Cache-Control`, so browsers/CDN can't reuse responses | Offload to edge/browser |

---

## Detailed findings

### 1. [High] `ArticleDetailPage` makes redundant access/credit calls

**File:** `client/src/pages/ArticleDetailPage.tsx` (lines ~66–100)

`articlesApi.getById(id)` already returns `has_access`, `credits_required`,
`content`, and `is_preview` (see `backend/routes/articles.js` → `/:idOrSlug`
response payload). Yet the component then calls `creditsApi.checkArticleAccess`
**again for `requiresCredits` unconditionally**, and a second time when
`has_access` is undefined:

```ts
const data = await articlesApi.getById(id);          // already has has_access + credits_required
...
// Redundant: value is already on `data`
const accessData = await creditsApi.checkArticleAccess(articleId);
setRequiresCredits(accessData.credits_required || 0);
```

So each article view issues **3–4 sequential** requests (`getById` →
`checkArticleAccess` → `checkArticleAccess` → `getRelated`) where 2 would do.

**Recommendation (behaviour-preserving):** prefer the data already on `data`, and
only fall back to `checkArticleAccess` when the field is genuinely absent. Also run
`getRelated` in parallel with any remaining lookup instead of awaiting in series.

```ts
setHasAccess(data.has_access ?? false);
setRequiresCredits(data.credits_required ?? 0);
// only call checkArticleAccess if the API response lacks the field (legacy fallback)
const relatedData = await articlesApi.getRelated(articleId, 3); // fire in parallel
```

This keeps the fallback path intact for older API responses while eliminating the
duplicate calls on the common path.

---

### 2. [High] HLS manifest/segment routes do 2 sequential DB reads per request

**File:** `backend/routes/courses.js` (`GET /:id/hls/manifest`, `GET /:id/hls/segment`)

Both handlers do:

```js
const { data: session } = await supabaseAdmin.from('course_playback_sessions')...single();
// then, separately:
const { data: course } = await supabaseAdmin.from('video_courses')
  .select('playback_source, playback_provider').eq('id', id).single();
```

The **segment** endpoint is called for *every media segment* of a video (dozens to
hundreds of times per view), so this is the single hottest path in the courses flow —
and it pays for **two** round-trips each time. `playback_source`/`playback_provider`
are effectively immutable during a session.

**Recommendations (pick one, all behaviour-preserving):**

- **Cache the immutable course fields.** Store `playback_source` +
  `playback_provider` on the `course_playback_sessions` row at creation
  (`coursePlaybackService.createPlaybackSession` already fetches the course), then a
  single `session` read serves both checks. No second query.
- Or **join in one query**: select the session and embed the course via a Supabase
  FK relationship (`course:video_courses(playback_source, playback_provider)`).
- Or **short-TTL Redis cache** keyed by `course_id` for the provider/source pair
  (they only change on admin edit, which can invalidate the key).

Also add a small `Cache-Control: private, max-age=<segment-duration>` where the
security model allows, so the browser doesn't re-request identical signed segments.

---

### 3. [High] Article search fires a request per keystroke (no debounce)

**File:** `client/src/components/article/ArticleList.tsx` (lines ~48–58)

`searchTerm` feeds straight into `queryParams`, which is the React Query key:

```ts
const queryParams = useMemo(() => {
  const params = { limit };
  if (searchTerm) params.search = searchTerm;   // changes every keystroke
  return params;
}, [limit, selectedTags, searchTerm]);

const { data } = useArticles(isVisible ? queryParams : undefined);
```

Every character typed produces a new query key → a new network request to
`GET /articles?search=...`, which is wrapped in `searchLimiter` on the backend. Fast
typers will both hammer the DB and trip the rate limiter (surfacing as failed
searches). Note that `CoursesPage` **already** debounces by 500 ms — the articles
flow is simply inconsistent with it.

**Recommendation:** debounce the term before it becomes a query key (a small
`useDebouncedValue` hook, matching the 500 ms used in `CoursesPage`):

```ts
const debouncedSearch = useDebouncedValue(searchTerm, 500);
const queryParams = useMemo(() => {
  const params = { limit };
  if (debouncedSearch) params.search = debouncedSearch;
  ...
}, [limit, selectedTags, debouncedSearch]);
```

The input stays fully responsive (local `searchTerm` state is unchanged); only the
network call is throttled.

---

### 4. [Med] `/articles/:idOrSlug` runs access queries even for free articles

**File:** `backend/routes/articles.js` (`GET /:idOrSlug`, steps 3–4)

The free-content short-circuit runs **after** the access lookups:

```js
// 3. Check Access (2 sequential queries: admins, then article_access)
if (userId) {
  const { data: admin } = await supabaseAdmin.from('admins')...single();
  if (admin) hasAccess = true;
  else { const { data: access } = await supabaseAdmin.from('article_access')...single(); ... }
}
// 4. Free content check happens only here
if (article.credits_required === 0) hasAccess = true;
```

For a logged-in user reading a **free** article, that's two wasted queries. Two
behaviour-preserving fixes:

1. **Short-circuit first:** if `article.credits_required === 0`, set `hasAccess = true`
   and skip the admin/access lookups entirely.
2. **Parallelise** the remaining `admins` and `article_access` lookups with
   `Promise.all` instead of awaiting sequentially.

```js
if (article.credits_required === 0) {
  hasAccess = true;
} else if (userId) {
  const [{ data: admin }, { data: access }] = await Promise.all([
    supabaseAdmin.from('admins').select('id').eq('id', userId).maybeSingle(),
    supabaseAdmin.from('article_access').select('id')
      .eq('user_id', userId).eq('article_id', article.id).maybeSingle(),
  ]);
  hasAccess = Boolean(admin || access);
}
```

> Note: the handler also re-verifies the token via `supabasePublic.auth.getUser(token)`
> even though `optionalAuth` already populated `req.user`. Confirm `optionalAuth`
> can't resolve the user before paying for a second auth round-trip; if it can, this
> block is dead weight on every authenticated detail view.
> Also prefer `.maybeSingle()` over `.single()` for "may not exist" lookups to avoid
> `PGRST116` error objects being generated on the happy "no row" path.

---

### 5. [Med] Tag/category endpoints do full-table scans and flatten in JS

**Files:** `backend/routes/articles.js` (`/tags`, `/by-tags` fallback),
`backend/services/courses/courseCatalogService.js` (`getPublicCourseCategories`)

```js
// /tags — pulls the tags column for the ENTIRE table
const { data } = await supabasePublic.from('articles').select('tags');
const uniqueTags = [...new Set(data.flatMap(a => a.tags))].sort();
```

This reads every row just to compute a distinct list, and grows linearly with the
table. Same shape in `getPublicCourseCategories`.

**Recommendation:** push the distinct/unnest into Postgres and cache it. A small
`RPC`/SQL function returning distinct unnested tags is O(index) and returns a tiny
payload:

```sql
create or replace function distinct_article_tags()
returns table(tag text) language sql stable as $$
  select distinct unnest(tags) as tag from articles order by 1;
$$;
```

Then `supabase.rpc('distinct_article_tags')`, wrapped in `cacheMiddleware` (tags
change rarely — the client already treats them as 1-hour-stale in `useTags`). A GIN
index on `articles.tags` / `courses.categories` also makes the `.contains()` /
`.overlaps()` filters used elsewhere in these files index-backed.

---

### 6. [Med] `courses/featured` and `courses/categories` are uncached

**File:** `backend/routes/courses.js`

`GET /articles/featured` uses `cacheMiddleware(600)` and `/articles` uses
`cacheMiddleware(300)`, but the courses equivalents have **no cache**:

```js
router.get('/featured', asyncHandler(...));      // no cacheMiddleware
router.get('/categories', asyncHandler(...));     // no cacheMiddleware
```

These are read-mostly, unauthenticated, and change only on admin edits.

**Recommendation:** add `cacheMiddleware(600)` (featured) and `cacheMiddleware(300)`
(categories) to mirror the articles flow, and invalidate via the existing
`invalidateCachePattern('cache:/api/courses*')` from the admin create/update/delete
handlers in `admin/courses.js`. Behaviour is identical; cold DB hits drop sharply.

---

### 7. [Med] `CoursesPage` re-fetches featured on every search and bypasses React Query

**File:** `client/src/pages/CoursesPage.tsx` (lines ~38–64)

```ts
const [allCoursesData, featuredData] = await Promise.all([
  coursesApi.getAll({ search: searchQuery, category: activeCategory }),
  coursesApi.getFeatured()            // re-fetched on every keystroke/category change
]);
```

`featuredCourses` is only rendered when there is no search and no active category,
yet it's fetched on **every** change to either. The whole page also uses manual
`useState`/`useEffect`/`setTimeout` while the articles flow standardises on React
Query (`useArticles`), so there is no cross-navigation cache or dedup.

**Recommendations (behaviour-preserving):**

- Fetch `getFeatured()` **once on mount** (or only when `!searchQuery &&
  !activeCategory`), separate from the searchable list effect.
- Migrate the list to a `useCourses(params)` React Query hook mirroring
  `useArticles`, giving free caching, `staleTime`, and request dedup consistent with
  the articles flow.

---

### 8. [Med] Course access detail runs avoidable sequential queries

**File:** `backend/services/courses/courseAccessService.js`

`getCourseAccessDetails` awaits `getPublicCourseById`, then `course_access`, then
`getApplicableTypedCredits` — and `getApplicableTypedCredits` itself runs
`user_typed_credits` then `credit_type_courses` sequentially. For a logged-in user
on a `per_course` course this is up to 4 serial round-trips.

**Recommendation:** the course fetch and the `course_access` check for a logged-in
user don't depend on each other and can run with `Promise.all`. Inside
`getApplicableTypedCredits`, the two queries are dependent (the second needs the
first's ids) so keep them ordered, but the outer parallelisation still shaves a hop:

```js
const [course, accessRow] = await Promise.all([
  getPublicCourseById(supabasePublic, courseId),
  user ? supabaseAdmin.from('course_access').select('id')
           .eq('custom_user_id', user.id).eq('course_id', courseId).maybeSingle()
       : Promise.resolve({ data: null }),
]);
```

(Only apply the access read when `billing_model === 'per_course'`, preserving current
logic.)

---

### 9. [Low] Playback-refresh timer is rebuilt every cycle

**File:** `client/src/pages/CourseDetailPage.tsx` (lines ~210–231)

```ts
useEffect(() => {
  ...
  const timer = window.setInterval(refresh, 45_000);
  return () => window.clearInterval(timer);
}, [id, playbackSessionId, playback]);   // `playback` changes on every refresh
```

`refresh()` calls `setPlayback(result.playback)`, which changes the `playback`
dependency, which tears down and recreates the interval on every cycle. It works, but
the 45 s cadence effectively restarts each time and the effect churns.

**Recommendation:** depend on the stable `playback.type` (or a
`isStreamingRef`) rather than the whole object, so the interval is created once per
session:

```ts
}, [id, playbackSessionId, playback?.type]);
```

---

### 10. [Low] `ArticleList` micro-inefficiencies

**File:** `client/src/components/article/ArticleList.tsx`

- `availableTags` is derived only from the **current page** of articles, so the tag
  filter is incomplete and recomputed on every data change. If a global tag list is
  desired, reuse the `useTags()` hook (already cached 1 h) instead.
- Per-item `style={{ animationDelay: `${index * 0.1}s` }}` forces inline style
  objects for every card on every render; for long lists prefer a CSS
  `nth-child`/class-based stagger.

Both are minor and cosmetic to performance; list them for completeness.

---

### 11. [Low] No HTTP caching headers on public list endpoints

**Files:** `backend/routes/articles.js`, `backend/routes/courses.js`

Redis caching is in place, but responses carry no `ETag` / `Cache-Control`, so every
navigation still hits the origin even when nothing changed. Adding
`Cache-Control: public, max-age=60, stale-while-revalidate=300` (plus `ETag`) to the
unauthenticated list/featured/tags endpoints lets browsers and any CDN serve repeats
for free. Keep `no-store` on the authenticated/playback endpoints (already correct on
the HLS routes).

---

## Cross-cutting observations

- **Consistency:** the articles flow uses React Query with sensible `staleTime`s; the
  courses flow (`CoursesPage`, `CourseDetailPage`) uses hand-rolled
  `useState`/`useEffect`. Standardising courses on React Query (findings #3, #7)
  would remove most of the manual fetch/debounce/caching code and its bugs.
- **Sequential vs parallel:** several backend handlers `await` independent Supabase
  calls in series (#4, #8, #1). `Promise.all` for independent reads is the cheapest,
  lowest-risk win across the board.
- **Hot-path awareness:** the HLS segment endpoint (#2) and the per-minute heartbeat
  path dominate request volume during playback — optimise those before the
  once-per-view handlers.
- **Indexes:** confirm GIN indexes exist on `articles.tags` and
  `courses_public.categories` (used by `.contains()`/`.overlaps()`), and a btree on
  the `publication_date` ordering column. This review can't read the live schema; the
  `sql-optimization-patterns` skill's `EXPLAIN ANALYZE` step is the right verification.

---

## Suggested sequencing (low-risk → higher-effort)

1. **#1, #3** — client-only, no API contract change, immediate request reduction.
2. **#4, #6, #8** — backend query reordering / caching, behaviour-preserving.
3. **#2** — hottest path; needs a small session-schema or caching change, so verify
   with the existing `__tests__/unit/coursePlaybackService.test.js` and
   `client/e2e/courses.spec.ts` after.
4. **#5, #11** — DB function + headers; verify with `EXPLAIN ANALYZE`.
5. **#7, #9, #10** — client refactors for consistency.

## How to verify nothing broke

- Backend: `backend/__tests__/articles.test.js`, `courses.test.js`,
  `courses_extended.test.js`, and `__tests__/unit/course*.test.js` already cover these
  flows — run them after each change.
- Client E2E: `client/e2e/articles.spec.ts` and `client/e2e/courses.spec.ts`.
- Manual: confirm free vs paid article gating, per-course purchase, and per-minute
  playback billing still behave identically.
