import type { SupabaseClient } from '@supabase/supabase-js';
import type { Match, Snapshot } from './types';

export const TOURNAMENT_SLUG = process.env.NEXT_PUBLIC_TOURNAMENT_SLUG || 'ws2026';

function must<T>(r: { data: T | null; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data as T;
}

/** Loads everything the public site (or the admin, with its session) needs. Small dataset: one round of parallel queries. */
export async function loadSnapshot(sb: SupabaseClient, slug = TOURNAMENT_SLUG): Promise<Snapshot> {
  const tournament = must(await sb.from("tournaments").select("*").eq("slug", slug).single(), "tournament") as unknown as Snapshot["tournament"];
  const tid = tournament.id;
  const [settings, groups, teams, matches, scores, awards] = await Promise.all([
    sb.from('settings').select('*').eq('tournament_id', tid).single(),
    sb.from('groups').select('*').eq('tournament_id', tid).order('code'),
    sb.from('teams').select('*').eq('tournament_id', tid).order('display_name'),
    sb.from('matches').select('*').eq('tournament_id', tid).order('match_no'),
    sb.from('match_scores').select('*'),
    sb.from('awards').select('*').eq('tournament_id', tid),
  ]);
  const teamIds = (must(teams, 'teams') as { id: string }[]).map((t) => t.id);
  const matchIds = (must(matches, 'matches') as { id: string }[]).map((m) => m.id);
  const [players, events, ratings, lineups] = await Promise.all([
    sb.from('players').select('*').in('team_id', teamIds).order('jersey', { nullsFirst: false }),
    sb.from('match_events').select('*').in('match_id', matchIds).is('deleted_at', null).order('minute', { nullsFirst: false }).order('created_at'),
    sb.from('player_match_ratings').select('*').in('match_id', matchIds),
    sb.from('match_lineups').select('*').in('match_id', matchIds),
  ]);
  const scoreMap = new Map((must(scores, 'scores') as { match_id: string }[]).map((s) => [s.match_id, s]));
  const merged = (must(matches, 'matches') as Match[]).map((m) => {
    const s = scoreMap.get(m.id) as Partial<Match> | undefined;
    return { ...m, home_score: s?.home_score ?? 0, away_score: s?.away_score ?? 0, events_home: s?.events_home ?? 0, events_away: s?.events_away ?? 0, details_incomplete: !!s?.details_incomplete };
  });
  return {
    tournament,
    settings: must(settings, 'settings') as Snapshot['settings'],
    groups: must(groups, 'groups') as Snapshot['groups'],
    teams: must(teams, 'teams') as Snapshot['teams'],
    players: must(players, 'players') as Snapshot['players'],
    matches: merged,
    events: must(events, 'events') as Snapshot['events'],
    ratings: (must(ratings, 'ratings') as Snapshot['ratings']).map((r) => ({ ...r, rating: Number(r.rating) })),
    lineups: must(lineups, 'lineups') as Snapshot['lineups'],
    awards: must(awards, 'awards') as Snapshot['awards'],
  };
}
