// Pure tournament logic (standings, tie-breakers, qualification, knockout, player stats).
// Ported from Pitchside (roundRobin / getGroupTable / buildKOFromGroups / advanceKO / checkDone)
// and design-v2 (rulebook §13 tie-breakers), with the known Pitchside bugs fixed:
//  - drawn knockouts never go to the home team (penalties / organizer decision required)
//  - head-to-head works for 3+ way ties (mini-table, re-applied to sub-ties)
//  - stats keyed by player/team id, never by name
import type { EventType, Match, MatchEvent, Player, Settings, Snapshot, Team } from './types';

export const CARD_TYPES: EventType[] = ['yellow', 'second_yellow', 'red', 'red_violent'];
export const SENDING_OFF: EventType[] = ['second_yellow', 'red', 'red_violent'];

export function cardPoints(type: EventType, settings: Pick<Settings, 'second_yellow_points'>): number {
  switch (type) {
    case 'yellow': return 1;
    case 'second_yellow': return settings.second_yellow_points;
    case 'red': return 3;
    case 'red_violent': return 5;
    default: return 0;
  }
}

/** Round-robin pairings (circle method) — Pitchside's roundRobin, kept for configurable formats. */
export function roundRobin<T>(items: T[]): [T, T][] {
  const list: (T | null)[] = [...items];
  if (list.length % 2) list.push(null);
  const n = list.length;
  const out: [T, T][] = [];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = list[i], b = list[n - 1 - i];
      if (a !== null && b !== null) out.push(r % 2 ? [b, a] : [a, b]);
    }
    list.splice(1, 0, list.pop()!);
  }
  return out;
}

export type DisplayStatus = 'UPCOMING' | 'LIVE' | 'FULL TIME' | 'FT' | 'POSTPONED' | 'CANCELLED';
export function displayStatus(m: Match): DisplayStatus {
  if (m.status === 'cancelled') return 'CANCELLED';
  if (m.finalized) return 'FT';
  if (m.status === 'live') return 'LIVE';
  if (m.status === 'full_time') return 'FULL TIME';
  if (m.status === 'postponed') return 'POSTPONED';
  return 'UPCOMING';
}
export const isStarted = (m: Match) => m.status === 'live' || m.status === 'full_time' || m.finalized;
export const showsScore = (m: Match) => isStarted(m) || m.result_type !== 'normal';

/** Knockout winner: score → penalties → walkover → organizer decision. Never defaults to home. */
export function matchWinnerId(m: Match): string | null {
  if (m.decided_winner_id) return m.decided_winner_id;
  if (m.result_type === 'walkover_home') return m.home_team_id;
  if (m.result_type === 'walkover_away') return m.away_team_id;
  if (m.home_score > m.away_score) return m.home_team_id;
  if (m.away_score > m.home_score) return m.away_team_id;
  if (m.pen_home != null && m.pen_away != null && m.pen_home !== m.pen_away) {
    return m.pen_home > m.pen_away ? m.home_team_id : m.away_team_id;
  }
  return null;
}
export function matchLoserId(m: Match): string | null {
  const w = matchWinnerId(m);
  if (!w) return null;
  return w === m.home_team_id ? m.away_team_id : m.home_team_id;
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------
export interface StandingRow {
  team: Team; P: number; W: number; D: number; L: number; GF: number; GA: number; GD: number; Pts: number;
  fairPlay: number; form: ('W' | 'D' | 'L')[]; rank: number;
  unresolvedTie: boolean; // organizer decision needed
  qualStatus: 'CONFIRMED' | 'TOP2' | 'ELIMINATED' | '';
}
export interface GroupTable { groupId: string; code: string; rows: StandingRow[]; finishedCount: number; totalCount: number; complete: boolean; unresolved: boolean }

type Res = { home: string; away: string; hs: number; as: number };

function tally(teamIds: string[], results: Res[]) {
  const t: Record<string, { P: number; W: number; D: number; L: number; GF: number; GA: number; Pts: number }> = {};
  for (const id of teamIds) t[id] = { P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, Pts: 0 };
  for (const r of results) {
    const h = t[r.home], a = t[r.away];
    if (!h || !a) continue;
    h.P++; a.P++; h.GF += r.hs; h.GA += r.as; a.GF += r.as; a.GA += r.hs;
    if (r.hs > r.as) { h.W++; a.L++; h.Pts += 3; }
    else if (r.hs < r.as) { a.W++; h.L++; a.Pts += 3; }
    else { h.D++; a.D++; h.Pts++; a.Pts++; }
  }
  return t;
}

/** Order teams level on points using the configured tie-break chain. Returns ordered buckets; buckets of size > 1 are unresolved. */
export function breakTies(
  ids: string[], results: Res[], overall: ReturnType<typeof tally>, fairPlay: Record<string, number>,
  lot: Record<string, number | null>, order: string[], idx = 0,
): string[][] {
  if (ids.length <= 1) return [ids];
  if (idx >= order.length) return [ids];
  const crit = order[idx];
  let key: (id: string) => number[];
  if (crit === 'gd') key = (id) => [overall[id].GF - overall[id].GA];
  else if (crit === 'gf') key = (id) => [overall[id].GF];
  else if (crit === 'fairplay') key = (id) => [-(fairPlay[id] ?? 0)];
  else if (crit === 'lot') key = (id) => [lot[id] == null ? -Infinity : -(lot[id] as number)];
  else if (crit === 'h2h') {
    const set = new Set(ids);
    const mini = tally(ids, results.filter((r) => set.has(r.home) && set.has(r.away)));
    key = (id) => [mini[id].Pts, mini[id].GF - mini[id].GA, mini[id].GF];
  } else return breakTies(ids, results, overall, fairPlay, lot, order, idx + 1);

  // lot: teams without a lot rank cannot be separated from each other
  const buckets = new Map<string, string[]>();
  for (const id of ids) {
    const k = JSON.stringify(key(id));
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(id);
  }
  const sorted = [...buckets.entries()].sort((a, b) => {
    const ka = JSON.parse(a[0]) as number[], kb = JSON.parse(b[0]) as number[];
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return (kb[i] ?? 0) - (ka[i] ?? 0);
    return 0;
  });
  const out: string[][] = [];
  for (const [, b] of sorted) {
    if (b.length === 1) out.push(b);
    else if (crit === 'h2h' && b.length < ids.length) out.push(...breakTies(b, results, overall, fairPlay, lot, order, idx)); // re-apply H2H to the sub-tie
    else out.push(...breakTies(b, results, overall, fairPlay, lot, order, idx + 1));
  }
  return out;
}

export function rankTeams(teams: Team[], results: Res[], fairPlay: Record<string, number>, order: string[]): { order: string[]; unresolved: Set<string>; table: ReturnType<typeof tally> } {
  const ids = teams.map((t) => t.id);
  const table = tally(ids, results);
  const lot: Record<string, number | null> = Object.fromEntries(teams.map((t) => [t.id, t.lot_rank]));
  const byPts = new Map<number, string[]>();
  for (const id of ids) {
    const p = table[id].Pts;
    if (!byPts.has(p)) byPts.set(p, []);
    byPts.get(p)!.push(id);
  }
  const final: string[] = [];
  const unresolved = new Set<string>();
  for (const pts of [...byPts.keys()].sort((a, b) => b - a)) {
    const level = byPts.get(pts)!;
    const buckets = breakTies(level, results, table, fairPlay, lot, order);
    for (const b of buckets) {
      if (b.length > 1) b.forEach((id) => unresolved.add(id));
      // stable, deterministic display order for unresolved ties (alphabetical) — flagged, never "decided"
      final.push(...[...b].sort((x, y) => (teams.find((t) => t.id === x)!.display_name).localeCompare(teams.find((t) => t.id === y)!.display_name)));
    }
  }
  return { order: final, unresolved, table };
}

const resOf = (m: Match): Res => ({ home: m.home_team_id!, away: m.away_team_id!, hs: m.home_score, as: m.away_score });

export function fairPlayByTeam(matches: Match[], events: MatchEvent[], settings: Settings): Record<string, number> {
  const ids = new Set(matches.map((m) => m.id));
  const fp: Record<string, number> = {};
  for (const e of events) {
    if (!ids.has(e.match_id) || !CARD_TYPES.includes(e.type)) continue;
    fp[e.team_id] = (fp[e.team_id] ?? 0) + cardPoints(e.type, settings);
  }
  return fp;
}

export function computeGroupTable(snap: Snapshot, groupId: string): GroupTable {
  const group = snap.groups.find((g) => g.id === groupId)!;
  const teams = snap.teams.filter((t) => t.group_id === groupId && t.status !== 'withdrawn');
  const groupMatches = snap.matches.filter((m) => m.stage === 'group' && m.group_id === groupId && m.status !== 'cancelled');
  const counted = groupMatches.filter((m) => m.finalized && m.home_team_id && m.away_team_id);
  const results = counted.map(resOf);
  const fp = fairPlayByTeam(counted, snap.events, snap.settings);
  const order = snap.settings.tiebreak_order?.length ? snap.settings.tiebreak_order : ['gd', 'gf', 'h2h', 'fairplay', 'lot'];
  const { order: ranked, unresolved, table } = rankTeams(teams, results, fp, order);

  const remaining = groupMatches.filter((m) => !m.finalized && m.home_team_id && m.away_team_id);
  const qual = qualification(teams.map((t) => t.id), table, remaining, ranked, unresolved);

  const rows: StandingRow[] = ranked.map((id, i) => {
    const s = table[id];
    const form = counted
      .filter((m) => m.home_team_id === id || m.away_team_id === id)
      .sort((a, b) => a.match_no - b.match_no)
      .map((m) => {
        const mine = m.home_team_id === id ? m.home_score : m.away_score;
        const theirs = m.home_team_id === id ? m.away_score : m.home_score;
        return (mine > theirs ? 'W' : mine < theirs ? 'L' : 'D') as 'W' | 'D' | 'L';
      })
      .slice(-3);
    return {
      team: teams.find((t) => t.id === id)!, ...s, GD: s.GF - s.GA, fairPlay: fp[id] ?? 0, form, rank: i + 1,
      unresolvedTie: unresolved.has(id), qualStatus: qual[id],
    };
  });
  return {
    groupId, code: group.code, rows, finishedCount: counted.length, totalCount: groupMatches.length,
    complete: remaining.length === 0 && groupMatches.every((m) => m.finalized), unresolved: unresolved.size > 0,
  };
}

/** Mathematical qualification (top 2) by brute-forcing W/D/L of the remaining fixtures. */
export function qualification(
  ids: string[], table: Record<string, { Pts: number }>, remaining: Match[], ranked: string[], unresolved: Set<string>,
): Record<string, StandingRow['qualStatus']> {
  const out: Record<string, StandingRow['qualStatus']> = {};
  if (remaining.length === 0) {
    // Final: positions are fixed unless an unresolved tie straddles 2nd/3rd
    const straddle = ranked.length > 2 && unresolved.has(ranked[1]) && unresolved.has(ranked[2]);
    ranked.forEach((id, i) => {
      if (straddle && unresolved.has(id)) out[id] = '';
      else out[id] = i < 2 ? 'CONFIRMED' : 'ELIMINATED';
    });
    return out;
  }
  const n = remaining.length;
  const total = Math.pow(3, n);
  const alwaysIn: Record<string, boolean> = {}, alwaysOut: Record<string, boolean> = {};
  ids.forEach((id) => { alwaysIn[id] = true; alwaysOut[id] = true; });
  for (let c = 0; c < total; c++) {
    const pts: Record<string, number> = {};
    ids.forEach((id) => (pts[id] = table[id]?.Pts ?? 0));
    let x = c;
    for (const m of remaining) {
      const o = x % 3; x = Math.floor(x / 3);
      if (o === 0) pts[m.home_team_id!] += 3;
      else if (o === 1) pts[m.away_team_id!] += 3;
      else { pts[m.home_team_id!] += 1; pts[m.away_team_id!] += 1; }
    }
    for (const id of ids) {
      const geq = ids.filter((o) => o !== id && pts[o] >= pts[id]).length; // worst case: lose every tie-break
      const gt = ids.filter((o) => o !== id && pts[o] > pts[id]).length;   // best case: win every tie-break
      if (geq > 1) alwaysIn[id] = false;
      if (gt < 2) alwaysOut[id] = false;
    }
  }
  ranked.forEach((id, i) => {
    const played = (table[id] as { P?: number })?.P ?? 0;
    out[id] = alwaysIn[id] ? 'CONFIRMED' : alwaysOut[id] ? 'ELIMINATED' : i < 2 && played > 0 ? 'TOP2' : '';
  });
  return out;
}

// ---------------------------------------------------------------------------
// Player stats, suspensions, leaderboards
// ---------------------------------------------------------------------------
export interface PlayerStats {
  player: Player; team: Team | undefined; played: number; goals: number; ownGoals: number; assists: number;
  yellow: number; red: number; ratingAvg: number | null; ratedMatches: number; mvp: number;
}

export function playedMatchIds(snap: Snapshot, player: Player): Set<string> {
  const out = new Set<string>();
  for (const m of snap.matches) {
    if (!isStarted(m) || m.status === 'cancelled') continue;
    if (m.home_team_id !== player.team_id && m.away_team_id !== player.team_id) continue;
    const teamLineup = snap.lineups.filter((l) => l.match_id === m.id && l.team_id === player.team_id);
    if (teamLineup.length ? teamLineup.some((l) => l.player_id === player.id) : player.active) out.add(m.id);
  }
  for (const e of snap.events) if (e.player_id === player.id || e.assist_player_id === player.id) out.add(e.match_id);
  for (const r of snap.ratings) if (r.player_id === player.id) out.add(r.match_id);
  return out;
}

export function computePlayerStats(snap: Snapshot): PlayerStats[] {
  const valid = new Set(snap.matches.filter((m) => m.status !== 'cancelled').map((m) => m.id));
  const published = new Set(snap.matches.filter((m) => m.ratings_published).map((m) => m.id));
  return snap.players.map((p) => {
    const evs = snap.events.filter((e) => valid.has(e.match_id));
    const ratings = snap.ratings.filter((r) => r.player_id === p.id && published.has(r.match_id));
    return {
      player: p,
      team: snap.teams.find((t) => t.id === p.team_id),
      played: playedMatchIds(snap, p).size,
      goals: evs.filter((e) => e.type === 'goal' && e.player_id === p.id).length,
      ownGoals: evs.filter((e) => e.type === 'own_goal' && e.player_id === p.id).length,
      assists: evs.filter((e) => e.type === 'goal' && e.assist_player_id === p.id).length,
      yellow: evs.filter((e) => e.type === 'yellow' && e.player_id === p.id).length,
      red: evs.filter((e) => SENDING_OFF.includes(e.type) && e.player_id === p.id).length,
      ratingAvg: ratings.length ? Math.round((ratings.reduce((s, r) => s + Number(r.rating), 0) / ratings.length) * 10) / 10 : null,
      ratedMatches: ratings.length,
      mvp: snap.matches.filter((m) => m.mvp_player_id === p.id && valid.has(m.id)).length,
    };
  });
}

export interface Suspension { playerId: string; kind: 'suspended' | 'expelled'; fromMatchId: string; servesMatchId: string | null; active: boolean }

/** Red = suspended for the team's next match; violent red = expelled for the tournament. */
export function computeSuspensions(snap: Snapshot): Map<string, Suspension> {
  const out = new Map<string, Suspension>();
  const byNo = [...snap.matches].sort((a, b) => a.match_no - b.match_no);
  const sendOffs = snap.events.filter((e) => SENDING_OFF.includes(e.type));
  for (const e of sendOffs) {
    const m = snap.matches.find((x) => x.id === e.match_id);
    if (!m || m.status === 'cancelled') continue;
    if (e.type === 'red_violent') {
      out.set(e.player_id, { playerId: e.player_id, kind: 'expelled', fromMatchId: m.id, servesMatchId: null, active: true });
      continue;
    }
    if (out.get(e.player_id)?.kind === 'expelled') continue;
    const next = byNo.find((x) => x.match_no > m.match_no && x.status !== 'cancelled' && (x.home_team_id === e.team_id || x.away_team_id === e.team_id));
    const active = !next || !(next.finalized || next.status === 'full_time');
    const prev = out.get(e.player_id);
    if (!prev || active) out.set(e.player_id, { playerId: e.player_id, kind: 'suspended', fromMatchId: m.id, servesMatchId: next?.id ?? null, active });
  }
  return out;
}

export function goldenBoot(stats: PlayerStats[]): (PlayerStats & { rank: number })[] {
  const list = stats.filter((s) => s.goals > 0).sort((a, b) => b.goals - a.goals || a.played - b.played || b.assists - a.assists);
  return withSharedRank(list, (s) => `${s.goals}|${s.played}|${s.assists}`);
}
export function topAssists(stats: PlayerStats[]): (PlayerStats & { rank: number })[] {
  const list = stats.filter((s) => s.assists > 0).sort((a, b) => b.assists - a.assists || b.goals - a.goals);
  return withSharedRank(list, (s) => `${s.assists}|${s.goals}`);
}
export function topRated(stats: PlayerStats[], minMatches: number): (PlayerStats & { rank: number })[] {
  const list = stats.filter((s) => s.ratingAvg != null && s.ratedMatches >= minMatches)
    .sort((a, b) => (b.ratingAvg! - a.ratingAvg!) || b.ratedMatches - a.ratedMatches);
  return withSharedRank(list, (s) => `${s.ratingAvg}|${s.ratedMatches}`);
}
function withSharedRank<T>(list: T[], key: (t: T) => string): (T & { rank: number })[] {
  let rank = 0, prev = '';
  return list.map((s, i) => {
    const k = key(s);
    if (k !== prev) { rank = i + 1; prev = k; }
    return { ...s, rank };
  });
}

export interface TeamDefence { team: Team; P: number; GA: number; cleanSheets: number; gk: Player | undefined }
export function defenceRanking(snap: Snapshot): TeamDefence[] {
  const done = snap.matches.filter((m) => m.finalized && m.home_team_id && m.away_team_id && m.result_type !== 'abandoned');
  return snap.teams.filter((t) => t.status !== 'withdrawn').map((t) => {
    const ms = done.filter((m) => m.home_team_id === t.id || m.away_team_id === t.id);
    const conceded = ms.map((m) => (m.home_team_id === t.id ? m.away_score : m.home_score));
    return {
      team: t, P: ms.length, GA: conceded.reduce((a, b) => a + b, 0), cleanSheets: conceded.filter((c) => c === 0).length,
      gk: snap.players.find((p) => p.team_id === t.id && p.active && p.position === 'goalkeeper'),
    };
  }).sort((a, b) => (b.P > 0 ? 1 : 0) - (a.P > 0 ? 1 : 0) || a.GA / Math.max(a.P, 1) - b.GA / Math.max(b.P, 1) || b.cleanSheets - a.cleanSheets);
}

export function teamOverall(snap: Snapshot, teamId: string) {
  const ms = snap.matches.filter((m) => m.finalized && (m.home_team_id === teamId || m.away_team_id === teamId)).sort((a, b) => a.match_no - b.match_no);
  let W = 0, D = 0, L = 0, GF = 0, GA = 0, CS = 0; const form: ('W' | 'D' | 'L')[] = [];
  for (const m of ms) {
    const mine = m.home_team_id === teamId ? m.home_score : m.away_score;
    const theirs = m.home_team_id === teamId ? m.away_score : m.home_score;
    GF += mine; GA += theirs; if (theirs === 0) CS++;
    const w = m.stage === 'group' ? (mine > theirs ? 'W' : mine < theirs ? 'L' : 'D') : (matchWinnerId(m) === teamId ? 'W' : 'L');
    if (w === 'W') W++; else if (w === 'L') L++; else D++;
    form.push(w);
  }
  return { P: ms.length, W, D, L, GF, GA, cleanSheets: CS, form: form.slice(-3) };
}

export function champion(snap: Snapshot): { winner: Team; runnerUp: Team | undefined; final: Match } | null {
  const final = snap.matches.find((m) => m.stage === 'final');
  if (!final || !final.finalized) return null;
  const w = matchWinnerId(final);
  if (!w) return null;
  return { winner: snap.teams.find((t) => t.id === w)!, runnerUp: snap.teams.find((t) => t.id === matchLoserId(final)), final };
}

/** Featured match: live → most recently finished → next upcoming. */
export function featuredMatches(matches: Match[]): { live: Match[]; featured: Match | null; kind: 'live' | 'recent' | 'next' | null } {
  const sorted = [...matches].sort((a, b) => a.match_no - b.match_no);
  const live = sorted.filter((m) => m.status === 'live');
  if (live.length) return { live, featured: live[0], kind: 'live' };
  const done = sorted.filter((m) => m.status === 'full_time' || m.finalized)
    .sort((a, b) => (b.ended_at ?? b.finalized_at ?? '').localeCompare(a.ended_at ?? a.finalized_at ?? '') || b.match_no - a.match_no);
  const next = sorted.find((m) => m.status === 'scheduled' || m.status === 'postponed');
  if (done.length) return { live, featured: done[0], kind: 'recent' };
  if (next) return { live, featured: next, kind: 'next' };
  return { live, featured: done[0] ?? null, kind: done.length ? 'recent' : null };
}

export function stageLabel(m: Match, groupCode?: string): string {
  if (m.stage === 'group') return `GROUP ${groupCode ?? ''}`.trim();
  if (m.stage === 'semifinal') return m.code === 'SF1' ? 'SEMIFINAL 1' : 'SEMIFINAL 2';
  if (m.stage === 'final') return 'GRAND FINAL';
  return 'THIRD PLACE';
}
