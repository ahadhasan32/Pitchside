-- Soft deletes everywhere (nothing is ever physically deleted), team withdraw / replace with
-- cascading schedule changes, match creation, restoring cancelled matches.

-- ---------------------------------------------------------------------------
-- Soft-deleted events
-- ---------------------------------------------------------------------------
alter table public.match_events add column if not exists deleted_at timestamptz;
alter table public.match_events add column if not exists deleted_by uuid;

drop policy if exists public_read on public.match_events;
create policy public_read on public.match_events for select using (deleted_at is null or public.has_role('viewer'));

drop view if exists public.match_scores;
create view public.match_scores with (security_invoker = true) as
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
  from public.match_events ev where ev.match_id = m.id and ev.deleted_at is null
) e on true;
grant select on public.match_scores to anon, authenticated;

create or replace function public.admin_event_save(
  p_id uuid, p_match uuid, p_type text, p_team uuid, p_player uuid,
  p_assist uuid default null, p_minute int default null, p_note text default null)
returns public.match_events
language plpgsql security definer set search_path = public as $$
declare m public.matches; e public.match_events;
begin
  perform public._require('scorer');
  select * into m from public.matches where id = p_match;
  if m.id is null then raise exception 'NOT_FOUND'; end if;
  if m.finalized then raise exception 'FINALIZED: reopen the match before editing events'; end if;
  if m.status not in ('live','full_time') then raise exception 'NOT_STARTED: start the match before recording events'; end if;
  if exists (select 1 from public.match_events where id = p_id and match_id <> p_match) then raise exception 'BAD_ID'; end if;
  -- a soft-deleted event is never resurrected by a stale retry
  if exists (select 1 from public.match_events where id = p_id and deleted_at is not null) then raise exception 'DELETED: this event was removed — add it again'; end if;

  insert into public.match_events(id, match_id, type, team_id, player_id, assist_player_id, minute, note, created_by)
  values (p_id, p_match, p_type, p_team, p_player, case when p_type = 'goal' then p_assist end, p_minute, p_note, auth.uid())
  on conflict (id) do update set
    type = excluded.type, team_id = excluded.team_id, player_id = excluded.player_id,
    assist_player_id = excluded.assist_player_id, minute = excluded.minute, note = excluded.note
  returning * into e;
  perform public._reconcile_manual(p_match);
  return e;
end $$;

create or replace function public.admin_event_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m public.matches;
begin
  perform public._require('scorer');
  select mt.* into m from public.matches mt join public.match_events e on e.match_id = mt.id where e.id = p_id and e.deleted_at is null;
  if m.id is null then return; end if;  -- already removed: idempotent
  if m.finalized then raise exception 'FINALIZED: reopen the match before editing events'; end if;
  update public.match_events set deleted_at = now(), deleted_by = auth.uid() where id = p_id;
  perform public._reconcile_manual(m.id);
end $$;

-- ---------------------------------------------------------------------------
-- Soft-voided payments (owners can no longer hard-delete)
-- ---------------------------------------------------------------------------
alter table public.payments add column if not exists voided_at timestamptz;
alter table public.payments add column if not exists voided_by uuid;
drop policy if exists owner_write on public.payments;
create policy owner_insert on public.payments for insert with check (public.has_role('owner'));
create policy owner_update on public.payments for update using (public.has_role('owner')) with check (public.has_role('owner'));

-- No hard deletes of players or teams from the app (only status changes)
drop policy if exists owner_write on public.players;
create policy owner_insert on public.players for insert with check (public.has_role('owner'));
create policy owner_update on public.players for update using (public.has_role('owner')) with check (public.has_role('owner'));
drop policy if exists owner_write on public.teams;
create policy owner_insert on public.teams for insert with check (public.has_role('owner'));
create policy owner_update on public.teams for update using (public.has_role('owner')) with check (public.has_role('owner'));

-- ---------------------------------------------------------------------------
-- Team withdraw / replace
-- ---------------------------------------------------------------------------
alter table public.teams add column if not exists replaces_team_id uuid references public.teams(id);
alter table public.teams add column if not exists results_policy text not null default 'keep'
  check (results_policy in ('keep','expunge','transfer'));
alter table public.teams add column if not exists withdrawn_at timestamptz;

-- Withdraw a team. Future (not started) matches are cancelled; played results are kept or expunged.
create or replace function public.admin_team_withdraw(p_team uuid, p_policy text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform public._require('owner');
  if p_policy not in ('keep','expunge') then raise exception 'BAD_POLICY'; end if;
  update public.teams set status = 'withdrawn', results_policy = p_policy, withdrawn_at = now() where id = p_team;
  update public.matches set status = 'cancelled'
   where (home_team_id = p_team or away_team_id = p_team) and status in ('scheduled','postponed') and not finalized;
  get diagnostics n = row_count;
  return n;
end $$;

-- Replace a team: the new team takes over every match that has not started; the old team is withdrawn.
-- p_transfer = true: the old team's played results count for the new team (it inherits the slot).
create or replace function public.admin_team_replace(p_old uuid, p_name text, p_display text, p_short text, p_color text, p_transfer boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare o public.teams; nid uuid;
begin
  perform public._require('owner');
  select * into o from public.teams where id = p_old for update;
  if o.id is null then raise exception 'NOT_FOUND'; end if;
  if o.status = 'withdrawn' then raise exception 'ALREADY_WITHDRAWN: this team was already replaced or withdrawn'; end if;
  if exists (select 1 from public.matches where (home_team_id = p_old or away_team_id = p_old) and status = 'live') then
    raise exception 'LIVE: finish the live match of this team first';
  end if;
  insert into public.teams(tournament_id, group_id, name, display_name, short_code, color, status, replaces_team_id, lot_rank)
  values (o.tournament_id, o.group_id, p_name, coalesce(nullif(p_display,''), p_name), upper(p_short), coalesce(p_color, o.color), 'confirmed', o.id, o.lot_rank)
  returning id into nid;
  update public.teams set status = 'withdrawn', withdrawn_at = now(),
         results_policy = case when p_transfer then 'transfer' else 'expunge' end
   where id = p_old;
  update public.matches set home_team_id = nid where home_team_id = p_old and status in ('scheduled','postponed','cancelled') and not finalized and started_at is null;
  update public.matches set away_team_id = nid where away_team_id = p_old and status in ('scheduled','postponed','cancelled') and not finalized and started_at is null;
  -- matches cancelled only because of an earlier withdrawal come back
  update public.matches set status = 'scheduled'
   where (home_team_id = nid or away_team_id = nid) and status = 'cancelled' and started_at is null and not finalized;
  return nid;
end $$;

-- Owner can add a fixture
create or replace function public.admin_match_create(p_tournament uuid, p_stage text, p_group uuid, p_home uuid, p_away uuid, p_at timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare nid uuid; n int;
begin
  perform public._require('owner');
  select coalesce(max(match_no), 0) + 1 into n from public.matches where tournament_id = p_tournament;
  insert into public.matches(tournament_id, code, match_no, stage, group_id, home_team_id, away_team_id, scheduled_at, venue)
  values (p_tournament, 'M' || lpad(n::text, 2, '0') || '-' || substr(gen_random_uuid()::text, 1, 4), n, p_stage, p_group, p_home, p_away, p_at, 'OFFSIDE – Home of Football')
  returning id into nid;
  return nid;
end $$;

-- 'restore' brings a cancelled match back to scheduled
create or replace function public.admin_match_restore(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._require('owner');
  update public.matches set status = 'scheduled' where id = p_match and status = 'cancelled' and not finalized;
end $$;

revoke all on function public.admin_team_withdraw(uuid, text) from public, anon;
revoke all on function public.admin_team_replace(uuid, text, text, text, text, boolean) from public, anon;
revoke all on function public.admin_match_create(uuid, text, uuid, uuid, uuid, timestamptz) from public, anon;
revoke all on function public.admin_match_restore(uuid) from public, anon;
grant execute on function public.admin_team_withdraw(uuid, text) to authenticated;
grant execute on function public.admin_team_replace(uuid, text, text, text, text, boolean) to authenticated;
grant execute on function public.admin_match_create(uuid, text, uuid, uuid, uuid, timestamptz) to authenticated;
grant execute on function public.admin_match_restore(uuid) to authenticated;

-- Ratings: clearing a rating is a value change, kept in the audit log. Ratings are never removed
-- with their player: players are only deactivated.

-- Realtime does not deliver an UPDATE that makes a row invisible to anon (soft delete), so every
-- event write also bumps a public "ping" row that all viewers are subscribed to.
create table if not exists public.live_pings (match_id uuid primary key references public.matches(id) on delete cascade, at timestamptz not null default now());
alter table public.live_pings enable row level security;
drop policy if exists public_read on public.live_pings;
create policy public_read on public.live_pings for select using (true);
do $$ begin
  begin alter publication supabase_realtime add table public.live_pings; exception when duplicate_object then null; when undefined_object then null; end;
end $$;

create or replace function public.ping_match() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.live_pings(match_id, at) values (coalesce(new.match_id, old.match_id), now())
  on conflict (match_id) do update set at = excluded.at;
  return coalesce(new, old);
end $$;
drop trigger if exists match_events_ping on public.match_events;
create trigger match_events_ping after insert or update or delete on public.match_events for each row execute function public.ping_match();
drop trigger if exists ratings_ping on public.player_match_ratings;
create trigger ratings_ping after insert or update or delete on public.player_match_ratings for each row execute function public.ping_match();
