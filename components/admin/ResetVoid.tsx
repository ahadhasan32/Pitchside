'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useSnap } from '@/components/public/LiveProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useAdmin } from './AdminContext';
import { useAction } from './useAction';
import type { Match, Snapshot } from '@/lib/types';

/** Knockout matches that depend on this one and have started/finished (these block a reset or void). */
export function blockingDependents(snap: Snapshot, m: Match): Match[] {
  const deps = m.stage === 'group' ? ['semifinal', 'final', 'third_place'] : m.stage === 'semifinal' ? ['final', 'third_place'] : [];
  return snap.matches.filter((d) => deps.includes(d.stage) && (d.status === 'live' || d.status === 'full_time' || d.finalized)).sort((a, b) => b.match_no - a.match_no);
}

export function resetSummary(snap: Snapshot, m: Match) {
  const ev = snap.events.filter((e) => e.match_id === m.id);
  return {
    goals: ev.filter((e) => e.type === 'goal').length,
    ownGoals: ev.filter((e) => e.type === 'own_goal').length,
    cards: ev.filter((e) => !['goal', 'own_goal'].includes(e.type)).length,
    ratings: snap.ratings.filter((r) => r.match_id === m.id).length,
    lineup: snap.lineups.filter((l) => l.match_id === m.id).length,
    mvp: !!m.mvp_player_id,
    extras: m.added_minutes > 0 || m.var_home > 0 || m.var_away > 0 || m.pen_home != null || m.pen_away != null,
    finalized: m.finalized,
    events: ev.length,
  };
}

type Kind = 'reset' | 'void';

/** Reset / void / restore controls for one match, with a dialog that lists exactly what will change. */
export function ResetVoidControls({ m, autoOpen = false }: { m: Match; autoOpen?: boolean }) {
  const snap = useSnap();
  const { can, toast } = useAdmin();
  const { busy, run } = useAction();
  const sb = supabaseBrowser();
  const [open, setOpen] = useState<Kind | null>(null);
  const [typed, setTyped] = useState('');
  const [restorable, setRestorable] = useState<{ id: string; at: string } | null>(null);

  const loadRestorable = useCallback(async () => {
    const { data } = await sb.from('match_resets').select('id, at').eq('match_id', m.id).eq('discarded', false).is('restored_at', null).order('at', { ascending: false }).limit(1);
    setRestorable(data?.[0] ?? null);
  }, [sb, m.id]);
  const evCount = snap.events.filter((e) => e.match_id === m.id).length;
  useEffect(() => { void loadRestorable(); }, [loadRestorable, m.version, evCount]);
  useEffect(() => { if (autoOpen) setOpen('reset'); }, [autoOpen]);

  const s = resetSummary(snap, m);
  const blockers = blockingDependents(snap, m);
  const needsTyping = s.finalized || s.events > 0;
  const semisSet = snap.matches.some((x) => x.stage === 'semifinal' && (x.home_team_id || x.away_team_id));
  const finalHasTeams = snap.matches.some((x) => x.stage === 'final' && (x.home_team_id || x.away_team_id) && x.status === 'scheduled');
  const touched = m.status !== 'scheduled' || m.finalized || s.events > 0 || s.ratings > 0;
  const canRestoreReset = restorable && m.status === 'scheduled' && s.events === 0;

  const submit = async () => {
    const kind = open!;
    const ok = await run(() => kind === 'reset'
      ? sb.rpc('admin_match_reset', { p_match: m.id, p_confirm: typed || null })
      : sb.rpc('admin_match_void', { p_match: m.id, p_confirm: typed || null }), kind === 'reset' ? `${m.code} reset to scheduled — "Restore last reset" can undo it` : `${m.code} voided`);
    if (ok) { setOpen(null); setTyped(''); void loadRestorable(); }
  };

  return (
    <>
      {touched && m.status !== 'cancelled' && (
        <button type="button" className="btn-skew btn-danger-outline" style={{ minHeight: 48 }} disabled={busy} onClick={() => { setTyped(''); setOpen('reset'); }}><span>↺ RESET MATCH</span></button>
      )}
      {canRestoreReset && (
        <button type="button" className="btn-skew btn-cyan-outline" style={{ minHeight: 48 }} disabled={busy}
          onClick={() => run(() => sb.rpc('admin_match_reset_restore', { p_match: m.id }), 'Last reset restored').then(() => loadRestorable())}><span>⟲ RESTORE LAST RESET</span></button>
      )}
      {can('owner') && m.status !== 'cancelled' && (
        <button type="button" className="btn-skew btn-cyan-outline" style={{ minHeight: 48 }} disabled={busy} onClick={() => { setTyped(''); setOpen('void'); }}><span>⊘ VOID MATCH</span></button>
      )}
      {can('owner') && m.status === 'cancelled' && (
        <button type="button" className="btn-skew btn-lime" style={{ minHeight: 48 }} disabled={busy}
          onClick={() => run(() => sb.rpc('admin_match_restore', { p_match: m.id }), `${m.code} restored`)}><span>⟲ RESTORE MATCH</span></button>
      )}

      {open && (
        <div className="modal-backdrop open" style={{ display: 'flex' }} role="dialog" aria-modal="true">
          <div className="modal-panel" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div className="modal-title">{open === 'reset' ? `↺ RESET ${m.code}` : `⊘ VOID ${m.code}`}</div>
              <button type="button" className="close-btn" onClick={() => setOpen(null)}>×</button>
            </div>
            {blockers.length > 0 ? (
              <div style={{ fontSize: '0.9rem', color: 'var(--text-soft)' }}>
                <p style={{ color: 'var(--warning)', fontWeight: 700, marginBottom: '0.5rem' }}>This result decided later knockout matches that have already been played. Reset them first (latest first):</p>
                <div style={{ display: 'grid', gap: '0.4rem', marginBottom: '0.8rem' }}>
                  {blockers.map((d) => (
                    <Link key={d.id} href={`/admin/matches/${d.id}?reset=1`} className="btn-skew btn-cyan-outline" style={{ justifySelf: 'start' }} onClick={() => setOpen(null)}>
                      <span>Open {d.code} ({d.finalized ? 'finalized' : d.status.replace('_', ' ')}) → reset it</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-soft)', marginBottom: '0.5rem' }}>
                  {open === 'reset'
                    ? 'The match goes back to Scheduled, 0–0, and disappears from standings, leaderboards, "last played" and the ticker. Everything below is cleared in one step:'
                    : 'The match is marked void: kept with its history but excluded from standings, stats and the public site. "Restore match" brings it back exactly as it was.'}
                </p>
                {open === 'reset' && (
                  <ul className="rule-list" style={{ marginBottom: '0.6rem' }}>
                    <li>{s.goals} goal{s.goals === 1 ? '' : 's'} and {s.ownGoals} own goal{s.ownGoals === 1 ? '' : 's'}</li>
                    <li>{s.cards} card{s.cards === 1 ? '' : 's'}</li>
                    <li>{s.ratings} player rating{s.ratings === 1 ? '' : 's'}</li>
                    <li>MVP: {s.mvp ? 'cleared' : 'none set'}</li>
                    <li>Added time, VAR usage and penalties: {s.extras ? 'cleared' : 'none recorded'}</li>
                    <li>&quot;Who played&quot; lineup: {s.lineup ? `${s.lineup} entries cleared (back to whole roster)` : 'default (whole roster)'}</li>
                    <li>Finalized state: {s.finalized ? 'removed (no longer counts)' : 'not finalized'}</li>
                  </ul>
                )}
                {open === 'reset' && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>Reversible: nothing is deleted. Use “Restore last reset” until new events are recorded for this match. Logged in the audit log.</p>}
                {m.stage === 'group' && semisSet && <p style={{ color: 'var(--warning)', fontSize: '0.84rem', marginBottom: '0.5rem' }}>⚠ The semifinals are already set — qualification may change. <Link href="/admin/knockout" style={{ color: 'var(--lime)' }}>Review the bracket</Link> afterwards.</p>}
                {m.stage === 'semifinal' && finalHasTeams && <p style={{ color: 'var(--warning)', fontSize: '0.84rem', marginBottom: '0.5rem' }}>⚠ The final already has teams: this semifinal&apos;s winner slot in the final is cleared until it is finalized again.</p>}
                {needsTyping && (
                  <div style={{ marginBottom: '0.8rem' }}>
                    <label className="form-label">TYPE {m.code} TO CONFIRM</label>
                    <input className="form-input" autoFocus value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} placeholder={m.code} style={{ maxWidth: 180 }} />
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button type="button" className="btn-skew btn-cyan-outline" onClick={() => setOpen(null)}><span>CANCEL</span></button>
                  <button type="button" className="btn-skew btn-danger-outline" disabled={busy || (needsTyping && typed.trim() !== m.code.toUpperCase())}
                    onClick={() => { if (needsTyping && typed.trim() !== m.code.toUpperCase()) return toast(`Type ${m.code} to confirm`, true); void submit(); }}>
                    <span>{busy ? 'WORKING…' : open === 'reset' ? 'RESET MATCH' : 'VOID MATCH'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
