// Drives the same API calls the admin UI makes (as a real signed-in test admin over HTTP),
// and server-renders every admin page with that session. Uses the throwaway "uitest" tournament.
import './env';
import { need } from './env';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const BASE = process.env.UITEST_BASE ?? 'http://localhost:3001';
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', m); };

async function main() {
  const url = need('NEXT_PUBLIC_SUPABASE_URL');
  const sb = createClient(url, need('NEXT_PUBLIC_SUPABASE_ANON_KEY'), { auth: { persistSession: false } });
  const { data: auth, error } = await sb.auth.signInWithPassword({ email: need('UITEST_EMAIL'), password: need('UITEST_PASSWORD') });
  if (error) throw error;
  ok(!!auth.session, 'password sign-in');
  const ref = new URL(url).hostname.split('.')[0];
  const cookieVal = 'base64-' + Buffer.from(JSON.stringify(auth.session)).toString('base64url');
  const chunks: string[] = [];
  for (let i = 0; i * 3180 < cookieVal.length; i++) chunks.push(`sb-${ref}-auth-token.${i}=${cookieVal.slice(i * 3180, (i + 1) * 3180)}`);
  const cookie = chunks.length === 1 ? `sb-${ref}-auth-token=${cookieVal}` : chunks.join('; ');
  const get = async (p: string, withCookie = true) => {
    const r = await fetch(BASE + p, { headers: withCookie ? { cookie } : {}, redirect: 'manual' });
    return { status: r.status, text: await r.text(), loc: r.headers.get('location') };
  };

  const t = (await sb.from('tournaments').select('id').eq('slug', 'uitest').single()).data!;
  const ms = (await sb.from('matches').select('*').eq('tournament_id', t.id).order('match_no')).data!;
  const m1 = ms[0];

  console.log('Admin pages (SSR with session)');
  ok((await get('/admin', false)).status === 307, '/admin without session redirects to /login');
  for (const p of ['/admin', '/admin/matches', `/admin/matches/${m1.id}`, '/admin/knockout', '/admin/teams', '/admin/ratings', '/admin/awards', '/admin/payments', '/admin/registrations', '/admin/settings', '/admin/admins', '/admin/audit', '/admin/account']) {
    const r = await get(p);
    ok(r.status === 200 && !/Application error|Unhandled Runtime Error/.test(r.text), `${p} → ${r.status}`);
  }
  const mc = await get(`/admin/matches/${m1.id}`);
  ok(mc.text.includes('START MATCH') && mc.text.includes('GOAL SCORERS') && mc.text.includes('CARD HOLDERS'), 'match control: START MATCH + split goal/card sections');

  console.log('Match control flow (same RPCs as the UI)');
  const rpc = async (fn: string, args: Record<string, unknown>) => { const r = await sb.rpc(fn, args); if (r.error) throw new Error(r.error.message); return r.data; };
  const ver = async () => (await sb.from('matches').select('version').eq('id', m1.id).single()).data!.version;
  await rpc('admin_match_action', { p_match: m1.id, p_action: 'start', p_expected_version: await ver() });
  const pl = (await sb.from('players').select('*').in('team_id', [m1.home_team_id, m1.away_team_id])).data!;
  const home = pl.filter((p) => p.team_id === m1.home_team_id), away = pl.filter((p) => p.team_id === m1.away_team_id);
  const gid = randomUUID();
  await rpc('admin_event_save', { p_id: gid, p_match: m1.id, p_type: 'goal', p_team: m1.home_team_id, p_player: home[0].id, p_assist: home[1].id, p_minute: 3, p_note: null });
  await rpc('admin_event_save', { p_id: gid, p_match: m1.id, p_type: 'goal', p_team: m1.home_team_id, p_player: home[0].id, p_assist: home[1].id, p_minute: 3, p_note: null });
  await rpc('admin_event_save', { p_id: randomUUID(), p_match: m1.id, p_type: 'own_goal', p_team: m1.home_team_id, p_player: home[2].id, p_assist: null, p_minute: 6, p_note: null });
  await rpc('admin_event_save', { p_id: randomUUID(), p_match: m1.id, p_type: 'yellow', p_team: m1.away_team_id, p_player: away[0].id, p_assist: null, p_minute: 8, p_note: null });
  const sc = (await sb.from('match_scores').select('*').eq('match_id', m1.id).single()).data!;
  ok(sc.home_score === 1 && sc.away_score === 1, `score from events 1–1 (goal + own goal) got ${sc.home_score}–${sc.away_score}`);
  const pub = await get(`/matches/${m1.id}`, false);
  ok(pub.status === 200 && pub.text.includes(home[0].name), 'public match page shows the scorer');
  await rpc('admin_match_update', { p_match: m1.id, p_patch: { added_minutes: 1, mvp_player_id: home[0].id }, p_expected_version: await ver() });
  await rpc('admin_rating_set', { p_match: m1.id, p_player: home[0].id, p_rating: 8.5 });
  await rpc('admin_match_action', { p_match: m1.id, p_action: 'end', p_expected_version: await ver() });
  await rpc('admin_match_action', { p_match: m1.id, p_action: 'finalize', p_expected_version: await ver() });
  const st = await get('/standings', false);
  ok(st.status === 200, 'public standings render after a finalized result');
  const anonR = await createClient(url, need('NEXT_PUBLIC_SUPABASE_ANON_KEY')).from('player_match_ratings').select('*').eq('match_id', m1.id);
  ok((anonR.data ?? []).length === 0, 'unpublished rating hidden from anon');
  await rpc('admin_match_update', { p_match: m1.id, p_patch: { ratings_published: true }, p_expected_version: await ver() });
  const anonR2 = await createClient(url, need('NEXT_PUBLIC_SUPABASE_ANON_KEY')).from('player_match_ratings').select('*').eq('match_id', m1.id);
  ok((anonR2.data ?? []).length === 1, 'published rating visible to anon');

  console.log('Owner routes');
  const csv = await get('/api/admin/export?what=results');
  ok(csv.status === 200 && csv.text.includes('M01'), 'CSV export (results)');
  const csvAnon = await get('/api/admin/export?what=teams', false);
  ok(csvAnon.status !== 200, `CSV export blocked without session (${csvAnon.status})`);
  for (const p of ['/', '/fixtures', '/bracket', '/stats', '/teams', '/awards', '/rules', '/print']) {
    const r = await get(p, false);
    ok(r.status === 200 && !/Application error/.test(r.text), `public ${p}`);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
