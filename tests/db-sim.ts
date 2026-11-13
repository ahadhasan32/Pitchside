// End-to-end DB simulation of a full tournament against the real schema, inside ONE transaction
// that is always ROLLED BACK — the live tournament is never touched.
//   npx tsx tests/db-sim.ts
import '../scripts/env';
import { need } from '../scripts/env';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';

const db = new Client({ connectionString: need('DATABASE_URL'), ssl: { rejectUnauthorized: false } });
let pass = 0, fail = 0;
const ok = (c: boolean, msg: string) => { if (c) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg); } };
const q = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows;

async function expectErr(label: string, fn: () => Promise<unknown>, pattern: RegExp) {
  await db.query('savepoint sp');
  try { await fn(); ok(false, `${label} (expected error ${pattern})`); await db.query('release savepoint sp'); }
  catch (e) { await db.query('rollback to savepoint sp'); ok(pattern.test((e as Error).message), `${label} → ${(e as Error).message.slice(0, 90)}`); }
}
async function as(role: 'authenticated' | 'anon', uid: string | null) {
  await db.query(`select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)`, [role, JSON.stringify(uid ? { sub: uid, role } : { role })]);
}
const asSuper = () => db.query(`reset role`);

async function main() {
  await db.connect();
  await db.query('begin');
  try {
    const owner = randomUUID(), scorer = randomUUID(), stranger = randomUUID();
    for (const [id, email] of [[owner, 'sim-owner@test.local'], [scorer, 'sim-scorer@test.local'], [stranger, 'sim-x@test.local']]) {
      await q(`insert into auth.users (id, email, aud, role, instance_id) values ($1, $2, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')`, [id, email]);
    }
    await q(`insert into admin_users(user_id, email, role) values ($1,'sim-owner@test.local','owner'), ($2,'sim-scorer@test.local','scorer')`, [owner, scorer]);
    const [{ id: tid }] = await q(`insert into tournaments(slug, name, is_test) values ('sim-' || gen_random_uuid(), 'SIM', true) returning id`);
    await q(`insert into settings(tournament_id) values ($1)`, [tid]);
    const G: Record<string, string> = {};
    for (const c of ['A', 'B']) G[c] = (await q(`insert into groups(tournament_id, code, name) values ($1,$2,$2) returning id`, [tid, c]))[0].id;
    const T: Record<string, string> = {}, P: Record<string, string[]> = {};
    for (const [k, g] of [['A1', 'A'], ['A2', 'A'], ['A3', 'A'], ['A4', 'A'], ['B1', 'B'], ['B2', 'B'], ['B3', 'B'], ['B4', 'B']]) {
      T[k] = (await q(`insert into teams(tournament_id, group_id, name, display_name, short_code) values ($1,$2,$3,$3,$3) returning id`, [tid, G[g], k]))[0].id;
      await q(`insert into team_private(team_id, contact_phone, bkash_trx) values ($1, '01700000000', 'TRX')`, [T[k]]);
      P[k] = [];
      for (let i = 1; i <= 3; i++) P[k].push((await q(`insert into players(team_id, name, position, jersey) values ($1, $2, 'striker', $3) returning id`, [T[k], `${k}-p${i}`, i]))[0].id);
    }
    // squad limit
    await expectErr('11th active player rejected', async () => { for (let i = 4; i <= 11; i++) await q(`insert into players(team_id, name, jersey) values ($1, $2, $3)`, [T.A1, 'x' + i, i]); }, /SQUAD_FULL/);

    const M: Record<string, string> = {};
    const fixtures: [string, string, string, string][] = [['M01', 'A', 'A1', 'A2'], ['M02', 'A', 'A3', 'A4'], ['M03', 'A', 'A1', 'A3'], ['M04', 'A', 'A2', 'A4'], ['M05', 'A', 'A1', 'A4'], ['M06', 'A', 'A2', 'A3'],
      ['M07', 'B', 'B1', 'B2'], ['M08', 'B', 'B3', 'B4'], ['M09', 'B', 'B1', 'B3'], ['M10', 'B', 'B2', 'B4'], ['M11', 'B', 'B1', 'B4'], ['M12', 'B', 'B2', 'B3']];
    let no = 1;
    for (const [code, g, h, a] of fixtures) M[code] = (await q(`insert into matches(tournament_id, code, match_no, stage, group_id, home_team_id, away_team_id) values ($1,$2,$3,'group',$4,$5,$6) returning id`, [tid, code, no++, G[g], T[h], T[a]]))[0].id;
    for (const [code, ph1, ph2, stage] of [['SF1', 'A1', 'B2', 'semifinal'], ['SF2', 'B1', 'A2', 'semifinal'], ['FINAL', 'W(SF1)', 'W(SF2)', 'final']])
      M[code] = (await q(`insert into matches(tournament_id, code, match_no, stage, home_placeholder, away_placeholder) values ($1,$2,$3,$4,$5,$6) returning id`, [tid, code, no++, stage, ph1, ph2]))[0].id;

    const score = async (code: string) => (await q(`select home_score, away_score from match_scores where match_id=$1`, [M[code]]))[0];
    const ver = async (code: string) => (await q(`select version from matches where id=$1`, [M[code]]))[0].version;

    console.log('Permissions');
    await as('authenticated', stranger);
    await expectErr('non-admin cannot start a match', () => q(`select admin_match_action($1,'start',null)`, [M.M01]), /FORBIDDEN/);
    await as('anon', null);
    await expectErr('anon cannot call RPC', () => q(`select admin_match_action($1,'start',null)`, [M.M01]), /permission denied/);
    ok((await q(`select * from team_private`)).length === 0, 'anon cannot read team_private (phones/TrxIDs)');
    ok((await q(`select * from player_private`)).length === 0, 'anon cannot read player_private');
    ok((await q(`select * from payments`)).length === 0, 'anon cannot read payments');
    ok((await q(`select * from audit_log`)).length === 0, 'anon cannot read audit_log');
    ok((await q(`select * from admin_users`)).length === 0, 'anon cannot read admin_users');
    ok((await q(`select * from teams where tournament_id=$1`, [tid])).length === 8, 'anon can read teams');
    await expectErr('anon cannot update matches', async () => { const r = await db.query(`update matches set status='live' where id=$1`, [M.M01]); if (!r.rowCount) throw new Error('blocked by RLS (0 rows)'); }, /RLS|permission/);
    await expectErr('anon cannot insert events', () => q(`insert into match_events(match_id,type,team_id,player_id) values ($1,'goal',$2,$3)`, [M.M01, T.A1, P.A1[0]]), /row-level security|permission/);
    await expectErr('registration closed → anon insert rejected', () => q(`insert into registration_submissions(tournament_id, payload) values ($1, '{}')`, [tid]), /row-level security/);
    await asSuper(); await q(`update settings set registration_open = true where tournament_id=$1`, [tid]); await as('anon', null);
    await q(`insert into registration_submissions(tournament_id, payload) values ($1, '{"team":"x"}')`, [tid]);
    ok(true, 'registration open → anon insert allowed');
    ok((await q(`select * from registration_submissions`)).length === 0, 'anon cannot read registration submissions');

    console.log('Match flow (scorer)');
    await as('authenticated', scorer);
    await expectErr('goal before kick-off rejected', () => q(`select admin_event_save($1,$2,'goal',$3,$4)`, [randomUUID(), M.M01, T.A1, P.A1[0]]), /NOT_STARTED/);
    await q(`select admin_match_action($1,'start',$2)`, [M.M01, await ver('M01')]);
    await q(`select admin_match_action($1,'start',null)`, [M.M01]);
    ok((await q(`select status from matches where id=$1`, [M.M01]))[0].status === 'live', 'start (idempotent double click)');
    const g1 = randomUUID();
    await q(`select admin_event_save($1,$2,'goal',$3,$4,$5,7)`, [g1, M.M01, T.A1, P.A1[0], P.A1[1]]);
    await q(`select admin_event_save($1,$2,'goal',$3,$4,$5,7)`, [g1, M.M01, T.A1, P.A1[0], P.A1[1]]); // replay same request id
    ok((await q(`select count(*)::int c from match_events where match_id=$1`, [M.M01]))[0].c === 1, 'duplicate submission (same id) creates one event');
    await expectErr('assist from other team rejected', () => q(`select admin_event_save($1,$2,'goal',$3,$4,$5)`, [randomUUID(), M.M01, T.A1, P.A1[0], P.A2[0]]), /EVENT_ASSIST/);
    await expectErr('player not on team rejected', () => q(`select admin_event_save($1,$2,'goal',$3,$4)`, [randomUUID(), M.M01, T.A1, P.A2[0]]), /EVENT_PLAYER/);
    await expectErr('team not in match rejected', () => q(`select admin_event_save($1,$2,'goal',$3,$4)`, [randomUUID(), M.M01, T.A3, P.A3[0]]), /EVENT_TEAM/);
    const og = randomUUID();
    await q(`select admin_event_save($1,$2,'own_goal',$3,$4)`, [og, M.M01, T.A2, P.A2[0]]); // A2 player OG → counts for A1
    let s = await score('M01');
    ok(s.home_score === 2 && s.away_score === 0, `own goal counts for opponent (2–0) got ${s.home_score}–${s.away_score}`);
    await q(`select admin_event_delete($1)`, [og]);
    await q(`select admin_event_delete($1)`, [og]);
    s = await score('M01');
    ok(s.home_score === 1, 'delete event recalculates score (idempotent delete)');
    const v = await ver('M01');
    await q(`select admin_match_update($1,'{"added_minutes":2}',$2)`, [M.M01, v]);
    await expectErr('stale version → conflict message', () => q(`select admin_match_update($1,'{"added_minutes":1}',$2)`, [M.M01, v]), /CONFLICT: this match was changed by sim-scorer/);
    await expectErr('added time above stage max rejected', () => q(`select admin_match_update($1,'{"added_minutes":3}',null)`, [M.M01]), /ADDED_TIME/);
    await expectErr('finalize before full time rejected', () => q(`select admin_match_action($1,'finalize',null)`, [M.M01]), /BAD_STATE/);
    await q(`select admin_match_action($1,'end',null)`, [M.M01]);
    await q(`select admin_match_action($1,'finalize',null)`, [M.M01]);
    await expectErr('events locked after finalize', () => q(`select admin_event_save($1,$2,'goal',$3,$4)`, [randomUUID(), M.M01, T.A1, P.A1[0]]), /FINALIZED/);
    await q(`select admin_rating_set($1,$2,7.45)`, [M.M01, P.A1[0]]);
    ok(Number((await q(`select rating from player_match_ratings where match_id=$1`, [M.M01]))[0].rating) === 7.5, 'rating stored with one decimal');
    await expectErr('cannot schedule-edit as scorer', () => q(`select admin_match_update($1,'{"scheduled_at":"2026-11-13T10:00:00Z"}',null)`, [M.M02]), /FORBIDDEN/);

    console.log('Reconciliation mode');
    await q(`select admin_match_action($1,'start',null)`, [M.M02]);
    await q(`select admin_match_update($1,'{"score_mode":"manual","manual_home":2,"manual_away":0}',null)`, [M.M02]);
    ok((await q(`select details_incomplete from match_scores where match_id=$1`, [M.M02]))[0].details_incomplete === true, 'manual score flagged details incomplete');
    await q(`select admin_event_save($1,$2,'goal',$3,$4)`, [randomUUID(), M.M02, T.A3, P.A3[0]]);
    await q(`select admin_event_save($1,$2,'goal',$3,$4)`, [randomUUID(), M.M02, T.A3, P.A3[1]]);
    ok((await q(`select score_mode from matches where id=$1`, [M.M02]))[0].score_mode === 'events', 'flag clears once events match the manual score');
    await expectErr('manual override with events needs confirmation', () => q(`select admin_match_update($1,'{"score_mode":"manual","manual_home":3,"manual_away":0}',null)`, [M.M02]), /CONFIRM_REQUIRED/);
    await q(`select admin_match_action($1,'end',null)`, [M.M02]); await q(`select admin_match_action($1,'finalize',null)`, [M.M02]);

    console.log('Rest of the group stage');
    const play = async (code: string, goals: [string, number][]) => {
      await q(`select admin_match_action($1,'start',null)`, [M[code]]);
      for (const [team, idx] of goals) await q(`select admin_event_save($1,$2,'goal',$3,$4)`, [randomUUID(), M[code], T[team], P[team][idx]]);
      await q(`select admin_match_action($1,'end',null)`, [M[code]]); await q(`select admin_match_action($1,'finalize',null)`, [M[code]]);
    };
    await play('M03', [['A1', 0]]); await play('M04', [['A2', 0]]); await play('M05', [['A1', 2]]); await play('M06', [['A2', 1], ['A3', 0]]);
    await play('M07', [['B1', 0]]); await play('M08', []); await play('M09', [['B1', 1]]); await play('M10', [['B2', 0], ['B2', 1]]); await play('M11', [['B1', 0]]);
    await as('authenticated', owner);
    await expectErr('semis need confirmed groups', () => q(`select admin_generate_semis($1,$2,$3,$4,$5)`, [tid, T.A1, T.A2, T.B1, T.B2]), /NOT_CONFIRMED/);
    await expectErr('cannot confirm with an open group match', () => q(`select admin_confirm_groups($1,true)`, [tid]), /GROUPS_INCOMPLETE/);
    await as('authenticated', scorer);
    await play('M12', [['B2', 0]]);
    await as('authenticated', scorer);
    await expectErr('scorer cannot confirm standings', () => q(`select admin_confirm_groups($1,true)`, [tid]), /FORBIDDEN/);
    await as('authenticated', owner);
    await q(`select admin_confirm_groups($1,true)`, [tid]);
    await q(`select admin_generate_semis($1,$2,$3,$4,$5)`, [tid, T.A1, T.A2, T.B1, T.B2]);
    await q(`select admin_generate_semis($1,$2,$3,$4,$5)`, [tid, T.A1, T.A2, T.B1, T.B2]);
    const sf1 = (await q(`select home_team_id, away_team_id from matches where id=$1`, [M.SF1]))[0];
    ok(sf1.home_team_id === T.A1 && sf1.away_team_id === T.B2, 'SF1 = A1 vs B2 (generate is idempotent)');
    ok((await q(`select count(*)::int c from matches where tournament_id=$1 and stage='semifinal'`, [tid]))[0].c === 2, 'no duplicate semifinals');

    console.log('Knockouts');
    await as('authenticated', scorer);
    await q(`select admin_match_action($1,'start',null)`, [M.SF1]);
    await q(`select admin_event_save($1,$2,'goal',$3,$4)`, [randomUUID(), M.SF1, T.A1, P.A1[0]]);
    await q(`select admin_event_save($1,$2,'goal',$3,$4)`, [randomUUID(), M.SF1, T.B2, P.B2[0]]);
    await q(`select admin_match_action($1,'end',null)`, [M.SF1]);
    await expectErr('drawn KO cannot be finalized without a winner', () => q(`select admin_match_action($1,'finalize',null)`, [M.SF1]), /KO_DRAW/);
    await q(`select admin_match_update($1,'{"pen_home":3,"pen_away":4}',null)`, [M.SF1]);
    await q(`select admin_match_action($1,'finalize',null)`, [M.SF1]);
    ok((await q(`select match_winner($1) w`, [M.SF1]))[0].w === T.B2, 'penalties decide SF1 (B2 wins 4–3 pens)');
    ok((await q(`select home_team_id from matches where id=$1`, [M.FINAL]))[0].home_team_id === T.B2, 'final prepared with W(SF1) automatically');
    await as('authenticated', owner);
    await expectErr('SF started → regenerate refuses to overwrite', () => q(`select admin_generate_semis($1,$2,$3,$4,$5)`, [tid, T.A2, T.A1, T.B1, T.B2]), /KO_STARTED/);
    await as('authenticated', scorer);
    await q(`select admin_match_action($1,'start',null)`, [M.SF2]);
    await q(`select admin_event_save($1,$2,'goal',$3,$4)`, [randomUUID(), M.SF2, T.B1, P.B1[0]]);
    await q(`select admin_match_action($1,'end',null)`, [M.SF2]); await q(`select admin_match_action($1,'finalize',null)`, [M.SF2]);
    const fin = (await q(`select home_team_id, away_team_id from matches where id=$1`, [M.FINAL]))[0];
    ok(fin.home_team_id === T.B2 && fin.away_team_id === T.B1, 'final = W(SF1) vs W(SF2)');
    await q(`select admin_match_action($1,'start',null)`, [M.FINAL]);
    await q(`select admin_event_save($1,$2,'goal',$3,$4)`, [randomUUID(), M.FINAL, T.B1, P.B1[2]]);
    await q(`select admin_match_action($1,'end',null)`, [M.FINAL]); await q(`select admin_match_action($1,'finalize',null)`, [M.FINAL]);
    ok((await q(`select match_winner($1) w`, [M.FINAL]))[0].w === T.B1, 'champion = B1');
    await expectErr('cannot reopen a semifinal once the final has been played', () => q(`select admin_match_action($1,'reopen',null)`, [M.SF2]), /KO_STARTED/);

    console.log('Soft deletes & team changes');
    await as('authenticated', scorer);
    await q(`select admin_match_action($1,'reopen',null)`, [M.M12]);
    const evId = (await q(`select id from match_events where match_id=$1 and deleted_at is null limit 1`, [M.M12]))[0].id;
    await q(`select admin_event_delete($1)`, [evId]);
    await asSuper();
    ok((await q(`select deleted_at from match_events where id=$1`, [evId]))[0].deleted_at !== null, 'removing an event is a soft delete (row kept)');
    ok((await q(`select count(*)::int c from live_pings where match_id=$1`, [M.M12]))[0].c === 1, 'event write pings realtime');
    await as('anon', null);
    ok((await q(`select * from match_events where id=$1`, [evId])).length === 0, 'soft-deleted event hidden from public');
    await as('authenticated', scorer);
    await expectErr('stale retry cannot resurrect a removed event', () => q(`select admin_event_save($1,$2,'goal',$3,$4)`, [evId, M.M12, T.B2, P.B2[0]]), /DELETED/);
    await expectErr('players cannot be hard-deleted', async () => { const r = await db.query(`delete from players where id=$1`, [P.B4[0]]); if (!r.rowCount) throw new Error('blocked (0 rows)'); }, /blocked|permission/);
    await as('authenticated', owner);
    await expectErr('teams cannot be hard-deleted', async () => { const r = await db.query(`delete from teams where id=$1`, [T.B4]); if (!r.rowCount) throw new Error('blocked (0 rows)'); }, /blocked|permission/);
    // replace A4 with a new team: scheduled A4 matches move over
    const t2 = (await q(`insert into tournaments(slug,name,is_test) values ('sim2-' || gen_random_uuid(),'SIM2',true) returning id`))[0].id;
    await asSuper();
    const g2 = (await q(`insert into groups(tournament_id,code,name) values ($1,'A','A') returning id`, [t2]))[0].id;
    const X: Record<string, string> = {};
    for (const k of ['X1', 'X2', 'X3']) X[k] = (await q(`insert into teams(tournament_id,group_id,name,display_name,short_code) values ($1,$2,$3,$3,$3) returning id`, [t2, g2, k]))[0].id;
    const mA = (await q(`insert into matches(tournament_id,code,match_no,stage,group_id,home_team_id,away_team_id,status,finalized) values ($1,'A',1,'group',$2,$3,$4,'full_time',true) returning id`, [t2, g2, X.X1, X.X2]))[0].id;
    const mB = (await q(`insert into matches(tournament_id,code,match_no,stage,group_id,home_team_id,away_team_id) values ($1,'B',2,'group',$2,$3,$4) returning id`, [t2, g2, X.X1, X.X3]))[0].id;
    await as('authenticated', owner);
    const nid = (await q(`select admin_team_replace($1,'New FC','New FC','NEW','#112233',true) id`, [X.X1]))[0].id;
    await asSuper();
    ok((await q(`select home_team_id from matches where id=$1`, [mB]))[0].home_team_id === nid, 'replace: future match moves to the new team');
    ok((await q(`select home_team_id from matches where id=$1`, [mA]))[0].home_team_id === X.X1, 'replace: played match keeps its history');
    ok((await q(`select status, results_policy from teams where id=$1`, [X.X1]))[0].results_policy === 'transfer', 'replace: old team withdrawn with results transferred');
    await as('authenticated', owner);
    const n = (await q(`select admin_team_withdraw($1,'keep') n`, [X.X3]))[0].n;
    await asSuper();
    ok(n === 1 && (await q(`select status from matches where id=$1`, [mB]))[0].status === 'cancelled', 'withdraw: remaining match cancelled (not deleted)');
    await as('authenticated', owner);
    await q(`select admin_match_restore($1)`, [mB]);
    await asSuper();
    ok((await q(`select status from matches where id=$1`, [mB]))[0].status === 'scheduled', 'cancelled match can be restored');
    await as('authenticated', owner);

    console.log('Bracket protection & audit');
    await q(`select admin_match_action($1,'reopen',null)`, [M.M03]);
    ok((await q(`select bracket_needs_review from tournaments where id=$1`, [tid]))[0].bracket_needs_review === true, 'reopening a group match after semis flags the bracket for review');
    await asSuper();
    const audit = await q(`select count(*)::int c, count(distinct actor_email)::int a from audit_log where entity='match_events' and actor_email like 'sim-%'`);
    ok(audit[0].c > 0, `audit log records event writes with actor (${audit[0].c} rows)`);
    await expectErr('last owner cannot be removed', () => q(`delete from admin_users where role='owner' and user_id not in ($1)`, [owner]).then(() => q(`delete from admin_users where user_id=$1`, [owner])), /LAST_OWNER/);
    console.log('Reset / restore / void');
    await as('authenticated', scorer);
    await expectErr('reset group match blocked while knockouts were played', () => q(`select admin_match_reset($1,'M05')`, [M.M05]), /DEPENDENTS: .*FINAL \(finalized\)/);
    await expectErr('reset semifinal blocked while the final was played', () => q(`select admin_match_reset($1,'SF1')`, [M.SF1]), /DEPENDENTS: .*FINAL/);
    await expectErr('reset finalized match needs typed code', () => q(`select admin_match_reset($1,null)`, [M.FINAL]), /CONFIRM_REQUIRED: type FINAL/);
    await q(`select admin_match_reset($1,'final')`, [M.FINAL]);
    let f = (await q(`select m.status, m.finalized, s.home_score, s.away_score from matches m join match_scores s on s.match_id=m.id where m.id=$1`, [M.FINAL]))[0];
    ok(f.status === 'scheduled' && !f.finalized && f.home_score === 0 && f.away_score === 0, 'reset: final back to scheduled 0–0');
    ok((await q(`select count(*)::int c from match_events where match_id=$1 and deleted_at is not null and reset_batch is not null`, [M.FINAL]))[0].c === 1, 'reset: events soft-deleted with a reset batch');
    await q(`select admin_match_reset_restore($1)`, [M.FINAL]);
    f = (await q(`select m.status, m.finalized, s.home_score from matches m join match_scores s on s.match_id=m.id where m.id=$1`, [M.FINAL]))[0];
    ok(f.finalized && f.home_score + 0 >= 0 && (await q(`select match_winner($1) w`, [M.FINAL]))[0].w === T.B1, 'restore last reset: final finalized again with the same winner');
    await q(`select admin_match_reset($1,'FINAL')`, [M.FINAL]);
    await q(`select admin_match_reset($1,'SF2')`, [M.SF2]);
    ok((await q(`select away_team_id from matches where id=$1`, [M.FINAL]))[0].away_team_id === null, 'reset SF2 clears its slot in the (unplayed) final');
    await q(`select admin_match_reset_restore($1)`, [M.SF2]);
    ok((await q(`select away_team_id from matches where id=$1`, [M.FINAL]))[0].away_team_id === T.B1, 'restoring SF2 refills the final');
    await q(`select admin_match_action($1,'start',null)`, [M.FINAL]);
    await q(`select admin_event_save($1,$2,'goal',$3,$4)`, [randomUUID(), M.FINAL, T.B2, P.B2[1]]);
    await expectErr('restore impossible once new events exist', () => q(`select admin_match_reset_restore($1)`, [M.FINAL]), /NOTHING_TO_RESTORE|NOT_RESTORABLE/);
    await as('authenticated', owner);
    await q(`select admin_match_void($1,'FINAL')`, [M.FINAL]);
    ok((await q(`select status from matches where id=$1`, [M.FINAL]))[0].status === 'cancelled', 'void: match cancelled, history kept');
    await q(`select admin_match_restore($1)`, [M.FINAL]);
    ok((await q(`select status from matches where id=$1`, [M.FINAL]))[0].status === 'live', 'restore void: back to its previous state (live)');
    await expectErr('clear all needs RESET', () => q(`select admin_reset_all($1,'reset')`, [tid]), /CONFIRM_REQUIRED/);
    const nReset = (await q(`select admin_reset_all($1,'RESET') n`, [tid]))[0].n;
    const left = (await q(`select count(*)::int c from matches where tournament_id=$1 and (status<>'scheduled' or finalized)`, [tid]))[0].c;
    const koTeams = (await q(`select count(*)::int c from matches where tournament_id=$1 and stage<>'group' and home_team_id is not null`, [tid]))[0].c;
    const liveEv = (await q(`select count(*)::int c from match_events e join matches m on m.id=e.match_id where m.tournament_id=$1 and e.deleted_at is null`, [tid]))[0].c;
    ok(nReset > 10 && left === 0 && koTeams === 0 && liveEv === 0, `clear all: ${nReset} matches reset, KO slots cleared, no live events`);
    ok((await q(`select count(*)::int c from teams where tournament_id=$1 and status='confirmed'`, [tid]))[0].c === 8, 'clear all: teams untouched');

    console.log('Team restore');
    await expectErr('restore replaced team needs swap back', () => q(`select admin_team_restore($1,null,false)`, [X.X1]), /REPLACED: New FC/);
    await q(`select admin_team_restore($1,null,true)`, [X.X1]);
    const xs = (await q(`select (select status from teams where id=$1) a, (select status from teams where id=$2) b, (select home_team_id from matches where id=$3) h`, [X.X1, nid, mB]))[0];
    ok(xs.a === 'confirmed' && xs.b === 'withdrawn' && xs.h === X.X1, 'swap back: old team restored with its fixtures, replacement withdrawn');
    await q(`select admin_team_restore($1,null,false)`, [X.X3]);
    ok((await q(`select status from teams where id=$1`, [X.X3]))[0].status === 'confirmed', 'withdrawn team restored');

  } finally {
    await db.query('rollback');
    await db.end();
  }
  console.log(`\n${pass} passed, ${fail} failed (all changes rolled back)`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
