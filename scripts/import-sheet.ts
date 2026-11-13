// One-time, idempotent import of the cleaned Google Sheet export (WInter Showdown.xlsx) into Supabase.
// Safe to re-run: teams are keyed by Reg ID, players by Reg ID + slot, payments by an import key,
// matches by code. Existing rows are never duplicated and admin edits to existing rows are kept.
//
//   npm run import:sheet -- [path/to/file.xlsx] [--skip-logos]
import './env';
import { need } from './env';
import * as XLSX from 'xlsx';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { SEED_TEAMS, SEED_MATCHES, NAME_ALIASES, normName, KICKOFF_ISO } from '../lib/seed-data';

const file = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'wintershowdown/WInter Showdown.xlsx';
const skipLogos = process.argv.includes('--skip-logos');
const SLUG = 'ws2026';

const POS: Record<string, string> = {
  'goalkeeper (gk)': 'goalkeeper', goalkeeper: 'goalkeeper', gk: 'goalkeeper',
  defender: 'defender', midfielder: 'midfielder', striker: 'striker', forward: 'striker',
};

type Report = { teams: string[]; players: number; playersExisting: number; logos: string[]; logoFailures: string[]; payments: string[];
  unmatched: string[]; flagged: string[]; skipped: string[]; unknownPositions: string[]; jerseyMisses: string[]; matches: string[] };

function excelSerialToIso(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    // Sheet times are Asia/Dhaka local time (UTC+6)
    const ms = Math.round((v - 25569) * 86400 * 1000) - 6 * 3600 * 1000;
    return new Date(ms).toISOString();
  }
  const d = new Date(String(v));
  return isNaN(+d) ? null : d.toISOString();
}
const text = (v: unknown) => (v == null || String(v).trim() === '' ? null : String(v).trim());

async function main() {
  const db = new Client({ connectionString: need('DATABASE_URL'), ssl: { rejectUnauthorized: false } });
  await db.connect();
  const sb = createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const rep: Report = { teams: [], players: 0, playersExisting: 0, logos: [], logoFailures: [], payments: [], unmatched: [], flagged: [], skipped: [], unknownPositions: [], jerseyMisses: [], matches: [] };

  const wb = XLSX.readFile(file, { cellDates: false });
  for (const n of wb.SheetNames) if (!['Teams', 'Payments'].includes(n)) rep.skipped.push(`tab "${n}" (ignored by design)`);
  const teamRows = (XLSX.utils.sheet_to_json(wb.Sheets['Teams'], { header: 1, raw: true, defval: null }) as unknown[][]).slice(1);
  const payRows = (XLSX.utils.sheet_to_json(wb.Sheets['Payments'], { header: 1, raw: true, defval: null }) as unknown[][]).slice(1);

  // --- tournament, settings, groups --------------------------------------
  const t = await db.query(
    `insert into tournaments(slug, name, starts_at, venue) values ($1, $2, $3, $4)
     on conflict (slug) do update set slug = excluded.slug returning id`,
    [SLUG, 'Winter Showdown 2026', KICKOFF_ISO, 'OFFSIDE – Home of Football (Offside Turf, Mirpur)']);
  const tid: string = t.rows[0].id;
  await db.query(`insert into settings(tournament_id) values ($1) on conflict do nothing`, [tid]);
  const groupIds: Record<string, string> = {};
  for (const code of ['A', 'B']) {
    const g = await db.query(`insert into groups(tournament_id, code, name) values ($1,$2,$3)
      on conflict (tournament_id, code) do update set code = excluded.code returning id`, [tid, code, `Group ${code}`]);
    groupIds[code] = g.rows[0].id;
  }

  // --- teams + players ----------------------------------------------------
  const teamIdByKey: Record<string, string> = {};
  const teamIdByReg: Record<string, string> = {};
  for (const r of teamRows) {
    if (!r || r.every((c) => c == null || c === '')) continue;
    const regId = text(r[67]);
    const name = text(r[2]);
    if (!regId || !name) { rep.skipped.push(`team row without Reg ID/name: ${name ?? '?'}`); continue; }
    const groupCode = (text(r[1]) ?? '').toUpperCase();
    if (!groupIds[groupCode]) rep.unmatched.push(`${name}: STATUS "${r[1]}" is not A/B — imported without group`);
    const key = NAME_ALIASES[normName(name)] ?? NAME_ALIASES[name];
    const seed = SEED_TEAMS.find((s) => s.key === key);
    if (!seed) rep.unmatched.push(`${name}: no design-v2 seed match (display name/colour defaulted)`);
    if (seed && seed.group !== groupCode) rep.unmatched.push(`${name}: sheet group ${groupCode} ≠ design-v2 group ${seed.group} (sheet wins)`);

    const existing = await db.query(`select new_id from legacy_keys where source='regid' and key=$1`, [regId]);
    let teamId: string;
    if (existing.rowCount) {
      teamId = existing.rows[0].new_id;
      rep.teams.push(`${name} [${regId}] — already imported (kept)`);
    } else {
      const ins = await db.query(
        `insert into teams(tournament_id, group_id, name, display_name, short_code, color, status)
         values ($1,$2,$3,$4,$5,$6,'confirmed') returning id`,
        [tid, groupIds[groupCode] ?? null, name, seed?.displayName ?? name, seed?.short ?? name.slice(0, 3).toUpperCase(), seed?.color ?? '#00E5FF']);
      teamId = ins.rows[0].id;
      await db.query(`insert into legacy_keys(source,key,entity,new_id) values ('regid',$1,'team',$2)`, [regId, teamId]);
      rep.teams.push(`${name} → ${seed?.displayName ?? name} (Group ${groupCode}) [${regId}] — new`);
    }
    teamIdByReg[regId] = teamId;
    if (key) teamIdByKey[key] = teamId;

    const terms = text(r[66]);
    await db.query(
      `insert into team_private(team_id, reg_id, contact_phone, bkash_trx, registered_at, terms_accepted, raw)
       values ($1,$2,$3,$4,$5,$6,$7) on conflict (team_id) do nothing`,
      [teamId, regId, text(r[3]), text(r[4]), excelSerialToIso(r[0]),
       terms == null ? null : /^(yes|y|true|accepted|✓|✔)/i.test(terms) ? 'yes' : /^(no|n|false)/i.test(terms) ? 'no' : null,
       JSON.stringify({ logo: text(r[5]), status: text(r[1]) })]);

    // logo
    const logoCell = text(r[5]);
    if (!skipLogos) {
      const cur = await db.query(`select logo_url from teams where id=$1`, [teamId]);
      if (!cur.rows[0].logo_url) {
        const fileId = logoCell?.match(/\/d\/([A-Za-z0-9_-]+)/)?.[1] ?? logoCell?.match(/[?&]id=([A-Za-z0-9_-]+)/)?.[1];
        if (!fileId) rep.logoFailures.push(`${name}: no Drive file id in logo cell`);
        else {
          try {
            const res = await fetch(`https://drive.google.com/uc?export=download&id=${fileId}`, { redirect: 'follow' });
            const ct = res.headers.get('content-type') ?? '';
            if (!res.ok || !ct.startsWith('image/')) throw new Error(`HTTP ${res.status} ${ct}`);
            const buf = Buffer.from(await res.arrayBuffer());
            const ext = ct.split('/')[1].replace('jpeg', 'jpg').split(';')[0];
            const path = `teams/${teamId}.${ext}`;
            const up = await sb.storage.from('logos').upload(path, buf, { contentType: ct, upsert: true });
            if (up.error) throw up.error;
            const url = sb.storage.from('logos').getPublicUrl(path).data.publicUrl;
            await db.query(`update teams set logo_url=$1 where id=$2`, [url, teamId]);
            rep.logos.push(`${name}: migrated (${Math.round(buf.length / 1024)} KB)`);
          } catch (e) {
            rep.logoFailures.push(`${name}: download failed (${(e as Error).message}) — upload it in Admin → Teams`);
          }
        }
      } else rep.logos.push(`${name}: already in Storage`);
    }

    for (let slot = 1; slot <= 10; slot++) {
      const base = 6 + (slot - 1) * 6;
      const pName = text(r[base]);
      if (!pName) continue;
      const [inst, ageRaw, posRaw, phone, photo] = [text(r[base + 1]), text(r[base + 2]), text(r[base + 3]), text(r[base + 4]), text(r[base + 5])];
      const pos = POS[(posRaw ?? '').toLowerCase()];
      if (!pos) rep.unknownPositions.push(`${name} P${slot} ${pName}: "${posRaw}" → midfielder`);
      const age = ageRaw && /^\d{1,2}$/.test(ageRaw) ? Number(ageRaw) : null;
      if (age != null && age >= 24) rep.flagged.push(`${name} P${slot} ${pName}: age ${age} (rule: under 24) — eligibility warning in admin`);
      if (ageRaw && age == null) rep.flagged.push(`${name} P${slot} ${pName}: invalid age "${ageRaw}" stored as null`);
      if (photo) rep.skipped.push(`${name} P${slot}: photo cell present but photos are uploaded from admin`);
      const seedPlayer = seed?.squad.find((s) => normName(s.name) === normName(pName));
      const jersey = seedPlayer?.number ?? null;
      const displayName = seedPlayer?.name ?? pName; // design-v2 spelling (same letters, proper capitalisation)
      if (seed && jersey == null) rep.jerseyMisses.push(`${name} P${slot} ${pName}`);

      const lk = `${regId}#P${slot}`;
      const ex = await db.query(`select new_id from legacy_keys where source='regid_slot' and key=$1`, [lk]);
      let pid: string;
      if (ex.rowCount) { pid = ex.rows[0].new_id; rep.playersExisting++; }
      else {
        const ins = await db.query(`insert into players(team_id, slot, name, position, jersey) values ($1,$2,$3,$4,$5) returning id`,
          [teamId, slot, displayName, pos ?? 'midfielder', jersey]);
        pid = ins.rows[0].id;
        await db.query(`insert into legacy_keys(source,key,entity,new_id) values ('regid_slot',$1,'player',$2)`, [lk, pid]);
        rep.players++;
      }
      await db.query(`insert into player_private(player_id, institution, age, phone) values ($1,$2,$3,$4) on conflict (player_id) do nothing`,
        [pid, inst, age, phone]);
    }
  }

  // --- payments (by Reg ID only) -----------------------------------------
  let sheetPaid = 0, sheetFee = 0;
  for (const r of payRows) {
    const regId = text(r[7]);
    const team = text(r[0]);
    if (!team && !regId) continue;
    const fee = Number(r[3] ?? 0), paid = Number(r[4] ?? 0);
    if (!regId) { rep.unmatched.push(`payment row "${team}" has no Reg ID`); continue; }
    const tId = teamIdByReg[regId];
    if (!tId) { rep.unmatched.push(`payment row "${team}" [${regId}] has no matching team`); continue; }
    sheetPaid += paid; sheetFee += fee;
    await db.query(`update team_private set fee_total=$1 where team_id=$2`, [fee || 3050, tId]);
    if (paid) {
      const res = await db.query(
        `insert into payments(team_id, amount, method, trx_id, note, import_key) values ($1,$2,'bKash',$3,'Imported from sheet (Paid column)',$4)
         on conflict (import_key) do nothing`, [tId, paid, text(r[2]), `sheet:${regId}`]);
      rep.payments.push(`${team} [${regId}]: paid ${paid} of ${fee}${res.rowCount ? '' : ' (already imported)'}`);
    }
  }
  const dbTotals = await db.query(`select coalesce(sum(p.amount),0)::float as paid from payments p join teams t on t.id=p.team_id where t.tournament_id=$1`, [tid]);
  const dbFee = await db.query(`select coalesce(sum(tp.fee_total),0)::float as fee from team_private tp join teams t on t.id=tp.team_id where t.tournament_id=$1`, [tid]);
  for (const reg of Object.keys(teamIdByReg)) if (!payRows.some((r) => text(r[7]) === reg)) rep.unmatched.push(`team ${reg} has no payment row`);

  // --- fixtures -------------------------------------------------------------
  for (const m of SEED_MATCHES) {
    const home = m.home ? teamIdByKey[m.home] : null;
    const away = m.away ? teamIdByKey[m.away] : null;
    if (m.stage === 'group' && (!home || !away)) { rep.unmatched.push(`fixture ${m.code}: team missing`); continue; }
    const res = await db.query(
      `insert into matches(tournament_id, code, match_no, stage, group_id, home_team_id, away_team_id, home_placeholder, away_placeholder, scheduled_at, ends_at, venue)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'OFFSIDE – Home of Football')
       on conflict (tournament_id, code) do nothing`,
      [tid, m.code, m.no, m.stage, m.group ? groupIds[m.group] : null, home, away, m.homePh ?? null, m.awayPh ?? null, m.start, m.end]);
    rep.matches.push(`${m.code}${res.rowCount ? ' created' : ' exists'}`);
  }

  // --- report ---------------------------------------------------------------
  const counts = await db.query(`select (select count(*) from teams where tournament_id=$1)::int teams,
    (select count(*) from players p join teams t on t.id=p.team_id where t.tournament_id=$1)::int players,
    (select count(*) from matches where tournament_id=$1)::int matches`, [tid]);
  const line = (s: string) => console.log('  ' + s);
  console.log('\n================ RECONCILIATION REPORT ================');
  console.log(`Tournament: ${SLUG} (${tid})`);
  console.log(`Teams (${rep.teams.length} in sheet, ${counts.rows[0].teams} in DB):`); rep.teams.forEach(line);
  console.log(`Players: ${rep.players} new, ${rep.playersExisting} already imported, ${counts.rows[0].players} in DB`);
  console.log(`Logos:`); rep.logos.forEach(line); rep.logoFailures.forEach((s) => line('⚠ ' + s));
  console.log(`Payments:`); rep.payments.forEach(line);
  console.log(`  Sheet paid total: ${sheetPaid} | DB collected: ${dbTotals.rows[0].paid} | ${sheetPaid === dbTotals.rows[0].paid ? 'MATCH ✓' : 'MISMATCH ✗'}`);
  console.log(`  Sheet expected:   ${sheetFee} | DB expected:  ${dbFee.rows[0].fee} | still due: ${dbFee.rows[0].fee - dbTotals.rows[0].paid}`);
  console.log(`Matches (${counts.rows[0].matches} in DB): ${rep.matches.join(', ')}`);
  console.log(`Eligibility / data flags (${rep.flagged.length}):`); rep.flagged.forEach(line);
  console.log(`Unknown positions (${rep.unknownPositions.length}):`); rep.unknownPositions.forEach(line);
  console.log(`Players without a design-v2 jersey number (${rep.jerseyMisses.length}):`); rep.jerseyMisses.forEach(line);
  console.log(`Unmatched (${rep.unmatched.length}):`); rep.unmatched.forEach(line);
  console.log(`Skipped (${rep.skipped.length}):`); rep.skipped.forEach(line);
  console.log('=======================================================\n');
  await db.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
