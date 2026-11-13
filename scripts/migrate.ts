// Applies supabase/migrations/*.sql in order (each once), tracked in public._migrations.
import './env';
import { need } from './env';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

async function main() {
  const client = new Client({ connectionString: need('DATABASE_URL'), ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(`create table if not exists public._migrations (name text primary key, applied_at timestamptz default now());
                      alter table public._migrations enable row level security;`);
  const done = new Set((await client.query('select name from public._migrations')).rows.map((r) => r.name));
  const dir = 'supabase/migrations';
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(f) && !process.argv.includes('--reapply=' + f)) { console.log('skip', f); continue; }
    const sql = readFileSync(join(dir, f), 'utf8');
    console.log('apply', f);
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into public._migrations(name) values ($1) on conflict do nothing', [f]);
      await client.query('commit');
    } catch (e) {
      await client.query('rollback');
      throw e;
    }
  }
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
