'use client';
import Link from 'next/link';
import { useSnap } from '@/components/public/LiveProvider';
import { BigLogo, BumpNum, cardIcon, fmtTimeAmPm, placeholderName, useLookups } from '@/components/public/bits';
import { computeSuspensions, displayStatus, matchWinnerId, showsScore, stageLabel } from '@/lib/tournament';
import type { MatchEvent } from '@/lib/types';

const POS_LABEL: Record<string, string> = { goalkeeper: 'GK', defender: 'DEF', midfielder: 'MID', striker: 'FWD' };

export default function MatchView({ id }: { id: string }) {
  const snap = useSnap();
  const { team, player, group } = useLookups(snap);
  const m = snap.matches.find((x) => x.id === id);
  if (!m) return <div className="ws-card"><p>Match not found. <Link href="/fixtures" style={{ color: 'var(--cyan)' }}>All fixtures →</Link></p></div>;
  const home = team(m.home_team_id), away = team(m.away_team_id);
  const status = displayStatus(m);
  const evs = snap.events.filter((e) => e.match_id === m.id).sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999) || a.created_at.localeCompare(b.created_at));
  const forHome = (e: MatchEvent) => (e.type === 'own_goal' ? e.team_id === m.away_team_id : e.team_id === m.home_team_id);
  const goals = evs.filter((e) => e.type === 'goal' || e.type === 'own_goal');
  const susp = computeSuspensions(snap);
  const ratings = m.ratings_published ? snap.ratings.filter((r) => r.match_id === m.id) : [];
  const pens = m.stage !== 'group' && m.pen_home != null && m.pen_away != null;
  const winner = m.finalized && m.stage !== 'group' ? team(matchWinnerId(m)) : undefined;
  const statusClass = status === 'LIVE' ? 'status-live' : status === 'FT' || status === 'FULL TIME' ? 'status-finished' : 'status-upcoming';

  const goalItem = (e: MatchEvent) => (
    <div key={e.id}>
      ⚽ <strong style={{ color: '#fff' }}>{player(e.player_id)?.name}</strong>{e.type === 'own_goal' ? ' (OG)' : ''}
      {e.minute != null && <span style={{ color: 'var(--cyan)' }}> {e.minute}&apos;</span>}
      {e.assist_player_id && <span className="tl-sub"> · assist {player(e.assist_player_id)?.name}</span>}
    </div>
  );

  const roster = (tid: string | null) => snap.players.filter((p) => p.team_id === tid && p.active).sort((a, b) => (a.jersey ?? 99) - (b.jersey ?? 99));

  return (
    <>
      <div style={{ marginBottom: '0.75rem' }}><Link href="/fixtures" style={{ color: 'var(--cyan)', fontFamily: 'var(--font-sport)', fontSize: '0.8rem' }}>← ALL FIXTURES</Link></div>
      <section className={`ws-card lime-bottom match-hero ${status === 'LIVE' ? 'is-live' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.85rem', alignItems: 'center' }}>
          <span className={`badge-skew ${m.stage === 'group' ? (group(m.group_id)?.code === 'A' ? 'badge-group-a' : 'badge-group-b') : 'badge-ko'}`}>{stageLabel(m, group(m.group_id)?.code)} — MATCH {String(m.match_no).padStart(2, '0')}</span>
          <span className={`status-pill ${statusClass}`}>{status === 'LIVE' ? '● LIVE' : status}</span>
        </div>
        <div className="match-hero-row">
          <div className="match-hero-team"><BigLogo team={home} label={m.home_placeholder ?? '?'} /><span className="name">{home?.display_name ?? placeholderName(m.home_placeholder)}</span></div>
          <div>
            {showsScore(m) ? (
              <div className="score-big"><BumpNum value={m.home_score} /><span style={{ color: 'var(--cyan)', margin: '0 0.15em' }}>—</span><BumpNum value={m.away_score} /></div>
            ) : <div className="score-big" style={{ color: 'var(--text-muted)', fontSize: '3rem' }}>VS</div>}
            {pens && <div style={{ fontFamily: 'var(--font-sport)', color: 'var(--lime)', fontWeight: 700 }}>({m.pen_home}–{m.pen_away} pens)</div>}
            {m.result_type.startsWith('walkover') && <div style={{ color: 'var(--warning)', fontFamily: 'var(--font-sport)', fontWeight: 700 }}>WALKOVER</div>}
            {m.result_type === 'abandoned' && <div style={{ color: 'var(--danger)', fontFamily: 'var(--font-sport)', fontWeight: 700 }}>ABANDONED</div>}
          </div>
          <div className="match-hero-team"><BigLogo team={away} label={m.away_placeholder ?? '?'} /><span className="name">{away?.display_name ?? placeholderName(m.away_placeholder)}</span></div>
        </div>
        <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-soft)' }}>
          🕒 {fmtTimeAmPm(m.scheduled_at)} · 📍 {m.venue ?? 'OFFSIDE – Home of Football'}
          {m.added_minutes > 0 && <> · +{m.added_minutes}′ added</>}
        </div>
        {winner && <div style={{ marginTop: '0.5rem', color: 'var(--lime)', fontFamily: 'var(--font-sport)', fontWeight: 800 }}>🏆 {winner.display_name} advance{m.decision_reason ? ` — ${m.decision_reason}` : ''}</div>}
        {m.result_type !== 'normal' && m.note && <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{m.note}</div>}
        {m.details_incomplete && <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Goal details for this match are still being added.</div>}
        {goals.length > 0 && (
          <div className="grid-2" style={{ marginTop: '1rem', textAlign: 'left' }}>
            <div className="goal-list">{goals.filter(forHome).map(goalItem)}</div>
            <div className="goal-list" style={{ textAlign: 'right' }}>{goals.filter((e) => !forHome(e)).map(goalItem)}</div>
          </div>
        )}
      </section>

      <div className="grid-2" style={{ marginTop: '1.25rem' }}>
        <div className="ws-card">
          <div className="rule-sec-title"><span>⏱️ MATCH TIMELINE</span></div>
          {evs.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{status === 'UPCOMING' ? 'Kick-off has not happened yet.' : 'No events recorded yet.'}</p> : (
            <div className="timeline">
              {evs.map((e) => {
                const isGoal = e.type === 'goal' || e.type === 'own_goal';
                const side = isGoal ? (forHome(e) ? 'home' : 'away') : e.team_id === m.home_team_id ? 'home' : 'away';
                const content = (
                  <div>
                    {isGoal ? '⚽' : cardIcon(e.type)} <strong>{player(e.player_id)?.name}</strong>
                    {e.type === 'own_goal' && ' (OG)'}{e.type === 'red_violent' && ' (expelled)'}
                    {e.assist_player_id && <div className="tl-sub">assist: {player(e.assist_player_id)?.name}</div>}
                  </div>
                );
                return (
                  <div className="tl-row" key={e.id}>
                    <div className="tl-home">{side === 'home' && content}</div>
                    <div className="tl-min">{e.minute != null ? `${e.minute}′` : '•'}</div>
                    <div className="tl-away">{side === 'away' && content}</div>
                  </div>
                );
              })}
            </div>
          )}
          {(m.var_home > 0 || m.var_away > 0) && <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--cyan)' }}>📺 VAR appeals used: {home?.short_code} {m.var_home}/2 · {away?.short_code} {m.var_away}/2</div>}
          {m.mvp_player_id && <div style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: 'var(--lime)' }}>👑 Match MVP: {player(m.mvp_player_id)?.name}</div>}
        </div>

        <div className="ws-card">
          <div className="rule-sec-title"><span>👥 SQUADS</span>{m.ratings_published && <span className="badge-skew badge-ko">RATINGS</span>}</div>
          <div className="grid-2" style={{ gap: '0.75rem' }}>
            {[m.home_team_id, m.away_team_id].map((tid, i) => (
              <div key={i}>
                <div style={{ fontFamily: 'var(--font-sport)', fontWeight: 800, color: 'var(--cyan)', marginBottom: '0.35rem' }}>{team(tid)?.display_name ?? 'TBD'}</div>
                {roster(tid).map((p) => {
                  const r = ratings.find((x) => x.player_id === p.id);
                  const s = susp.get(p.id);
                  return (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem', fontSize: '0.82rem', padding: '0.18rem 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                      <span><span style={{ color: 'var(--lime)', fontFamily: 'var(--font-display)' }}>{p.jersey ?? '–'}</span> {p.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{POS_LABEL[p.position]}</span>
                        {s?.kind === 'expelled' && <span className="mini-tag tag-exp"> EXPELLED</span>}
                        {s?.kind === 'suspended' && s.active && <span className="mini-tag tag-susp"> SUSPENDED</span>}
                      </span>
                      {r && <span style={{ color: 'var(--lime)', fontWeight: 800 }}>{r.rating.toFixed(1)}</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
