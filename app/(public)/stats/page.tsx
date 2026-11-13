'use client';
import { useMemo } from 'react';
import { useSnap } from '@/components/public/LiveProvider';
import { SectionHead, TeamCrest } from '@/components/public/bits';
import { computePlayerStats, computeSuspensions, defenceRanking, fairPlayByTeam, goldenBoot, topAssists, topRated } from '@/lib/tournament';

function Board({ kicker, title, icon, empty, head, rows }: { kicker: string; title: string; icon: string; empty: string; head: string[]; rows: React.ReactNode[] }) {
  return (
    <div className="ws-card lime-bottom">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-sport)', fontSize: '0.72rem', color: 'var(--cyan)', letterSpacing: '0.14em' }}>{kicker}</div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--lime)' }}>{title}</h3>
        </div>
        <span style={{ fontSize: '1.6rem' }}>{icon}</span>
      </div>
      {rows.length === 0 ? <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', padding: '1rem 0' }}>{empty}</p> : (
        <div className="table-scroll">
          <table className="ws-table" style={{ minWidth: '100%' }}>
            <thead><tr>{head.map((h, i) => <th key={i} className={i === 1 ? 'col-team' : undefined}>{h}</th>)}</tr></thead>
            <tbody>{rows}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function StatsPage() {
  const snap = useSnap();
  const stats = useMemo(() => computePlayerStats(snap), [snap]);
  const boot = goldenBoot(stats), assists = topAssists(stats), rated = topRated(stats, snap.settings.rating_min_matches);
  const defence = defenceRanking(snap);
  const susp = computeSuspensions(snap);
  const fp = fairPlayByTeam(snap.matches.filter((m) => m.status !== 'cancelled'), snap.events, snap.settings);
  const carded = stats.filter((s) => s.yellow + s.red > 0).sort((a, b) => b.red - a.red || b.yellow - a.yellow);
  const mvps = stats.filter((s) => s.mvp > 0).sort((a, b) => b.mvp - a.mvp || b.goals - a.goals);
  const nm = (s: (typeof stats)[number]) => <><span style={{ color: '#fff', fontWeight: 700 }}>{s.player.name}</span>{s.player.jersey != null && <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}> #{s.player.jersey}</span>}</>;
  const tm = (s: (typeof stats)[number]) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><TeamCrest team={s.team} size={20} />{s.team?.short_code}</span>;
  return (
    <>
      <SectionHead kicker="❄️ LIVE INDIVIDUAL & TEAM METRICS" cyan="TOURNAMENT" lime="STATISTICS" />
      <div className="grid-2" style={{ marginBottom: '1.25rem' }}>
        <Board kicker="👟 TOP SCORERS" title="THE GOLDEN BOOT RACE" icon="👟" empty="No goals recorded yet." head={['#', 'PLAYER', 'TEAM', 'MP', 'A', 'GOALS']}
          rows={boot.slice(0, 10).map((s, i) => <tr key={s.player.id} className={s.rank === 1 ? 'row-qualified' : ''}><td><span className="rank-badge">{s.rank}</span></td><td className="col-team">{nm(s)}</td><td>{tm(s)}</td><td>{s.played}</td><td>{s.assists}</td><td className="pts-cell">{s.goals}</td></tr>)} />
        <Board kicker="🅰️ PLAYMAKERS" title="TOP ASSISTS" icon="🎯" empty="No assists recorded yet." head={['#', 'PLAYER', 'TEAM', 'G', 'ASSISTS']}
          rows={assists.slice(0, 10).map((s) => <tr key={s.player.id} className={s.rank === 1 ? 'row-qualified' : ''}><td><span className="rank-badge">{s.rank}</span></td><td className="col-team">{nm(s)}</td><td>{tm(s)}</td><td>{s.goals}</td><td className="pts-cell">{s.assists}</td></tr>)} />
      </div>
      <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '-0.75rem 0 1.25rem' }}>Golden Boot counts goals only (no own goals, no shootout penalties). Ties: fewer matches played, then more assists; otherwise shared.</p>
      <div className="grid-2" style={{ marginBottom: '1.25rem' }}>
        <Board kicker={`⭐ PUBLISHED RATINGS · MIN ${snap.settings.rating_min_matches} RATED MATCHES`} title="TOP RATED" icon="⭐" empty="Ratings appear here once published." head={['#', 'PLAYER', 'TEAM', 'RATED', 'AVG']}
          rows={rated.slice(0, 10).map((s) => <tr key={s.player.id} className={s.rank === 1 ? 'row-qualified' : ''}><td><span className="rank-badge">{s.rank}</span></td><td className="col-team">{nm(s)}</td><td>{tm(s)}</td><td>{s.ratedMatches}</td><td className="pts-cell">{s.ratingAvg?.toFixed(1)}</td></tr>)} />
        <Board kicker="👑 MOST VALUABLE PLAYER" title="THE WINTER CROWN TALLY" icon="👑" empty="No match MVPs named yet." head={['#', 'PLAYER', 'TEAM', 'MVP', 'GOALS']}
          rows={mvps.slice(0, 10).map((s, i) => <tr key={s.player.id} className={i === 0 ? 'row-qualified' : ''}><td><span className="rank-badge">{i + 1}</span></td><td className="col-team">{nm(s)}</td><td>{tm(s)}</td><td className="pts-cell">{s.mvp}</td><td>{s.goals}</td></tr>)} />
      </div>
      <div className="grid-2">
        <Board kicker="🛡️ FEWEST GOALS CONCEDED" title="THE IRON WALL & CLEAN SHEETS" icon="🧤" empty="" head={['#', 'TEAM (GK)', 'P', 'GA', 'CS']}
          rows={defence.map((d, i) => <tr key={d.team.id} className={i === 0 && d.P > 0 ? 'row-qualified' : ''}><td><span className="rank-badge">{i + 1}</span></td><td className="col-team"><div style={{ color: '#fff', fontWeight: 700 }}>{d.team.display_name}</div><div style={{ fontSize: '0.7rem', color: 'var(--cyan)' }}>GK: {d.gk?.name ?? '—'}</div></td><td>{d.P}</td><td style={{ color: 'var(--cyan)', fontWeight: 800 }}>{d.GA}</td><td className="pts-cell">{d.cleanSheets}</td></tr>)} />
        <Board kicker="🟨🟥 DISCIPLINARY & SUSPENSIONS (§10)" title="CARDS & FAIR-PLAY RECORD" icon="🟨" empty="Clean tournament so far — no cards issued." head={['#', 'PLAYER', 'TEAM', '🟨', '🟥', 'STATUS']}
          rows={carded.map((c, i) => { const s = susp.get(c.player.id); return <tr key={c.player.id}><td>{i + 1}</td><td className="col-team">{nm(c)}</td><td>{tm(c)}</td><td style={{ color: 'var(--warning)', fontWeight: 800 }}>{c.yellow}</td><td style={{ color: 'var(--danger)', fontWeight: 800 }}>{c.red}</td><td>{s?.kind === 'expelled' ? <span className="qual-tag qual-eliminated">EXPELLED</span> : s?.active ? <span className="mini-tag tag-susp">SUSPENDED NEXT MATCH</span> : <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Caution</span>}</td></tr>; })} />
      </div>
      <div className="ws-card" style={{ marginTop: '1.25rem' }}>
        <div className="rule-sec-title"><span>🤝 FAIR-PLAY TABLE (LOWER IS BETTER · 🟨=1 · 🟥=3 · FIGHTING 🟥=5)</span></div>
        <div className="table-scroll">
          <table className="ws-table" style={{ minWidth: '100%' }}>
            <thead><tr><th>#</th><th className="col-team">TEAM</th><th>FP PTS</th></tr></thead>
            <tbody>{[...snap.teams].sort((a, b) => (fp[a.id] ?? 0) - (fp[b.id] ?? 0)).map((t, i) => <tr key={t.id}><td>{i + 1}</td><td className="col-team"><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><TeamCrest team={t} size={20} />{t.display_name}</span></td><td className="pts-cell">{fp[t.id] ?? 0}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </>
  );
}
