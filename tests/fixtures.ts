import type { Match, MatchEvent, Snapshot, Team, Player } from '@/lib/types';

let n = 0;
export const uid = (p = 'id') => `${p}-${++n}`;
export function team(id: string, group = 'gA', lot: number | null = null): Team {
  return { id, tournament_id: 't', group_id: group, name: id, display_name: id, short_code: id.slice(0, 3).toUpperCase(), color: '#00E5FF', logo_url: null, captain_player_id: null, lot_rank: lot, status: 'confirmed' };
}
export function player(id: string, teamId: string, position: Player['position'] = 'striker'): Player {
  return { id, team_id: teamId, slot: null, name: id, position, jersey: null, active: true };
}
export function match(no: number, home: string | null, away: string | null, hs: number, as: number, over: Partial<Match> = {}): Match {
  return {
    id: over.id ?? `m${no}`, tournament_id: 't', code: `M${no}`, match_no: no, stage: 'group', group_id: 'gA',
    home_team_id: home, away_team_id: away, home_placeholder: null, away_placeholder: null, scheduled_at: null, ends_at: null, venue: null,
    status: 'full_time', finalized: true, finalized_at: null, started_at: null, ended_at: null, added_minutes: 0, result_type: 'normal',
    score_mode: 'events', manual_home: null, manual_away: null, pen_home: null, pen_away: null, decided_winner_id: null, decision_reason: null,
    note: null, var_home: 0, var_away: 0, mvp_player_id: null, ratings_published: false, imported_from: null, version: 1, updated_at: '', updated_by: null,
    home_score: hs, away_score: as, events_home: hs, events_away: as, details_incomplete: false, ...over,
  };
}
export function ev(matchId: string, type: MatchEvent['type'], teamId: string, playerId: string, assist: string | null = null, minute: number | null = null): MatchEvent {
  return { id: uid('e'), match_id: matchId, type, team_id: teamId, player_id: playerId, assist_player_id: assist, minute, note: null, created_at: new Date(2026, 0, 1, 0, 0, n).toISOString() };
}
export function snapshot(p: Partial<Snapshot>): Snapshot {
  return {
    tournament: { id: 't', slug: 'test', name: 'T', starts_at: null, venue: null, is_test: true, groups_confirmed_at: null, bracket_needs_review: false },
    settings: { tournament_id: 't', site_mode: 'live', registration_open: false, banner_en: null, banner_bn: null, tiebreak_order: ['gd', 'gf', 'h2h', 'fairplay', 'lot'], knockout_tie_resolution: 'penalties', second_yellow_points: 2, ratings_published_default: false, third_place_enabled: false, rating_min_matches: 2, walkover_goals: 3, golden_boot_tiebreak: 'x', stage_rules: { group: { normal: 10, max_added: 2 } } },
    groups: [{ id: 'gA', tournament_id: 't', code: 'A', name: 'Group A' }],
    teams: [], players: [], matches: [], events: [], ratings: [], lineups: [], awards: [], ...p,
  };
}
