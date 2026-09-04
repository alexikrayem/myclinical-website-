# Creator platform deployment

Apply `supabase/migrations/20260812000000_creator_platform.sql` before deploying the API and SPAs. It backfills existing articles as `approved`, `professional`, and `listed`, so existing public content remains public.

The public site/proxy must send a first request for `/p/:token` to the backend. The backend returns the escaped Open Graph/Twitter HTML shell and redirects real browsers to `/p/:token?v=app`; requests with `v=app` must be served by the Vite SPA fallback. Register the backend `/p/*` route before that fallback. Never route `/p/*` directly to the SPA, since crawlers do not run React and would miss the share metadata.

The `/p/:token` shell and `/api/articles/shared/:token` both set `noindex`. Do not add these URLs to navigation, sitemap, author grids, or search indexing.
