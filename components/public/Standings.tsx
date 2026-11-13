'use client';
import Link from 'next/link';
import type { GroupTable, StandingRow } from '@/lib/tournament';
import type { Snapshot } from '@/lib/types';
import { MatchCard, TeamCrest } from './bits';

function QualTag({ r, full }: { r: StandingRow; full?: boolean }) {
  if (r.qualStatus === 'CONFIRMED') return <span className="qual-tag qual-confirmed">{full ? '✓ CONFIRMED Q' : 'Q'}</span>;
  if (r.qualStatus === 'TOP2') return <span className="qual-tag qual-top2">{full ? 'PROVISIONAL Q' : 'TOP 2'}</span>;
  if (r.qualStatus === 'ELIMINATED' && full) return <span className="qual-tag qual-eliminated">ELIMINATED</span>;
  return null;
}

export function MiniStandings({ g }: { g: GroupTable }) {
  return (
    <div className="ws-card chamfer">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
        <span className={`badge-skew ${g.code === 'A' ? 'badge-group-a' : 'badge-group-b'}`} style={{ fontSize: '0.82rem' }}>GROUP {g.code}</span>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>TOP 2 ADVANCE TO SEMIFINALS</span>
      </div>
      <div className="table-scroll">
        <table className="ws-table" style={{ minWidth: '100%' }}>
          <thead><tr><th>#</th><th className="col-team">TEAM</th><th>P</th><th>GD</th><th>FP</th><th>PTS</th></tr></thead>
          <tbody>
            {g.rows.map((r) => (
              <tr key={r.team.id} className={r.rank <= 2 ? 'row-qualified' : ''}>
                <td className="col-rank"><span className="rank-badge">{r.rank}</span></td>
                <td className="col-team">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <TeamCrest team={r.team} size={22} />
                    <span style={{ color: '#fff', fontWeight: 700 }}>{r.team.display_name}</span>
                    <QualTag r={r} />
                  </div>
                </td>
                <td>{r.P}</td>
                <td>{r.GD > 0 ? `+${r.GD}` : r.GD}</td>
                <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }} title="Fair-play disciplinary points (lower is better)">{r.fairPlay}</td>
                <td className="pts-cell">{r.Pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FullStandings({ g, snap, withFixtures = true }: { g: GroupTable; snap: Snapshot; withFixtures?: boolean }) {
  const fixtures = snap.matches.filter((m) => m.stage === 'group' && m.group_id === g.groupId);
  return (
    <section className="ws-card lime-bottom">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span className={`badge-skew ${g.code === 'A' ? 'badge-group-a' : 'badge-group-b'}`} style={{ fontSize: '0.9rem', padding: '0.25rem 0.75rem' }}>GROUP {g.code} STANDINGS</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>({g.finishedCount} / {g.totalCount} matches final)</span>
        </div>
        <div style={{ fontSize: '0.74rem', color: 'var(--lime)', fontFamily: 'var(--font-sport)' }}>🟢 TOP 2 QUALIFY · FP = FAIR-PLAY PTS (🟨=1, 🟥=3, FIGHTING 🟥=5)</div>
      </div>
      <div className="table-scroll">
        <table className="ws-table">
          <thead>
            <tr><th>POS</th><th className="col-team">TEAM</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th title="Fair-play points (lower is better)">FP</th><th>PTS</th><th>FORM</th></tr>
          </thead>
          <tbody>
            {g.rows.map((r) => (
              <tr key={r.team.id} className={r.rank <= 2 ? 'row-qualified' : ''}>
                <td className="col-rank"><span className="rank-badge">{r.rank}</span></td>
                <td className="col-team">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                    <TeamCrest team={r.team} />
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.94rem' }}>{r.team.display_name}</span>
                    <QualTag r={r} full />
                  </div>
                </td>
                <td>{r.P}</td><td>{r.W}</td><td>{r.D}</td><td>{r.L}</td><td>{r.GF}</td><td>{r.GA}</td>
                <td style={{ color: r.GD > 0 ? 'var(--lime)' : r.GD < 0 ? '#FF8FA3' : 'var(--text-soft)' }}>{r.GD > 0 ? `+${r.GD}` : r.GD}</td>
                <td style={{ color: r.fairPlay === 0 ? 'var(--cyan)' : 'var(--warning)' }}>{r.fairPlay}</td>
                <td className="pts-cell">{r.Pts}</td>
                <td>
                  <div className="form-chips">
                    {[0, 1, 2].map((i) => (r.form[i] ? <span key={i} className={`form-chip form-${r.form[i]}`}>{r.form[i]}</span> : <span key={i} className="form-chip form-empty">-</span>))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {withFixtures && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontFamily: 'var(--font-sport)', fontSize: '0.78rem', color: 'var(--cyan)', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>GROUP {g.code} FIXTURES</div>
          <div className="grid-2">{fixtures.map((m) => <MatchCard key={m.id} m={m} snap={snap} compact />)}</div>
        </div>
      )}
      <div style={{ marginTop: '0.75rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
        Standings count finalized results only. <Link href="/rules" style={{ color: 'var(--cyan)' }}>Tie-breakers (§13)</Link>: GD → GF → head-to-head → fair play → organiser decision.
      </div>
    </section>
  );
}
