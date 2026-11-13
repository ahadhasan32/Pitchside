-- Scores as int (not bigint) so every client gets plain numbers.
drop view if exists public.match_scores;
create or replace view public.match_scores with (security_invoker = true) as
select
  m.id as match_id,
  coalesce(e.home_goals, 0)::int as events_home,
  coalesce(e.away_goals, 0)::int as events_away,
  case
    when m.result_type = 'walkover_home' then s.walkover_goals
    when m.result_type = 'walkover_away' then 0
    when m.score_mode = 'manual' or m.result_type = 'abandoned' then coalesce(m.manual_home, coalesce(e.home_goals, 0))
    else coalesce(e.home_goals, 0)
  end::int as home_score,
  case
    when m.result_type = 'walkover_away' then s.walkover_goals
    when m.result_type = 'walkover_home' then 0
    when m.score_mode = 'manual' or m.result_type = 'abandoned' then coalesce(m.manual_away, coalesce(e.away_goals, 0))
    else coalesce(e.away_goals, 0)
  end::int as away_score,
  (m.score_mode = 'manual' and (coalesce(e.home_goals,0) <> coalesce(m.manual_home,0) or coalesce(e.away_goals,0) <> coalesce(m.manual_away,0))) as details_incomplete
from public.matches m
left join public.settings s on s.tournament_id = m.tournament_id
left join lateral (
  select
    count(*) filter (where (ev.type = 'goal' and ev.team_id = m.home_team_id) or (ev.type = 'own_goal' and ev.team_id = m.away_team_id)) as home_goals,
    count(*) filter (where (ev.type = 'goal' and ev.team_id = m.away_team_id) or (ev.type = 'own_goal' and ev.team_id = m.home_team_id)) as away_goals
  from public.match_events ev where ev.match_id = m.id
) e on true;
grant select on public.match_scores to anon, authenticated;
