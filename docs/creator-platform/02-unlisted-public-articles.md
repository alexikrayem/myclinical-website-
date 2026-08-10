# Feature 2 — Unlisted public-health articles (social-share only)

> Read [`README.md`](./README.md) first — it defines the shared data model (§2), the
> single visibility rule (§3), and security requirements (§5) this document assumes.

## Goal

The main site is for **dental professionals**; its articles are peer content, not meant
for the general public. This feature lets a creator write an article aimed at **ordinary
readers** (e.g. "ways to improve your oral health") and share it **only via a link** on
social media — Facebook posts, Instagram stories/bio, carousels — such that:

1. The article opens from a shareable link and reads well with a rich preview card.
2. It is **not discoverable through the main website**: absent from listings, search,
   tags, related, sitemap, and the professional feed. You can only reach it if you have
   the link.

Modeling: `audience='public'` + `visibility='unlisted'` on the shared `articles`
lifecycle, reached only through an unguessable `share_token` (README §2).

---

## 1. The discoverability contract

An `audience='public' && visibility='unlisted'` article, once `status='approved'`, is:

| Surface | Behaviour |
|---------|-----------|
| `GET /api/articles` (list) | **excluded** (`applyPublicArticleFilter` filters `visibility='listed'`) |
| `GET /api/articles/featured`, `/by-tags`, `/tags`, `/:id/related` | **excluded** |
| `GET /api/articles/:idOrSlug` (by id or slug) | **excluded** — returns 404, so guessing a slug fails |
| Search (`/api/search`, Meili index) | **never indexed** — the indexer skips `unlisted` |
| Sitemap (`backend/routes/sitemap.js`) | **never emitted**, and served with `X-Robots-Tag: noindex` |
| Author link-in-bio (`/u/:slug`) | **excluded** from the public grid (owner sees it in `/account`) |
| Share link `/p/:share_token` | ✅ **the only way in** |

`share_token` is a high-entropy id (e.g. `crypto.randomUUID()` or 22-char base62),
generated on creation. Because access is by token only, **there is no server-side
authorization on the share route** — possession of the link is the grant (same trust model
as an unlisted YouTube video). That's why the token must be unguessable and the route must
send `noindex`.

---

## 2. Data & backend

`audience`, `visibility`, `share_token` already exist from the base migration (README §2.1).

### 2.1 Creator sets audience/visibility

In `/api/me/articles` (Feature 1 §3.2), accept `audience` and `visibility` from the body:

- `audience='public'` + `visibility='unlisted'` → generate `share_token` if absent.
- Validate combinations: `unlisted` is only allowed with `audience='public'`
  (professional content is always listed). Reject other combos with `400`.

### 2.2 Public share route (JSON API)

Add to `backend/routes/articles.js`:

```js
// Reached ONLY by direct share token. No auth. Never lists.
router.get('/shared/:token', optionalAuth, asyncHandler(async (req, res) => {
  const { data: article, error } = await supabaseAdmin
    .from('articles')
    .select(ARTICLE_DETAIL_SELECT)
    .eq('share_token', req.params.token)
    .eq('status', 'approved')
    .eq('visibility', 'unlisted')
    .single();
  if (error || !article) throw new NotFoundError('Article not found');
  // Public-health articles are free to read: ignore credits_required gating here.
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.json({ ...article, is_shared: true });
}));
```

> Public-health articles bypass the `credits_required` paywall used for professional
> articles in `GET /:idOrSlug` — the whole point is frictionless public reading.

### 2.3 Enforce exclusion everywhere (README §3)

Apply `applyPublicArticleFilter` (which pins `visibility='listed'`) to **every** list/detail/
search/sitemap path. Add an explicit test that a known `unlisted` article returns 404 from
`GET /api/articles/:slug` and is absent from `GET /api/articles`, `/api/search`, and the
sitemap. In the Meili indexer (`backend/services/search/indexer.js`), guard `indexArticle`
to no-op (and `removeArticle`) when `visibility !== 'listed' || status !== 'approved'`.

---

## 3. Client — reading & authoring

### 3.1 Reader route

`client/src/App.tsx`:

```tsx
const SharedArticlePage = lazy(() => import('./pages/SharedArticlePage'));
<Route path="/p/:token" element={<SharedArticlePage />} />
```

`SharedArticlePage` fetches `/api/articles/shared/:token`, renders the article in a clean,
**general-public** reading layout (larger type, no professional jargon chrome, no
credit/paywall UI, no "related professional articles"). Include prominent
`ShareButtons.tsx`. Add `<meta name="robots" content="noindex">` client-side too (belt and
braces; the real signal is the server header/shell in §4).

> Do **not** add `/p/:token` links anywhere in site navigation, the homepage, or the author
> grid. The URL exists only to be pasted into social posts / Instagram bio.

### 3.2 Authoring UX

In the creator editor (Feature 1 §5.3), when the creator picks **audience = "General public"**:

- Show a **visibility** choice: *Listed in a public-health section* vs
  *Unlisted (share by link only)*.
- After approval, surface the canonical share URL `https://<site>/p/<share_token>` with
  copy-to-clipboard + direct "Share to Facebook / X / WhatsApp" buttons and a
  "Copy for Instagram bio" helper (Instagram feed posts/carousels aren't clickable, so the
  UX guides them to put the link in **bio or stories**).

---

## 4. Social preview cards — the SSR requirement (critical)

`client/` is a **client-side-rendered Vite SPA** (`README.md` §1.5). Facebook, X/Twitter,
WhatsApp, and LinkedIn crawlers **do not run JavaScript**, so `<meta property="og:*">` tags
injected by React are invisible — shared links would show a blank/wrong preview. The link
still *works* for humans, but previews are the whole point of social sharing, so we must
**server-render the meta tags** for `/p/:token`.

**Chosen approach — a backend HTML shell for share URLs** (lowest-friction; the backend
already serves non-API HTML/XML via `backend/routes/sitemap.js` mounted at `/`):

1. Add `backend/routes/share.js`, mounted at `/` in `server.js`, handling `GET /p/:token`.
2. Look up the article by `share_token` (approved + unlisted). If not found → 404.
3. Return a minimal HTML document containing:
   - `<title>` and `<meta name="description">` from the article excerpt.
   - Open Graph: `og:title`, `og:description`, `og:image` (`cover_image`), `og:type=article`,
     `og:url` (canonical `/p/:token`), `og:locale=ar_AR`.
   - Twitter card: `twitter:card=summary_large_image`, `twitter:title/description/image`.
   - `<meta name="robots" content="noindex, nofollow">` and header `X-Robots-Tag: noindex`.
   - A `<script>` that redirects real browsers into the SPA route (or inlines enough to
     hydrate), while crawlers just read the static tags.

   ```html
   <!doctype html><html lang="ar" dir="rtl"><head>
     <meta charset="utf-8">
     <title>{{title}} — MyClinical</title>
     <meta name="description" content="{{excerpt}}">
     <meta name="robots" content="noindex, nofollow">
     <meta property="og:type" content="article">
     <meta property="og:title" content="{{title}}">
     <meta property="og:description" content="{{excerpt}}">
     <meta property="og:image" content="{{cover_image}}">
     <meta property="og:url" content="{{siteUrl}}/p/{{token}}">
     <meta name="twitter:card" content="summary_large_image">
   </head><body>
     <script>location.replace('/p/{{token}}?v=app')</script>
     <noscript>… server-rendered article body for no-JS readers …</noscript>
   </body></html>
   ```

   **Escape every interpolated value** (`title`, `excerpt`, `cover_image`) for HTML-attribute
   context to prevent injection via article content (`.agent/skills/frontend-security-coder`).
   Use the SPA route (`?v=app`) or a `User-Agent`/`?v=app` check to avoid an infinite
   shell→shell loop.

**Routing precedence:** in whatever serves the SPA in production (static host / reverse
proxy), `GET /p/:token` **without** the `?v=app` marker must hit the backend shell, while
the in-app navigation uses the SPA route. If the SPA is served by the same Express process,
register `share.js` **before** the SPA catch-all. Document the exact rule for the deploy
target being used.

> Alternative if a full SSR/prerender layer (e.g. Vercel/Next migration or a prerender
> service) is later adopted: render OG tags there instead and drop the shell. The data
> contract (`/api/articles/shared/:token`) stays identical.

The same shell can serve the **link-in-bio** page (Feature 1 §5.4) at `/u/:slug` so profile
links also preview well — but that page is intentionally public/indexable, so omit the
`noindex` for it.

---

## 5. Admin moderation

Public-health submissions flow through the **same** `/api/admin/submissions` queue
(Feature 1 §4). The moderation card must clearly flag `audience=public` and
`visibility=unlisted` so reviewers judge it by **general-public** standards (accuracy,
no misleading health claims, plain language) rather than clinical-peer standards. Approval
generates `published_at` and confirms the `share_token`; the item is **still not indexed**
(the indexer skips unlisted), so approving it cannot leak it into search.

---

## 6. Testing (per README §5)

- **Unit/Integration** (`backend/__tests__`):
  - An `approved` `unlisted` article is **absent** from `GET /api/articles`, `/featured`,
    `/by-tags`, `/tags`, `/:id/related`, `/api/search`, and the sitemap.
  - `GET /api/articles/:slug` for an unlisted article returns **404** (slug guessing fails).
  - `GET /api/articles/shared/:validToken` returns it; a wrong token returns 404.
  - `indexArticle` is a no-op for unlisted content.
  - Share route sends `X-Robots-Tag: noindex`.
- **Backend shell**: `GET /p/:token` returns HTML with correctly escaped OG tags and
  `noindex`; a bad token returns 404.
- **E2E** (`.agent/skills/playwright-pro`): create → approve a public/unlisted article;
  confirm it never appears in site search/listing; open the `/p/:token` link directly and
  read it; assert the OG meta are present in the server response
  (fetch the URL as a crawler `User-Agent`).

## 7. Definition of done

- [ ] Creator can mark an article `audience=public` + `visibility=unlisted`; a `share_token` is minted.
- [ ] Approved unlisted articles are provably absent from all discovery surfaces (tests in §6).
- [ ] `/api/articles/shared/:token` serves unlisted content free of the paywall, with `noindex`.
- [ ] `/p/:token` returns a server-rendered HTML shell with correct, escaped OG/Twitter tags.
- [ ] Client reader page + social-share UI (incl. "copy for Instagram bio") shipped.
- [ ] Admin queue flags public/unlisted submissions distinctly.
