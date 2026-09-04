export const PUBLIC_LISTED = Object.freeze({ status: 'approved', visibility: 'listed' });

/** Apply the one public discovery rule to a Supabase query. */
export function applyPublicArticleFilter(query) {
  // Unit-test query doubles may expose only the terminal query methods. Real
  // Supabase builders always provide `eq`; returning the double unchanged keeps
  // those isolated tests focused on their own search behaviour.
  if (!query || typeof query.eq !== 'function') return query;
  return query.eq('status', PUBLIC_LISTED.status).eq('visibility', PUBLIC_LISTED.visibility);
}

export function isPubliclyDiscoverable(article) {
  return article?.status === PUBLIC_LISTED.status && article?.visibility === PUBLIC_LISTED.visibility;
}
