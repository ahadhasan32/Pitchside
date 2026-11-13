'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Match, MatchEvent, Player, Snapshot, Team } from '@/lib/types';
import { displayStatus, showsScore, stageLabel } from '@/lib/tournament';

export const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Dhaka' }).replace(/\s?[AP]M/, '') : '—';
export const fmtTimeAmPm = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Dhaka' }) : '—';

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase();
}

export function TeamCrest({ team, size = 32, label, fallbackColor = '#00E5FF' }: { team?: Team | null; size?: number; label?: string; fallbackColor?: string }) {
  const [broken, setBroken] = useState(false);
  const txt = team ? team.short_code : label ?? '?';
  return (
    <span className="team-crest-mini" style={{ width: size, height: size, fontSize: Math.max(10, size * 0.3), background: team?.color ?? fallbackColor }} title={team?.display_name}>
      {team?.logo_url && !broken ? <img src={team.logo_url} alt={team.display_name} loading="lazy" onError={() => setBroken(true)} /> : txt}
    </span>
  );
}

export function BigLogo({ team, size = 84, label }: { team?: Team | null; size?: number; label?: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="team-logo" style={{ width: size, height: size, background: team?.color ?? 'rgba(0,229,255,.25)', fontSize: size * 0.28 }}>
      {team?.logo_url && !broken ? <img src={team.logo_url} alt={team.display_name} onError={() => setBroken(true)} /> : team ? team.short_code : label ?? '?'}
    </span>
  );
}

/** Number that briefly pulses when it changes (subtle score-update animation). */
export function BumpNum({ value }: { value: number }) {
  const prev = useRef(value);
  const [k, setK] = useState(0);
  useEffect(() => {
    if (prev.current !== value) { prev.current = value; setK((x) => x + 1); }
  }, [value]);
  return <span key={k} className={k ? 'score-bump' : undefined}>{value}</span>;
}

export function useLookups(snap: Snapshot) {
  const team = (id: string | null | undefined) => (id ? snap.teams.find((t) => t.id === id) : undefined);
  const player = (id: string | null | undefined) => (id ? snap.players.find((p) => p.id === id) : undefined);
  const group = (id: string | null | undefined) => (id ? snap.groups.find((g) => g.id === id) : undefined);
  return { team, player, group };
}

export function placeholderName(ph: string | null) {
  if (!ph) return 'TBD';
  const map: Record<string, string> = {
    A1: 'Group A Winner (A1)', A2: 'Group A Runner-up (A2)', B1: 'Group B Winner (B1)', B2: 'Group B Runner-up (B2)',
    'W(SF1)': 'SF1 Winner', 'W(SF2)': 'SF2 Winner', 'L(SF1)': 'SF1 Loser', 'L(SF2)': 'SF2 Loser',
  };
  return map[ph] ?? ph;
}

export function goalLine(e: MatchEvent, player?: Player, assist?: Player) {
  const min = e.minute != null ? ` ${e.minute}'` : '';
  if (e.type === 'own_goal') return `⚽ ${player?.name ?? '?'}${min} (OG)`;
  return `⚽ ${player?.name ?? '?'}${min}${assist ? ` (A: ${assist.name})` : ''}`;
}
export const cardIcon = (t: MatchEvent['type']) => (t === 'yellow' ? '🟨' : t === 'second_yellow' ? '🟨🟥' : '🟥');

export function MatchCard({ m, snap, compact = false }: { m: Match; snap: Snapshot; compact?: boolean }) {
  const { team, player, group } = useLookups(snap);
  const status = displayStatus(m);
  const home = team(m.home_team_id), away = team(m.away_team_id);
  const homeName = home?.display_name ?? placeholderName(m.home_placeholder);
  const awayName = away?.display_name ?? placeholderName(m.away_placeholder);
  const g = group(m.group_id);
  const badgeClass = m.stage === 'group' ? (g?.code === 'A' ? 'badge-group-a' : 'badge-group-b') : 'badge-ko';
  const statusClass = status === 'LIVE' ? 'status-live' : status === 'FT' || status === 'FULL TIME' ? 'status-finished' : 'status-upcoming';
  const cardState = status === 'LIVE' ? 'is-live' : status === 'FT' || status === 'FULL TIME' ? 'is-finished' : '';
  const rules = snap.settings.stage_rules[m.stage];
  const scored = showsScore(m);
  const evs = snap.events.filter((e) => e.match_id === m.id);
  const goals = evs.filter((e) => e.type === 'goal' || e.type === 'own_goal');
  const cards = evs.filter((e) => e.type !== 'goal' && e.type !== 'own_goal');
  const homeGoals = goals.filter((e) => (e.type === 'goal' ? e.team_id === m.home_team_id : e.team_id === m.away_team_id));
  const awayGoals = goals.filter((e) => (e.type === 'goal' ? e.team_id === m.away_team_id : e.team_id === m.home_team_id));
  const hasPens = m.pen_home != null && m.pen_away != null && m.stage !== 'group';
  const mvp = player(m.mvp_player_id);

  return (
    <Link href={`/matches/${m.id}`} className="match-card-link">
      <article className={`match-card ${cardState}`}>
        <div className="match-top-bar">
          <div className="match-badges">
            <span style={{ color: 'var(--text-muted)' }}>#{String(m.match_no).padStart(2, '0')}</span>
            <span className={`badge-skew ${badgeClass}`}>{stageLabel(m, g?.code)}</span>
            <span style={{ color: 'var(--cyan)' }}>🕒 {fmtTime(m.scheduled_at)}–{fmtTime(m.ends_at)}</span>
            {rules && <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>({rules.normal}m{m.added_minutes ? ` +${m.added_minutes}m` : ''})</span>}
          </div>
          <span className={`status-pill ${statusClass}`}>{status === 'LIVE' ? '● LIVE' : status}</span>
        </div>
        <div className="match-versus-row">
          <div className="match-team home">
            <TeamCrest team={home} label={m.home_placeholder ?? '?'} />
            <span className="match-team-name" title={homeName}>{homeName}</span>
          </div>
          <div className={`score-pill-box ${scored ? '' : 'upcoming-vs'}`}>
            {scored ? <><BumpNum value={m.home_score} /> : <BumpNum value={m.away_score} /></> : 'VS'}
            {hasPens && <span className="pen-subtext">({m.pen_home}–{m.pen_away} pens)</span>}
            {m.result_type === 'walkover_home' && <span className="pen-subtext" style={{ color: 'var(--warning)' }}>WALKOVER ({home?.short_code})</span>}
            {m.result_type === 'walkover_away' && <span className="pen-subtext" style={{ color: 'var(--warning)' }}>WALKOVER ({away?.short_code})</span>}
            {m.result_type === 'abandoned' && <span className="pen-subtext" style={{ color: 'var(--danger)' }}>ABANDONED</span>}
          </div>
          <div className="match-team away">
            <TeamCrest team={away} label={m.away_placeholder ?? '?'} fallbackColor="#CCFF00" />
            <span className="match-team-name" title={awayName}>{awayName}</span>
          </div>
        </div>
        {!compact && (goals.length > 0 || cards.length > 0 || mvp || m.var_home > 0 || m.var_away > 0) && (
          <div className="match-events-summary">
            {goals.length > 0 && (
              <div className="event-line">
                {[...homeGoals.map((e) => `${home?.short_code}: ${goalLine(e, player(e.player_id))}`), ...awayGoals.map((e) => `${away?.short_code}: ${goalLine(e, player(e.player_id))}`)].join(' · ')}
              </div>
            )}
            {cards.length > 0 && <div className="event-line">{cards.map((c) => `${cardIcon(c.type)} ${player(c.player_id)?.name ?? '?'}${c.minute != null ? ` ${c.minute}'` : ''}${c.type === 'red_violent' ? ' (EXPELLED)' : ''}`).join(' · ')}</div>}
            {(m.var_home > 0 || m.var_away > 0) && <div className="event-line" style={{ color: 'var(--cyan)' }}>📺 VAR appeals used: {home?.short_code} {m.var_home}/2 · {away?.short_code} {m.var_away}/2</div>}
            {mvp && <div className="event-line" style={{ color: 'var(--lime)' }}>👑 MVP: {mvp.name}</div>}
          </div>
        )}
        <div className="match-admin-actions no-print">
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{rules ? `Rulebook §2: ${rules.normal}m + up to ${rules.max_added}m added` : ''}{m.details_incomplete ? ' · details pending' : ''}</span>
          <span className="btn-skew btn-cyan-outline" style={{ padding: '0.26rem 0.65rem', fontSize: '0.68rem' }}><span>MATCH DETAILS →</span></span>
        </div>
      </article>
    </Link>
  );
}

export function SectionHead({ kicker, cyan, lime, children }: { kicker: string; cyan: string; lime: string; children?: React.ReactNode }) {
  return (
    <div className="section-head">
      <div className="section-title-wrap">
        <div className="section-kicker">{kicker}</div>
        <h2 className="section-title"><span className="word-cyan">{cyan}</span> <span className="word-lime">{lime}</span></h2>
        <div className="section-underline" />
      </div>
      {children}
    </div>
  );
}
