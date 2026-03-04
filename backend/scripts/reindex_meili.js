import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  indexArticlesBatch,
  indexResearchBatch,
  indexCoursesBatch
} from '../services/search/indexer.js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 500;

async function reindexTable(table, select, indexBatch, orderBy = 'created_at') {
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderBy, { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    await indexBatch(data);
    offset += data.length;
    if (data.length < BATCH_SIZE) break;
  }
}

async function run() {
  console.log('Starting Meilisearch reindex...');

  await reindexTable(
    'articles',
    'id, title, excerpt, content, author, tags, is_featured, article_type, publication_date, created_at',
    indexArticlesBatch
  );

  await reindexTable(
    'researches',
    'id, title, abstract, journal, authors, publication_date, created_at',
    indexResearchBatch
  );

  await reindexTable(
    'video_courses',
    'id, title, description, author, categories, is_featured, level, rating, publication_date, created_at',
    indexCoursesBatch
  );

  console.log('Meilisearch reindex complete.');
}

run().catch(error => {
  console.error('Reindex failed:', error);
  process.exit(1);
});
