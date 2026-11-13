'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { useSnap } from '@/components/public/LiveProvider';
import { useAdmin } from '@/components/admin/AdminContext';
import { confirmDialog } from '@/components/admin/Confirm';
import { useAction } from '@/components/admin/useAction';
import { FullStandings } from '@/components/public/Standings';
import { placeholderName } from '@/components/public/bits';
import { supabaseBrowser } from '@/lib/supabase/client';
import { computeGroupTable, displayStatus } from '@/lib/tournament';

export default function KnockoutAdmin() {
  const snap = useSnap();
  const { can } = useAdmin();
  const { busy, run } = useAction();
  const sb = supabaseBrowser();
  const tables = useMemo(() => snap.groups.map((g) => computeGroupTable(snap, g.id)), [snap]);
  const A = tables.find((g) => g.code === 'A'), B = tables.find((g) => g.code === 'B');
  const allDone = tables.every((g) => g.complete);
  const unresolvedTop = tables.some((g) => g.rows.slice(0, 3).filter((r) => r.unresolvedTie).length > 0 && g.rows.slice(1, 3).some((r) => r.unresolvedTie));
  const confirmed = !!snap.tournament.groups_confirmed_at;
  const q = { a1: A?.rows[0]?.team, a2: A?.rows[1]?.team, b1: B?.rows[0]?.team, b2: B?.rows[1]?.team };
  const ko = snap.matches.filter((m) => m.stage !== 'group').sort((a, b) => a.match_no - b.match_no);
  const t = (id: string | null) => snap.teams.find((x) => x.id === id);
  const owner = can('owner');

  const setLot = (teamId: string, v: string) => run(() => sb.from('teams').update({ lot_rank: v === '' ? null : Number(v) }).eq('id', teamId), 'Lot rank saved');

  return (
    <>
      <div className="section-head"><div className="section-title-wrap"><div className="section-kicker">❄️ CONFIRM STANDINGS → GENERATE SEMIFINALS</div><h2 className="section-title"><span className="word-cyan">STANDINGS &</span> <span className="word-lime">KNOCKOUT</span></h2><div className="section-underline" /></div></div>
      {snap.tournament.bracket_needs_review && (
        <div className="ws-card" style={{ borderLeft: '4px solid var(--warning)', marginBottom: '1rem', color: 'var(--warning)' }}>
          ⚠ A group result was reopened/changed after the semifinals were set. Qualification may have changed — re-confirm the standings and update the bracket below.
        </div>
      )}
      <div className="ws-card lime-bottom" style={{ marginBottom: '1.25rem' }}>
        <div className="rule-sec-title"><span>QUALIFIERS (FROM OFFICIAL §13 TIE-BREAKERS)</span><span className="badge-skew badge-ko">{allDone ? 'GROUPS COMPLETE' : `${tables.reduce((s, g) => s + g.finishedCount, 0)}/12 FINAL`}</span></div>
        <div className="grid-2" style={{ marginBottom: '0.8rem' }}>
          <div>SF1: <strong style={{ color: 'var(--lime)' }}>{q.a1?.display_name ?? 'A1'}</strong> (A1) vs <strong style={{ color: 'var(--lime)' }}>{q.b2?.display_name ?? 'B2'}</strong> (B2)</div>
          <div>SF2: <strong style={{ color: 'var(--lime)' }}>{q.b1?.display_name ?? 'B1'}</strong> (B1) vs <strong style={{ color: 'var(--lime)' }}>{q.a2?.display_name ?? 'A2'}</strong> (A2)</div>
        </div>
        {unresolvedTop && <p style={{ color: 'var(--warning)', fontSize: '0.85rem', marginBottom: '0.6rem' }}>⚠ Tie needs organizer decision: set lot ranks (1 = best) for the tied teams below.</p>}
        {owner ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {!confirmed ? (
              <button type="button" className="btn-skew btn-lime" disabled={busy || !allDone || unresolvedTop} onClick={async () => {
                if (await confirmDialog({ title: 'CONFIRM GROUP STANDINGS', body: <>Confirm the final standings? Qualifiers: A1 {q.a1?.display_name}, A2 {q.a2?.display_name}, B1 {q.b1?.display_name}, B2 {q.b2?.display_name}.</> }))
                  await run(() => sb.rpc('admin_confirm_groups', { p_tournament: snap.tournament.id, p_confirm: true }), 'Standings confirmed');
              }}><span>1 · CONFIRM GROUP STANDINGS</span></button>
            ) : (
              <button type="button" className="btn-skew btn-cyan-outline" disabled={busy} onClick={() => run(() => sb.rpc('admin_confirm_groups', { p_tournament: snap.tournament.id, p_confirm: false }), 'Confirmation withdrawn')}><span>✓ CONFIRMED — UNDO</span></button>
            )}
            <button type="button" className="btn-skew btn-lime" disabled={busy || !confirmed || !q.a1 || !q.a2 || !q.b1 || !q.b2} onClick={async () => {
              if (await confirmDialog({ title: 'GENERATE SEMIFINALS', body: <>Set SF1 {q.a1?.display_name} vs {q.b2?.display_name} and SF2 {q.b1?.display_name} vs {q.a2?.display_name}? Started knockout matches are never overwritten.</> }))
                await run(() => sb.rpc('admin_generate_semis', { p_tournament: snap.tournament.id, p_a1: q.a1!.id, p_a2: q.a2!.id, p_b1: q.b1!.id, p_b2: q.b2!.id }), 'Semifinals set');
            }}><span>2 · GENERATE / UPDATE SEMIFINALS</span></button>
          </div>
        ) : <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Only owners can confirm standings and generate the bracket.</p>}
        {!allDone && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Finalize all 12 group matches first.</p>}
      </div>

      <div className="ws-card" style={{ marginBottom: '1.25rem' }}>
        <div className="rule-sec-title"><span>KNOCKOUT MATCHES</span></div>
        {ko.map((m) => (
          <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', alignItems: 'center' }}>
            <span><strong>{m.code}</strong> · {t(m.home_team_id)?.display_name ?? placeholderName(m.home_placeholder)} vs {t(m.away_team_id)?.display_name ?? placeholderName(m.away_placeholder)} · {displayStatus(m)}</span>
            <Link href={`/admin/matches/${m.id}`} className="btn-skew btn-cyan-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}><span>MATCH CONTROL</span></Link>
          </div>
        ))}
        <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>The final is filled automatically when both semifinals are finalized.</p>
      </div>

      {tables.map((g) => (
        <div key={g.groupId} style={{ marginBottom: '1.25rem' }}>
          <FullStandings g={g} snap={snap} withFixtures={false} />
          {owner && (
            <div className="ws-card" style={{ marginTop: '0.5rem' }}>
              <div className="form-label">ORGANISER LOT RANK (§13.5 — USED ONLY IF STILL TIED; 1 = BEST)</div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {g.rows.map((r) => (
                  <label key={r.team.id} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.84rem' }}>
                    {r.team.short_code}{r.unresolvedTie && <span style={{ color: 'var(--warning)' }}>⚠</span>}
                    <select className="form-select" style={{ width: 70 }} value={r.team.lot_rank ?? ''} disabled={busy} onChange={(e) => setLot(r.team.id, e.target.value)}>
                      <option value="">—</option>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>#{n}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
