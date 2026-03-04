import { MeiliSearch } from 'meilisearch';
import { SEARCH_INDEXES } from './searchConfig.js';

let clientInstance = null;
let initPromise = null;

export function isMeiliEnabled() {
  return (
    process.env.SEARCH_PROVIDER === 'meilisearch' &&
    !!process.env.MEILI_URL &&
    !!process.env.MEILI_MASTER_KEY
  );
}

export function getMeiliClient() {
  if (!isMeiliEnabled()) return null;
  if (!clientInstance) {
    clientInstance = new MeiliSearch({
      host: process.env.MEILI_URL,
      apiKey: process.env.MEILI_MASTER_KEY
    });
  }
  return clientInstance;
}

function isIndexNotFound(error) {
  return (
    error?.code === 'index_not_found' ||
    error?.errorCode === 'index_not_found' ||
    error?.statusCode === 404
  );
}

async function ensureIndex(client, config) {
  let index;
  try {
    index = await client.getIndex(config.name);
  } catch (error) {
    if (!isIndexNotFound(error)) throw error;
    const task = await client.createIndex(config.name, { primaryKey: config.primaryKey });
    await client.waitForTask(task.taskUid);
    index = client.index(config.name);
  }

  if (config.settings) {
    const task = await index.updateSettings(config.settings);
    await client.waitForTask(task.taskUid);
  }

  return index;
}

export async function ensureMeiliIndexes() {
  if (!isMeiliEnabled()) return false;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const client = getMeiliClient();
    const configs = Object.values(SEARCH_INDEXES);
    for (const config of configs) {
      await ensureIndex(client, config);
    }
    return true;
  })();

  return initPromise;
}

export async function searchIndex(indexName, query, options = {}) {
  if (!isMeiliEnabled()) return null;
  const client = getMeiliClient();
  await ensureMeiliIndexes();
  const index = client.index(indexName);
  return index.search(query, options);
}
