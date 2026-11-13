export type Position = 'goalkeeper' | 'defender' | 'midfielder' | 'striker';
export type MatchStatus = 'scheduled' | 'live' | 'full_time' | 'postponed' | 'cancelled';
export type Stage = 'group' | 'semifinal' | 'final' | 'third_place';
export type ResultType = 'normal' | 'walkover_home' | 'walkover_away' | 'abandoned';
export type EventType = 'goal' | 'own_goal' | 'yellow' | 'second_yellow' | 'red' | 'red_violent';

export interface Tournament {
  id: string; slug: string; name: string; starts_at: string | null; venue: string | null; is_test: boolean;
  groups_confirmed_at: string | null; bracket_needs_review: boolean;
}
export interface Settings {
  tournament_id: string; site_mode: 'pre' | 'live' | 'completed'; registration_open: boolean;
  banner_en: string | null; banner_bn: string | null; tiebreak_order: string[];
  knockout_tie_resolution: string; second_yellow_points: number; ratings_published_default: boolean;
  third_place_enabled: boolean; rating_min_matches: number; walkover_goals: number; golden_boot_tiebreak: string;
  stage_rules: Record<string, { normal: number; max_added: number }>;
  max_eligible_age: number;
}
export interface Group { id: string; tournament_id: string; code: string; name: string }
export interface Team {
  id: string; tournament_id: string; group_id: string | null; name: string; display_name: string; short_code: string;
  color: string; logo_url: string | null; captain_player_id: string | null; lot_rank: number | null;
  status: 'pending' | 'confirmed' | 'withdrawn';
  replaces_team_id?: string | null; results_policy?: 'keep' | 'expunge' | 'transfer'; withdrawn_at?: string | null;
}
export interface Player {
  id: string; team_id: string; slot: number | null; name: string; position: Position; jersey: number | null; active: boolean;
}
export interface Match {
  id: string; tournament_id: string; code: string; match_no: number; stage: Stage; group_id: string | null;
  home_team_id: string | null; away_team_id: string | null; home_placeholder: string | null; away_placeholder: string | null;
  scheduled_at: string | null; ends_at: string | null; venue: string | null; status: MatchStatus; finalized: boolean;
  finalized_at: string | null; started_at: string | null; ended_at: string | null; added_minutes: number;
  result_type: ResultType; score_mode: 'events' | 'manual'; manual_home: number | null; manual_away: number | null;
  pen_home: number | null; pen_away: number | null; decided_winner_id: string | null; decision_reason: string | null;
  note: string | null; var_home: number; var_away: number; mvp_player_id: string | null; ratings_published: boolean;
  imported_from: string | null; voided_from?: { status: string; finalized: boolean } | null; version: number; updated_at: string; updated_by: string | null;
  // merged from match_scores view
  home_score: number; away_score: number; events_home: number; events_away: number; details_incomplete: boolean;
}
export interface MatchEvent {
  id: string; match_id: string; type: EventType; team_id: string; player_id: string; assist_player_id: string | null;
  minute: number | null; note: string | null; created_at: string; deleted_at?: string | null;
}
export interface Rating { match_id: string; player_id: string; rating: number }
export interface Lineup { match_id: string; player_id: string; team_id: string }
export interface Award {
  tournament_id: string; key: 'winter_crown' | 'iron_wall' | 'golden_gloves' | 'golden_boot';
  player_id: string | null; team_id: string | null; label: string | null; published: boolean;
}

export interface Snapshot {
  tournament: Tournament;
  settings: Settings;
  groups: Group[];
  teams: Team[];
  players: Player[];
  matches: Match[];
  events: MatchEvent[];
  ratings: Rating[];
  lineups: Lineup[];
  awards: Award[];
}
