'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSnap } from '@/components/public/LiveProvider';
import { TeamCrest } from '@/components/public/bits';
import { computePlayerStats } from '@/lib/tournament';

// Player ratings across the tournament (match-by-match). Helps pick the player of the tournament — a guide, not a decision.
export default function RatingsOverview() {
  const snap = useSnap();
  const [minN, setMinN] = useState(snap.settings.rating_min_matches);
  const [team, setTeam] = useState('');
  const stats = useMemo(() => computePlayerStats(snap), [snap]);
  const matches = [...snap.matches].sort((a, b) => a.match_no - b.match_no);
  const rated = matches.filter((m) => snap.ratings.some((r) => r.match_id === m.id));
  const rows = snap.players.map((p) => {
    const rs = snap.ratings.filter((r) => r.player_id === p.id);
    const avg = rs.length ? rs.reduce((s, r) => s + Number(r.rating), 0) / rs.length : null;
    return { p, rs, avg, st: stats.find((s) => s.player.id === p.id)!, team: snap.teams.find((t) => t.id === p.team_id) };
  }).filter((r) => r.avg != null && r.rs.length >= minN && (!team || r.p.team_id === team))
    .sort((a, b) => b.avg! - a.avg! || b.rs.length - a.rs.length);
  return (
    <>
      <div className="section-head"><div className="section-title-wrap"><div className="section-kicker">⭐ MATCH-BY-MATCH RATINGS · GUIDE FOR PLAYER OF THE TOURNAMENT (NOT DECISIVE)</div><h2 className="section-title"><span className="word-cyan">PLAYER</span> <span className="word-lime">RATINGS</span></h2><div className="section-underline" /></div></div>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.8rem', alignItems: 'center' }}>
        <label style={{ fontSize: '0.82rem' }}>Min. rated matches{' '}
          <select className="form-select" style={{ width: 70, display: 'inline-block' }} value={minN} onChange={(e) => setMinN(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
        </label>
        <select className="form-select" style={{ maxWidth: 220 }} value={team} onChange={(e) => setTeam(e.target.value)}><option value="">All teams</option>{snap.teams.map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}</select>
        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Average = mean of every rating the player received (published or not). Rate players in each match&apos;s Match Control.</span>
      </div>
      <div className="ws-card">
        {rows.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No players with at least {minN} rated match{minN === 1 ? '' : 'es'} yet.</p> : (
          <div className="table-scroll">
            <table className="ws-table" style={{ minWidth: '100%' }}>
              <thead><tr><th>#</th><th className="col-team">PLAYER</th><th>AVG</th><th>RATED</th><th>G</th><th>A</th><th>MVP</th>{rated.map((m) => <th key={m.id}>{m.code}</th>)}</tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.p.id} className={i < 3 ? 'row-qualified' : ''}>
                    <td><span className="rank-badge">{i + 1}</span></td>
                    <td className="col-team"><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><TeamCrest team={r.team} size={20} /><strong>{r.p.name}</strong></span></td>
                    <td className="pts-cell">{r.avg!.toFixed(2)}</td>
                    <td>{r.rs.length}</td><td>{r.st.goals}</td><td>{r.st.assists}</td><td>{r.st.mvp}</td>
                    {rated.map((m) => { const x = r.rs.find((z) => z.match_id === m.id); return <td key={m.id} style={{ color: x ? '#fff' : 'var(--text-muted)' }}>{x ? <Link href={`/admin/matches/${m.id}`} style={{ color: 'inherit' }}>{Number(x.rating).toFixed(1)}</Link> : '·'}</td>; })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
