import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const query = "hello world";
  // FTS using wfts (websearch)
  const { data, error } = await supabase.from('articles').select('id, title').or(`title.wfts."${query}",excerpt.wfts."${query}"`).limit(1);
  console.log('wfts result error?', error?.message || 'success');
  console.log('wfts result data length:', data?.length);

  // FTS using plainto_tsquery
  const { data: d2, error: e2 } = await supabase.from('articles').select('id, title').or(`title.plfts."${query}",excerpt.plfts."${query}"`).limit(1);
  console.log('plfts result error?', e2?.message || 'success');
  
  // Custom ftsQuery
  const ftsQuery = "hello:* | world:*";
  const { data: d3, error: e3 } = await supabase.from('articles').select('id, title').or(`title.fts."${ftsQuery}",excerpt.fts."${ftsQuery}"`).limit(1);
  console.log('fts result error?', e3?.message || 'success');
}

run();
