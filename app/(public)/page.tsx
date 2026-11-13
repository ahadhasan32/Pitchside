'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSnap } from '@/components/public/LiveProvider';
import { MatchCard, SectionHead, useLookups } from '@/components/public/bits';
import { MiniStandings } from '@/components/public/Standings';
import { FinaleSection } from '@/components/public/Finale';
import { awardsRevealed } from '@/components/public/Shell';
import { computeGroupTable, stageLabel } from '@/lib/tournament';
import type { Match } from '@/lib/types';

function Countdown({ iso }: { iso: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (now == null) return null;
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return null;
  const pad = (n: number) => String(Math.max(0, n)).padStart(2, '0');
  const d = Math.floor(diff / 86400000), h = Math.floor((diff / 3600000) % 24), m = Math.floor((diff / 60000) % 60), s = Math.floor((diff / 1000) % 60);
  return (
    <div className="countdown-wrap" style={{ marginTop: '1.2rem' }}>
      <div className="countdown-label">❄️ FIRST KICK-OFF IN</div>
      <div className="countdown-grid">
        {[[d, 'DAYS'], [h, 'HOURS'], [m, 'MINS'], [s, 'SECS']].map(([v, u]) => (
          <div className="cd-cell" key={u as string}><div className="cd-num">{pad(v as number)}</div><div className="cd-unit">{u}</div></div>
        ))}
      </div>
    </div>
  );
}

function Slot({ title, m, empty }: { title: string; m: Match | undefined; empty: string }) {
  const snap = useSnap();
  const { player, group } = useLookups(snap);
  let scorers = '';
  if (m) {
    const by = new Map<string, number>();
    for (const e of snap.events.filter((x) => x.match_id === m.id && (x.type === 'goal' || x.type === 'own_goal'))) {
      const n = (player(e.player_id)?.name ?? '?') + (e.type === 'own_goal' ? ' (OG)' : '');
      by.set(n, (by.get(n) ?? 0) + 1);
    }
    scorers = [...by.entries()].map(([n, c]) => `${n} ${'⚽'.repeat(c)}`).join(' · ');
  }
  return (
    <div>
      <div className="slot-title">{title}</div>
      {m ? (
        <>
          <div className="slot-sub">{stageLabel(m, group(m.group_id)?.code)} — MATCH {String(m.match_no).padStart(2, '0')}</div>
          <MatchCard m={m} snap={snap} compact />
          {scorers && <div className="goal-list" style={{ marginTop: '0.4rem' }}>{scorers}</div>}
        </>
      ) : <div className="ws-card" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>{empty}</div>}
    </div>
  );
}

export default function HomePage() {
  const snap = useSnap();
  const groups = useMemo(() => snap.groups.map((g) => computeGroupTable(snap, g.id)), [snap]);
  const sorted = [...snap.matches].filter((m) => m.status !== 'cancelled').sort((a, b) => a.match_no - b.match_no);
  const live = sorted.filter((m) => m.status === 'live');
  const played = sorted.filter((m) => m.status === 'full_time' || m.finalized)
    .sort((a, b) => (b.ended_at ?? b.finalized_at ?? '').localeCompare(a.ended_at ?? a.finalized_at ?? '') || b.match_no - a.match_no);
  const upcoming = sorted.filter((m) => m.status === 'scheduled' || m.status === 'postponed');
  const finished = sorted.filter((m) => m.finalized).length;
  const goals = snap.events.filter((e) => e.type === 'goal' || e.type === 'own_goal').length;
  const revealed = awardsRevealed(snap);
  const kickoff = snap.tournament.starts_at;
  const started = sorted.some((m) => m.status !== 'scheduled');

  return (
    <>
      <header className="ws-hero" style={started ? { minHeight: 'auto', paddingBottom: '1.2rem' } : undefined}>
        <img className="hbg" src="/brand/hero-bg.jpg" alt="" />
        <div className="bar b1" /><div className="bar b2" />
        <img className="tlogo" src="/brand/trivanta-logo.png" alt="TrIvanta" />
        <p className="pres">Presents</p>
        <h1 style={{ margin: 0, lineHeight: 0 }}><img className="wlogo" src="/brand/wordmark.webp" alt="Winter Showdown 2026" /></h1>
        <p className="ready">
          {revealed ? <>The <b>champions</b> are crowned</> : live.length ? <><b>● Live</b> now at Offside, Mirpur</> : started ? <>The showdown is <b>on</b> · Offside, Mirpur</> : <>13 November · <b>Offside</b>, Mirpur</>}
        </p>
        {!started && kickoff && <Countdown iso={kickoff} />}
        <div className="cta">
          <Link href="/fixtures" className="btn-skew btn-lime"><span>Fixtures &amp; scores</span></Link>
          <Link href="/standings" className="btn-skew btn-cyan-outline"><span>Standings</span></Link>
        </div>
        <div className="hs">
          <div><b>{snap.teams.filter((t) => t.status !== 'withdrawn').length}</b><span>Teams</span></div>
          <div><b>{finished}/{sorted.length}</b><span>Played</span></div>
          <div><b>{goals}</b><span>Goals</span></div>
          <div><b>10K</b><span>Prizepool</span></div>
        </div>
      </header>

      {revealed && <FinaleSection snap={snap} />}

      <SectionHead kicker="❄️ MATCH CENTRE" cyan="LIVE &" lime="MATCHES" />
      <div className="slots-3" style={{ marginBottom: '2rem' }}>
        <Slot title={live.length > 1 ? `🔴 Live now (${live.length})` : '🔴 Live now'} m={live[0]} empty="No match live right now" />
        <Slot title="✅ Last played" m={played[0]} empty="No results yet" />
        <Slot title="⚡ Up next" m={upcoming[0]} empty={revealed ? 'Tournament complete' : 'No more matches'} />
      </div>
      {live.length > 1 && <div className="grid-2" style={{ marginBottom: '2rem' }}>{live.slice(1).map((m) => <MatchCard key={m.id} m={m} snap={snap} compact />)}</div>}

      <SectionHead kicker="❄️ 13 NOV 2026 · ALL TIMES PM" cyan="FIXTURES &" lime="RESULTS">
        <Link href="/fixtures" className="btn-skew btn-cyan-outline"><span>All fixtures →</span></Link>
      </SectionHead>
      <div className="grid-2" style={{ marginBottom: '2rem' }}>
        {[...played.slice(0, 2).reverse(), ...upcoming.slice(0, 4)].map((m) => <MatchCard key={m.id} m={m} snap={snap} compact />)}
      </div>

      <SectionHead kicker="❄️ TOP 2 OF EACH GROUP REACH THE SEMIS" cyan="GROUP" lime="STANDINGS">
        <Link href="/standings" className="btn-skew btn-cyan-outline"><span>Full tables →</span></Link>
      </SectionHead>
      <div className="grid-2" style={{ marginBottom: '1rem' }}>{groups.map((g) => <MiniStandings key={g.groupId} g={g} />)}</div>
    </>
  );
}
