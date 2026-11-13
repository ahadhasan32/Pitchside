import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { loadSnapshot } from '@/lib/data';

const csv = (rows: (string | number | null | undefined)[][]) =>
  '﻿' + rows.map((r) => r.map((v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n');

// Owner-only CSV exports (backup / offline use). Runs with the caller's session, so RLS still applies.
export async function GET(req: NextRequest) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: me } = await sb.from('admin_users').select('role').eq('user_id', user.id).maybeSingle();
  if (me?.role !== 'owner') return NextResponse.json({ error: 'owner only' }, { status: 403 });
  const what = req.nextUrl.searchParams.get('what') ?? 'teams';
  const snap = await loadSnapshot(sb);
  const team = (id: string | null) => snap.teams.find((t) => t.id === id);
  let rows: (string | number | null | undefined)[][] = [];
  if (what === 'teams') {
    const [{ data: tp }, { data: pp }] = await Promise.all([sb.from('team_private').select('*'), sb.from('player_private').select('*')]);
    rows.push(['reg_id', 'team', 'display_name', 'group', 'team_phone', 'bkash_trx', 'registered_at', 'terms', 'player_slot', 'player', 'position', 'jersey', 'active', 'institution', 'age', 'phone']);
    for (const t of snap.teams) {
      const p1 = tp?.find((x) => x.team_id === t.id);
      for (const p of snap.players.filter((x) => x.team_id === t.id)) {
        const p2 = pp?.find((x) => x.player_id === p.id);
        rows.push([p1?.reg_id, t.name, t.display_name, snap.groups.find((g) => g.id === t.group_id)?.code, p1?.contact_phone, p1?.bkash_trx, p1?.registered_at, p1?.terms_accepted, p.slot, p.name, p.position, p.jersey, p.active ? 'yes' : 'no', p2?.institution, p2?.age, p2?.phone]);
      }
    }
  } else if (what === 'payments') {
    const [{ data: pays }, { data: tp }] = await Promise.all([sb.from('payments').select('*').order('created_at'), sb.from('team_private').select('team_id, reg_id, fee_total')]);
    rows.push(['status', 'reg_id', 'team', 'amount', 'paid_on', 'method', 'trx_id', 'note', 'recorded_at']);
    for (const p of pays ?? []) rows.push([p.voided_at ? 'void' : 'ok',tp?.find((x) => x.team_id === p.team_id)?.reg_id, team(p.team_id)?.name, p.amount, p.paid_on, p.method, p.trx_id, p.note, p.created_at]);
    rows.push([]); rows.push(['reg_id', 'team', 'fee', 'paid', 'due']);
    for (const t of snap.teams) {
      const fee = Number(tp?.find((x) => x.team_id === t.id)?.fee_total ?? 0);
      const paid = (pays ?? []).filter((p) => p.team_id === t.id && !p.voided_at).reduce((s, p) => s + Number(p.amount), 0);
      rows.push([tp?.find((x) => x.team_id === t.id)?.reg_id, t.name, fee, paid, fee - paid]);
    }
  } else {
    rows.push(['match', 'stage', 'scheduled_at', 'home', 'away', 'home_score', 'away_score', 'pens', 'status', 'finalized', 'result_type', 'scorers']);
    for (const m of snap.matches) {
      const goals = snap.events.filter((e) => e.match_id === m.id && (e.type === 'goal' || e.type === 'own_goal'))
        .map((e) => `${snap.players.find((p) => p.id === e.player_id)?.name}${e.type === 'own_goal' ? ' (OG)' : ''}${e.minute != null ? ` ${e.minute}'` : ''}`).join('; ');
      rows.push([m.code, m.stage, m.scheduled_at, team(m.home_team_id)?.display_name ?? m.home_placeholder, team(m.away_team_id)?.display_name ?? m.away_placeholder, m.home_score, m.away_score, m.pen_home != null ? `${m.pen_home}-${m.pen_away}` : '', m.status, m.finalized ? 'yes' : 'no', m.result_type, goals]);
    }
  }
  return new NextResponse(csv(rows), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="winter-showdown-${what}-${new Date().toISOString().slice(0, 10)}.csv"`, 'cache-control': 'no-store' } });
}
