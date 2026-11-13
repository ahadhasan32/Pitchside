'use client';
import { useMemo } from 'react';
import { useSnap } from '@/components/public/LiveProvider';
import { fmtTimeAmPm, placeholderName } from '@/components/public/bits';
import { FullStandings } from '@/components/public/Standings';
import { Rulebook } from '@/components/public/Rulebook';
import { computeGroupTable, displayStatus, showsScore, stageLabel } from '@/lib/tournament';

export default function PrintPage() {
  const snap = useSnap();
  const tables = useMemo(() => snap.groups.map((g) => computeGroupTable(snap, g.id)), [snap]);
  const t = (id: string | null) => snap.teams.find((x) => x.id === id)?.display_name;
  return (
    <>
      <div className="no-print" style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn-skew btn-lime" onClick={() => window.print()}><span>🖨️ PRINT THIS PAGE</span></button>
      </div>
      <h2 className="section-title" style={{ marginBottom: '1rem' }}><span className="word-cyan">WINTER SHOWDOWN 2026</span> <span className="word-lime">STANDINGS & SCHEDULE</span></h2>
      <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.25rem' }}>{tables.map((g) => <FullStandings key={g.groupId} g={g} snap={snap} withFixtures={false} />)}</div>
      <div className="ws-card" style={{ marginBottom: '1.25rem' }}>
        <div className="rule-sec-title"><span>MATCH SCHEDULE — 13 NOV 2026, OFFSIDE – HOME OF FOOTBALL</span></div>
        <table className="ws-table" style={{ minWidth: '100%' }}>
          <thead><tr><th>#</th><th>TIME</th><th>STAGE</th><th className="col-team">HOME</th><th>SCORE</th><th className="col-team">AWAY</th><th>STATUS</th></tr></thead>
          <tbody>
            {[...snap.matches].sort((a, b) => a.match_no - b.match_no).map((m) => (
              <tr key={m.id}>
                <td>{m.match_no}</td><td>{fmtTimeAmPm(m.scheduled_at)}</td><td>{stageLabel(m, snap.groups.find((g) => g.id === m.group_id)?.code)}</td>
                <td className="col-team">{t(m.home_team_id) ?? placeholderName(m.home_placeholder)}</td>
                <td className="pts-cell">{showsScore(m) ? `${m.home_score}–${m.away_score}${m.pen_home != null && m.pen_away != null && m.stage !== 'group' ? ` (${m.pen_home}–${m.pen_away}p)` : ''}` : 'vs'}</td>
                <td className="col-team">{t(m.away_team_id) ?? placeholderName(m.away_placeholder)}</td><td>{displayStatus(m)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Rulebook />
    </>
  );
}
