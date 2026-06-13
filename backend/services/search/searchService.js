import { searchIndex, isMeiliEnabled } from './meiliClient.js';
import { normalizeQuery } from './normalize.js';
import logger from '../../config/logger.js';

function escapeFilterValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function buildFilterString(filters = {}) {
  const parts = [];
  for (const [field, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (!value.length) continue;
      const escaped = value.map(item => `"${escapeFilterValue(item)}"`).join(', ');
      parts.push(`${field} IN [${escaped}]`);
      continue;
    }
    if (typeof value === 'boolean' || typeof value === 'number') {
      parts.push(`${field} = ${value}`);
      continue;
    }
    parts.push(`${field} = "${escapeFilterValue(value)}"`);
  }
  return parts.length ? parts.join(' AND ') : undefined;
}

export async function meiliSearch(indexName, query, { page = 1, limit = 12, filters = {} } = {}) {
  if (!isMeiliEnabled()) return null;
  try {
    const offset = (page - 1) * limit;
    const filter = buildFilterString(filters);
    const normalizedQuery = normalizeQuery(query);
    return await searchIndex(indexName, normalizedQuery, {
      limit,
      offset,
      filter,
      showRankingScore: true
    });
  } catch (error) {
    logger.error(`Meilisearch query failed for ${indexName}:`, error);
    return null;
  }
}

export function orderByIdList(items, ids) {
  const map = new Map(items.map(item => [item.id, item]));
  return ids.map(id => map.get(id)).filter(Boolean);
}

export function getHitScore(hit, rankIndex = 0) {
  if (typeof hit?._rankingScore === 'number') return hit._rankingScore;
  if (typeof hit?.rankingScore === 'number') return hit.rankingScore;
  return 1 / (rankIndex + 1);
}
