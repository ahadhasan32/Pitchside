// Throwaway UI-test fixture: a test admin (scorer+owner) and a copy of the teams/fixtures in a separate
// tournament (slug "uitest"). Never touches ws2026 data.
//   npx tsx scripts/uitest.ts setup | teardown
import './env';
import { need } from './env';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

const EMAIL = 'ws-uitest@example.com';
async function main() {
  const mode = process.argv[2];
  const db = new Client({ connectionString: need('DATABASE_URL'), ssl: { rejectUnauthorized: false } });
  await db.connect();
  const svc = createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const existing = (await db.query(`select id from auth.users where email=$1`, [EMAIL])).rows[0]?.id as string | undefined;
  if (mode === 'teardown') {
    await db.query(`delete from matches where tournament_id in (select id from tournaments where slug='uitest' and is_test)`);
    await db.query(`delete from tournaments where slug='uitest' and is_test`);
    if (existing) await svc.auth.admin.deleteUser(existing);
    const env = readFileSync('.env.local', 'utf8').split('\n').filter((l) => !l.startsWith('UITEST_')).join('\n');
    writeFileSync('.env.local', env);
    console.log('teardown done');
  } else {
    if (!existing) {
      const pw = randomBytes(18).toString('base64url');
      const { data, error } = await svc.auth.admin.createUser({ email: EMAIL, password: pw, email_confirm: true });
      if (error) throw error;
      await db.query(`insert into admin_users(user_id,email,role) values ($1,$2,'owner')`, [data.user.id, EMAIL]);
      appendFileSync('.env.local', `\nUITEST_EMAIL=${EMAIL}\nUITEST_PASSWORD=${pw}\n`);
    }
    await db.query(`delete from matches where tournament_id in (select id from tournaments where slug='uitest' and is_test)`);
    await db.query(`delete from tournaments where slug='uitest' and is_test`);
    const src = (await db.query(`select id from tournaments where slug='ws2026'`)).rows[0].id;
    const tid = (await db.query(`insert into tournaments(slug,name,starts_at,venue,is_test) select 'uitest','UI TEST',starts_at,venue,true from tournaments where id=$1 returning id`, [src])).rows[0].id;
    await db.query(`insert into settings(tournament_id) values ($1)`, [tid]);
    const gmap: Record<string, string> = {}, tmap: Record<string, string> = {};
    for (const g of (await db.query(`select * from groups where tournament_id=$1`, [src])).rows)
      gmap[g.id] = (await db.query(`insert into groups(tournament_id,code,name) values ($1,$2,$3) returning id`, [tid, g.code, g.name])).rows[0].id;
    for (const t of (await db.query(`select * from teams where tournament_id=$1`, [src])).rows) {
      tmap[t.id] = (await db.query(`insert into teams(tournament_id,group_id,name,display_name,short_code,color,logo_url) values ($1,$2,$3,$4,$5,$6,$7) returning id`, [tid, gmap[t.group_id], t.name, t.display_name, t.short_code, t.color, t.logo_url])).rows[0].id;
      await db.query(`insert into players(team_id,slot,name,position,jersey) select $1,slot,name,position,jersey from players where team_id=$2`, [tmap[t.id], t.id]);
      await db.query(`insert into team_private(team_id, contact_phone) values ($1,'01XXXXXXXXX (test)')`, [tmap[t.id]]);
    }
    for (const m of (await db.query(`select * from matches where tournament_id=$1`, [src])).rows)
      await db.query(`insert into matches(tournament_id,code,match_no,stage,group_id,home_team_id,away_team_id,home_placeholder,away_placeholder,scheduled_at,ends_at,venue) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [tid, m.code, m.match_no, m.stage, m.group_id ? gmap[m.group_id] : null, m.home_team_id ? tmap[m.home_team_id] : null, m.away_team_id ? tmap[m.away_team_id] : null, m.home_placeholder, m.away_placeholder, m.scheduled_at, m.ends_at, m.venue]);
    console.log('uitest ready');
  }
  await db.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
