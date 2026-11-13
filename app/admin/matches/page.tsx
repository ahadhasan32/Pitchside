'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useSnap } from '@/components/public/LiveProvider';
import { useAdmin } from '@/components/admin/AdminContext';
import { confirmDialog } from '@/components/admin/Confirm';
import { useAction } from '@/components/admin/useAction';
import { TeamCrest, fmtTimeAmPm, placeholderName } from '@/components/public/bits';
import { supabaseBrowser } from '@/lib/supabase/client';
import { displayStatus, stageLabel } from '@/lib/tournament';

export default function AdminMatches() {
  const snap = useSnap();
  const { can } = useAdmin();
  const { busy, run } = useAction();
  const sb = supabaseBrowser();
  const [adding, setAdding] = useState(false);
  const t = (id: string | null) => snap.teams.find((x) => x.id === id);
  const g = (id: string | null) => snap.groups.find((x) => x.id === id)?.code;
  return (
    <>
      <div className="section-head">
        <div className="section-title-wrap"><div className="section-kicker">❄️ TAP A MATCH TO OPEN MATCH CONTROL</div><h2 className="section-title"><span className="word-cyan">ALL</span> <span className="word-lime">MATCHES</span></h2><div className="section-underline" /></div>
        {can('owner') && <button type="button" className="btn-skew btn-cyan-outline" onClick={() => setAdding((v) => !v)}><span>+ ADD MATCH</span></button>}
      </div>
      {adding && <AddMatch busy={busy} run={run} onDone={() => setAdding(false)} />}
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        {[...snap.matches].sort((a, b) => a.match_no - b.match_no).map((m) => {
          const st = displayStatus(m);
          return (
            <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.4rem', alignItems: 'center' }}>
              <Link href={`/admin/matches/${m.id}`} className="ws-card" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '0.6rem', alignItems: 'center', padding: '0.7rem 0.85rem', textDecoration: 'none', color: 'inherit', minHeight: 56, opacity: m.status === 'cancelled' ? 0.55 : 1 }}>
                <span style={{ fontFamily: 'var(--font-display)', color: 'var(--text-muted)' }}>{String(m.match_no).padStart(2, '0')}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', minWidth: 0 }}>
                  <TeamCrest team={t(m.home_team_id)} label={m.home_placeholder ?? ''} size={24} />
                  <span style={{ fontWeight: 700 }}>{t(m.home_team_id)?.display_name ?? placeholderName(m.home_placeholder)}</span>
                  <span style={{ fontFamily: 'var(--font-tall)', fontSize: '1.4rem', color: 'var(--lime)' }}>{m.status === 'scheduled' && m.result_type === 'normal' ? 'vs' : `${m.home_score}–${m.away_score}`}</span>
                  <span style={{ fontWeight: 700 }}>{t(m.away_team_id)?.display_name ?? placeholderName(m.away_placeholder)}</span>
                  <TeamCrest team={t(m.away_team_id)} label={m.away_placeholder ?? ''} size={24} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', width: '100%' }}>{stageLabel(m, g(m.group_id))} · {fmtTimeAmPm(m.scheduled_at)}{m.details_incomplete ? ' · ⚠ details incomplete' : ''}</span>
                </span>
                <span className={`status-pill ${st === 'LIVE' ? 'status-live' : st === 'FT' || st === 'FULL TIME' ? 'status-finished' : 'status-upcoming'}`}>{st === 'FULL TIME' ? 'FT (not final)' : st}</span>
              </Link>
              {m.status === 'cancelled' && can('owner') && (
                <button type="button" className="btn-skew btn-cyan-outline" disabled={busy} onClick={async () => {
                  if (await confirmDialog({ title: 'RESTORE MATCH', body: 'Put this cancelled match back on the schedule?' })) await run(() => sb.rpc('admin_match_restore', { p_match: m.id }), 'Match restored');
                }}><span>RESTORE</span></button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function AddMatch({ busy, run, onDone }: { busy: boolean; run: ReturnType<typeof useAction>['run']; onDone: () => void }) {
  const snap = useSnap();
  const sb = supabaseBrowser();
  const active = snap.teams.filter((t) => t.status !== 'withdrawn');
  const [f, setF] = useState({ stage: 'group', group: snap.groups[0]?.id ?? '', home: '', away: '', time: '' });
  return (
    <form className="ws-card lime-bottom" style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', alignItems: 'end' }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!f.home || !f.away || f.home === f.away) return;
        const at = f.time ? new Date(`2026-11-13T${f.time}:00+06:00`).toISOString() : null;
        const ok = await run(() => sb.rpc('admin_match_create', { p_tournament: snap.tournament.id, p_stage: f.stage, p_group: f.stage === 'group' ? f.group : null, p_home: f.home, p_away: f.away, p_at: at }), 'Match added');
        if (ok) onDone();
      }}>
      <div><label className="form-label">STAGE</label><select className="form-select" value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}><option value="group">Group</option><option value="semifinal">Semifinal</option><option value="final">Final</option><option value="third_place">Third place</option></select></div>
      {f.stage === 'group' && <div><label className="form-label">GROUP</label><select className="form-select" value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })}>{snap.groups.map((g) => <option key={g.id} value={g.id}>Group {g.code}</option>)}</select></div>}
      <div><label className="form-label">HOME</label><select className="form-select" value={f.home} onChange={(e) => setF({ ...f, home: e.target.value })}><option value="">—</option>{active.map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}</select></div>
      <div><label className="form-label">AWAY</label><select className="form-select" value={f.away} onChange={(e) => setF({ ...f, away: e.target.value })}><option value="">—</option>{active.map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}</select></div>
      <div><label className="form-label">KICK-OFF (13 NOV, 24H)</label><input className="form-input" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></div>
      <button className="btn-skew btn-lime" disabled={busy || !f.home || !f.away || f.home === f.away}><span>ADD MATCH</span></button>
    </form>
  );
}
