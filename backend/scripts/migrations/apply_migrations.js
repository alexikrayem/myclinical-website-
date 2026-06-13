import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONNECTION_STRING = 'postgresql://postgres.nzocrdpkwkiatjabokna:Theeasyhard001999@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';
const MIGRATIONS_DIR = path.join(__dirname, '../supabase/migrations');

// List of migrations already run (simulated/hardcoded if needed, or we just trust the DB error)
// Ideally we should check a schema_migrations table, but Supabase standard table is `supabase_migrations.schema_migrations`
// which we might not have access to or might be tricky.
// We will just try to run them and fix idempotency issues.

async function runMigrations() {
    const client = new Client({
        connectionString: CONNECTION_STRING,
        ssl: { rejectUnauthorized: false } // Required for Supabase
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql'))
            .sort(); // Chronological order

        console.log(`Found ${files.length} migration files.`);

        for (const file of files) {
            console.log(`\n--- Processing ${file} ---`);
            const filePath = path.join(MIGRATIONS_DIR, file);
            const sql = fs.readFileSync(filePath, 'utf8');

            try {
                await client.query('BEGIN');
                await client.query(sql);
                await client.query('COMMIT');
                console.log(`✅ Successfully applied ${file}`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`❌ Error executing ${file}:`);
                console.error(err.message);
                // We stop on first error to fix it
                process.exit(1);
            }
        }

        console.log('\nAll migrations applied successfully! 🎉');
    } catch (err) {
        console.error('Database connection error:', err);
    } finally {
        await client.end();
    }
}

runMigrations();
