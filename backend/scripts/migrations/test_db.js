import pg from 'pg';
const { Client } = pg;

const connStr1 = 'postgresql://postgres.nzocrdpkwkiatjabokna:Theeasyhard001999@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';
const connStr2 = 'postgresql://postgres.nzocrdpkwkiatjabokna:Theeasyhard001999@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';

async function testConn(connStr, name) {
    console.log(`Testing connection for ${name}...`);
    const client = new Client({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await client.connect();
        console.log(`Success connecting to ${name}`);
        const res = await client.query('SELECT NOW()');
        console.log(`Result from ${name}:`, res.rows[0]);
        await client.end();
        return true;
    } catch (err) {
        console.error(`Error connecting to ${name}:`, err.message);
        return false;
    }
}

async function run() {
    const ok1 = await testConn(connStr1, 'Port 5432');
    const ok2 = await testConn(connStr2, 'Port 6543');
}

run();
