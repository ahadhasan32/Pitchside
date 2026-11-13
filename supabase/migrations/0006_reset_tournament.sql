-- Reset a whole tournament back to "ready to start": every match → Scheduled 0–0 (events/ratings soft-deleted,
-- snapshots kept per match), knockout slots emptied, standings confirmation cleared, awards unpublished.
-- Kept: tournament, settings, groups, teams, players, private data, payments, fixtures/schedule, lot ranks.
create or replace function public.admin_reset_tournament(p_tournament uuid, p_confirm text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform public._require('owner');
  n := public.admin_reset_all(p_tournament, p_confirm);
  update public.awards set published = false, published_at = null where tournament_id = p_tournament and published;
  update public.settings set site_mode = 'live' where tournament_id = p_tournament and site_mode = 'completed';
  return n;
end $$;
revoke all on function public.admin_reset_tournament(uuid, text) from public, anon;
grant execute on function public.admin_reset_tournament(uuid, text) to authenticated;
