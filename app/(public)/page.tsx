'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSnap } from '@/components/public/LiveProvider';
import { MatchCard, SectionHead, goalLine, useLookups } from '@/components/public/bits';
import { MiniStandings } from '@/components/public/Standings';
import { champion, computeGroupTable, featuredMatches, stageLabel } from '@/lib/tournament';

function Countdown({ iso }: { iso: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const diff = now == null ? 0 : new Date(iso).getTime() - now;
  if (now != null && diff <= 0) return <div className="countdown-wrap"><div className="countdown-label">🔥 WINTER SHOWDOWN 2026 IS UNDERWAY AT OFFSIDE – HOME OF FOOTBALL!</div></div>;
  const pad = (n: number) => String(Math.max(0, n)).padStart(2, '0');
  const d = Math.floor(diff / 86400000), h = Math.floor((diff / 3600000) % 24), m = Math.floor((diff / 60000) % 60), s = Math.floor((diff / 1000) % 60);
  return (
    <div className="countdown-wrap">
      <div className="countdown-label">❄️ COUNTDOWN TO FIRST KICKOFF ({new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dhaka' })})</div>
      <div className="countdown-grid">
        {[[d, 'DAYS'], [h, 'HOURS'], [m, 'MINS'], [s, 'SECS']].map(([v, u]) => (
          <div className="cd-cell" key={u as string}><div className="cd-num">{now == null ? '--' : pad(v as number)}</div><div className="cd-unit">{u}</div></div>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const snap = useSnap();
  const { team, player, group } = useLookups(snap);
  const groups = useMemo(() => snap.groups.map((g) => computeGroupTable(snap, g.id)), [snap]);
  const { live, featured, kind } = featuredMatches(snap.matches);
  const [liveIdx, setLiveIdx] = useState(0);
  const spotlight = live.length ? live[Math.min(liveIdx, live.length - 1)] : featured;
  const champ = champion(snap);
  const finished = snap.matches.filter((m) => m.finalized).length;
  const goals = snap.events.filter((e) => e.type === 'goal' || e.type === 'own_goal').length;
  const mode = snap.settings.site_mode;
  const kickoff = snap.tournament.starts_at;
  const title = kind === 'live' ? '🔴 LIVE ON TURF NOW' : kind === 'recent' ? '✅ LATEST RESULT' : '⚡ UP NEXT ON TURF';

  const scorerLine = (mid: string) => {
    const evs = snap.events.filter((e) => e.match_id === mid && (e.type === 'goal' || e.type === 'own_goal'));
    const by = new Map<string, number>();
    for (const e of evs) { const n = (player(e.player_id)?.name ?? '?') + (e.type === 'own_goal' ? ' (OG)' : ''); by.set(n, (by.get(n) ?? 0) + 1); }
    return [...by.entries()].map(([n, c]) => `${n} ${'⚽'.repeat(c)}`).join(' · ');
  };

  return (
    <>
      <section className="hero-banner">
        <div className="hero-pitch-bg" />
        <div className="hero-eyebrow">❄️ FAIR PLAY • RESPECT THE REFEREE • PLAY TO WIN ❄️</div>
        <h1 className="hero-title">WINTER SHOWDOWN <span className="accent-year">2026</span></h1>
        <div style={{ fontFamily: 'var(--font-sport)', fontSize: '0.92rem', letterSpacing: '0.2em', color: 'var(--cyan)', textTransform: 'uppercase', fontWeight: 700 }}>
          TRIVANTA PRESENTS · ORGANISED BY <span style={{ color: 'var(--lime)' }}>TRIVANTA EVENTS</span>
        </div>
        <div className="hero-meta-row">
          <div className="hero-meta-pill"><span>📅 13 NOV 2026</span></div>
          <div className="hero-meta-pill"><span>📍 OFFSIDE – HOME OF FOOTBALL, MIRPUR</span></div>
          <div className="hero-meta-pill"><span>⚽ 6-A-SIDE (MAX 10 PLAYERS/TEAM)</span></div>
          <div className="hero-meta-pill"><span>⏱️ 10M GROUP · 15M SF · 20M FINAL</span></div>
        </div>
        {mode !== 'completed' && kickoff && <Countdown iso={kickoff} />}
        {(mode === 'completed' || !kickoff) && (
          <div className="countdown-wrap"><div className="countdown-label">{mode === 'completed' ? '🏆 WINTER SHOWDOWN 2026 IS COMPLETE — FULL RESULTS BELOW' : '🔥 WINTER SHOWDOWN 2026 IS UNDERWAY AT OFFSIDE – HOME OF FOOTBALL!'}</div></div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <Link href="/fixtures" className="btn-skew btn-lime"><span>⚽ MATCH SCHEDULE & SCORES</span></Link>
          <Link href="/rules" className="btn-skew btn-cyan-outline"><span>📜 OFFICIAL RULEBOOK</span></Link>
        </div>
        <div className="hero-stat-strip">
          <div className="hero-stat-box"><div className="hero-stat-box-inner"><div className="hero-stat-val">{snap.teams.length} TEAMS</div><div className="hero-stat-lbl">2 GROUPS OF 4</div></div></div>
          <div className="hero-stat-box"><div className="hero-stat-box-inner"><div className="hero-stat-val">৳10,000</div><div className="hero-stat-lbl">PRIZE POOL + TROPHIES</div></div></div>
          <div className="hero-stat-box"><div className="hero-stat-box-inner"><div className="hero-stat-val">{finished} / {snap.matches.filter((m) => m.status !== 'cancelled').length}</div><div className="hero-stat-lbl">MATCHES FINISHED</div></div></div>
          <div className="hero-stat-box"><div className="hero-stat-box-inner"><div className="hero-stat-val">{goals}</div><div className="hero-stat-lbl">GOALS SCORED</div></div></div>
        </div>
      </section>

      {champ && (
        <section className="champion-banner">
          <div style={{ fontFamily: 'var(--font-sport)', fontSize: '0.85rem', letterSpacing: '0.22em', color: 'var(--gold)', textTransform: 'uppercase', fontWeight: 800 }}>🏆 WINTER SHOWDOWN CHAMPIONS 🏆</div>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '0.6rem 0' }}>
            {champ.winner.logo_url && <img src={champ.winner.logo_url} alt="" style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--gold)' }} />}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 5vw, 3.2rem)', color: 'var(--lime)', margin: '0.35rem 0' }}>{champ.winner.display_name}</div>
          <div style={{ fontSize: '0.95rem', color: '#fff' }}>
            Final: {team(champ.final.home_team_id)?.display_name} {champ.final.home_score}–{champ.final.away_score} {team(champ.final.away_team_id)?.display_name}
            {champ.final.pen_home != null && champ.final.pen_away != null && ` (${champ.final.pen_home}–${champ.final.pen_away} pens)`}
          </div>
          {champ.runnerUp && <div style={{ fontSize: '0.84rem', color: 'var(--cyan)', marginTop: '0.3rem' }}>🥈 Runners-up: <strong>{champ.runnerUp.display_name}</strong></div>}
        </section>
      )}

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="ws-card lime-bottom">
          <SectionHead kicker="❄️ MATCH CENTER SPOTLIGHT" cyan={kind === 'live' ? 'LIVE' : kind === 'recent' ? 'LATEST' : 'NEXT'} lime="MATCH">
            <span className="badge-skew badge-ko">{title}</span>
          </SectionHead>
          {live.length > 1 && (
            <div className="filter-bar" style={{ marginBottom: '0.6rem' }}>
              {live.map((m, i) => (
                <button key={m.id} type="button" className={`filter-btn ${i === liveIdx ? 'active' : ''}`} onClick={() => setLiveIdx(i)}>
                  <span>{team(m.home_team_id)?.short_code} v {team(m.away_team_id)?.short_code}</span>
                </button>
              ))}
            </div>
          )}
          {spotlight ? (
            <>
              <div style={{ fontFamily: 'var(--font-sport)', fontSize: '0.78rem', color: 'var(--cyan)', letterSpacing: '0.12em', marginBottom: '0.4rem' }}>
                {stageLabel(spotlight, group(spotlight.group_id)?.code)} — MATCH {String(spotlight.match_no).padStart(2, '0')}
              </div>
              <MatchCard m={spotlight} snap={snap} compact />
              {scorerLine(spotlight.id) && <div className="goal-list" style={{ marginTop: '0.5rem' }}>{scorerLine(spotlight.id)}</div>}
              <div style={{ marginTop: '0.75rem' }}><Link href={`/matches/${spotlight.id}`} className="btn-skew btn-lime"><span>VIEW MATCH DETAILS →</span></Link></div>
            </>
          ) : <p style={{ color: 'var(--text-muted)' }}>No matches scheduled.</p>}
        </div>

        <div className="ws-card lime-bottom">
          <SectionHead kicker="❄️ OFFICIAL RULEBOOK HIGHLIGHTS" cyan="TOURNAMENT" lime="DETAILS">
            <Link href="/rules" className="btn-skew btn-cyan-outline" style={{ padding: '0.3rem 0.7rem', fontSize: '0.72rem' }}><span>FULL RULES →</span></Link>
          </SectionHead>
          <div className="grid-2" style={{ gap: '0.75rem', marginBottom: '0.85rem' }}>
            <div style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid var(--gold)', borderRadius: 10, padding: '0.75rem' }}>
              <div style={{ fontFamily: 'var(--font-sport)', fontSize: '0.72rem', fontWeight: 800, color: 'var(--gold)' }}>🥇 1ST • CHAMPIONS</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.45rem', color: '#fff' }}>৳6,000</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-soft)' }}>+ Champions Trophy</div>
            </div>
            <div style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid var(--cyan)', borderRadius: 10, padding: '0.75rem' }}>
              <div style={{ fontFamily: 'var(--font-sport)', fontSize: '0.72rem', fontWeight: 800, color: 'var(--cyan)' }}>🥈 2ND • RUNNERS-UP</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.45rem', color: '#fff' }}>৳4,000</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-soft)' }}>+ Runners-Up Trophy</div>
            </div>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-soft)', display: 'grid', gap: '0.3rem' }}>
            <div>❄️ <strong>Match Durations (§2):</strong> Group 10m (+2m max) · Semifinals 15m (+3m max) · Final 20m (+4m max).</div>
            <div>❄️ <strong>Key Playing Rules:</strong> Kick-ins (4s limit, 4 steps) · No offside · Back-passes allowed · 2 VAR appeals/team/match · Knockout draws → 4-kick penalty shootout + sudden death.</div>
          </div>
        </div>
      </div>

      <SectionHead kicker="❄️ LIVE GROUP RANKINGS" cyan="GROUP" lime="STANDINGS">
        <Link href="/standings" className="btn-skew btn-cyan-outline"><span>FULL TABLES & FAIR-PLAY →</span></Link>
      </SectionHead>
      <div className="grid-2" style={{ marginBottom: '1.75rem' }}>{groups.map((g) => <MiniStandings key={g.groupId} g={g} />)}</div>

      <SectionHead kicker="❄️ ALL 15 MATCHES · 13 NOV" cyan="RECENT &" lime="UPCOMING">
        <Link href="/fixtures" className="btn-skew btn-cyan-outline"><span>ALL FIXTURES →</span></Link>
      </SectionHead>
      <div className="grid-2" style={{ marginBottom: '1.75rem' }}>
        {[...snap.matches.filter((m) => m.status === 'full_time' || m.finalized).slice(-2), ...snap.matches.filter((m) => m.status === 'scheduled').slice(0, 2)].map((m) => (
          <MatchCard key={m.id} m={m} snap={snap} compact />
        ))}
      </div>

      <div className="ws-card reg-closed" style={{ marginBottom: '1.75rem' }}>
        <div className="section-kicker">❄️ REGISTRATION</div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--lime)', margin: '0.3rem 0' }}>
          {snap.settings.registration_open ? 'REGISTRATION IS OPEN' : 'REGISTRATION CLOSED — TOURNAMENT IN PROGRESS'}
        </h3>
        <p style={{ color: 'var(--text-soft)', fontSize: '0.9rem', marginBottom: '0.8rem' }}>
          {snap.settings.registration_open ? 'Contact TrIvanta Events to register your team for the next edition.' : 'All 8 squads are locked in. Follow every goal live.'}
        </p>
        <Link href="/fixtures" className="btn-skew btn-lime"><span>⚽ LIVE RESULTS</span></Link>
      </div>

      <SectionHead kicker="❄️ SPECIAL HONOURS" cyan="INDIVIDUAL" lime="AWARDS">
        <Link href="/awards" className="btn-skew btn-cyan-outline"><span>AWARDS →</span></Link>
      </SectionHead>
      <div className="grid-4" style={{ marginBottom: '1.75rem' }}>
        {[['award-winter-crown', 'THE WINTER CROWN', 'MVP'], ['award-iron-wall', 'THE IRON WALL', 'BEST DEFENDER'], ['award-golden-gloves', 'THE GOLDEN GLOVES', 'BEST GOALKEEPER'], ['award-golden-boot', 'THE GOLDEN BOOT', 'TOP SCORER']].map(([img, t, s]) => (
          <div key={img} className="ws-card chamfer" style={{ textAlign: 'center' }}>
            <img className="award-img" src={`/brand/${img}.webp`} alt={t} style={{ width: 96, height: 96, margin: '0 auto' }} />
            <div style={{ fontFamily: 'var(--font-display)', color: 'var(--lime)', marginTop: '0.4rem' }}>{t}</div>
            <div style={{ fontFamily: 'var(--font-sport)', fontSize: '0.72rem', color: 'var(--cyan)', letterSpacing: '0.12em' }}>{s}</div>
          </div>
        ))}
      </div>

      <SectionHead kicker="❄️ BE ON THE PITCH, BE ON TIME" cyan="VENUE &" lime="TIME" />
      <div className="ws-card venue-card" style={{ marginBottom: '1.75rem' }}>
        <img src="/brand/venue.jpg" alt="Offside turf, Mirpur" />
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <div><div className="form-label">VENUE</div><div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem' }}>OFFSIDE – Home of Football, Mirpur</div></div>
          <div><div className="form-label">DATE</div><div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem' }}>13 November 2026</div></div>
          <div><div className="form-label">TIME</div><div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem' }}>2:00 PM – 6:30 PM</div></div>
          <a className="btn-skew btn-cyan-outline" href="https://maps.app.goo.gl/JDh82UzfmgRHLYiz9" target="_blank" rel="noopener noreferrer" style={{ justifySelf: 'start' }}><span>📍 OPEN IN MAPS</span></a>
        </div>
      </div>

      <div className="ws-card" style={{ textAlign: 'center' }}>
        <div className="section-kicker" style={{ marginBottom: '0.5rem' }}>❄️ PRESENTED BY</div>
        <img src="/brand/trivanta-logo.png" alt="TrIvanta" style={{ height: 56, margin: '0 auto' }} />
        <img src="/brand/wordmark.webp" alt="Winter Showdown 2026" style={{ maxWidth: 320, width: '100%', margin: '0.75rem auto 0', display: 'block' }} />
        <div style={{ marginTop: '0.75rem' }}><Link href="/rules#terms" style={{ color: 'var(--cyan)', fontSize: '0.85rem' }}>Rules & Terms and Conditions (English · বাংলা) →</Link></div>
      </div>
    </>
  );
}
