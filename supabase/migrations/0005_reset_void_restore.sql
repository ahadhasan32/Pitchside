-- Reversible match reset / void, "clear all test results", team restore, max eligible age setting.
-- Nothing is hard-deleted: events and ratings are soft-deleted with a reset batch id, and every reset keeps
-- a full snapshot (match fields + lineups) so it can be restored.

alter table public.settings add column if not exists max_eligible_age int not null default 24;

alter table public.match_events add column if not exists reset_batch uuid;
alter table public.player_match_ratings add column if not exists deleted_at timestamptz;
alter table public.player_match_ratings add column if not exists reset_batch uuid;
alter table public.matches add column if not exists voided_from jsonb;

drop policy if exists public_read on public.player_match_ratings;
create policy public_read on public.player_match_ratings for select using (
  public.has_role('viewer') or (deleted_at is null and exists (select 1 from public.matches m where m.id = match_id and m.ratings_published)));

create table if not exists public.match_resets (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches(id) on delete cascade,
  at          timestamptz not null default now(),
  actor       uuid,
  kind        text not null default 'reset' check (kind in ('reset','reset_all')),
  snapshot    jsonb not null,           -- match row + lineups before the reset
  discarded   boolean not null default false,
  restored_at timestamptz
);
alter table public.match_resets enable row level security;
drop policy if exists admin_read on public.match_resets;
create policy admin_read on public.match_resets for select using (public.has_role('viewer'));
drop trigger if exists match_resets_audit on public.match_resets;
create trigger match_resets_audit after insert or update on public.match_resets for each row execute function public.audit_row();

-- Ratings: setting a value (re)activates the row; clearing is a soft delete.
create or replace function public.admin_rating_set(p_match uuid, p_player uuid, p_rating numeric) returns void
language plpgsql security definer set search_path = public as $$
declare m public.matches;
begin
  perform public._require('scorer');
  select * into m from public.matches where id = p_match;
  if not exists (select 1 from public.players p where p.id = p_player and p.team_id in (m.home_team_id, m.away_team_id)) then
    raise exception 'BAD_PLAYER: player is not in this match';
  end if;
  if p_rating is null then
    update public.player_match_ratings set deleted_at = now() where match_id = p_match and player_id = p_player and deleted_at is null;
  else
    insert into public.player_match_ratings(match_id, player_id, rating) values (p_match, p_player, round(p_rating, 1))
    on conflict (match_id, player_id) do update set rating = excluded.rating, deleted_at = null, reset_batch = null;
  end if;
end $$;

-- Knockout dependents that would be affected by changing this match's result.
-- Returns codes of dependent matches that have STARTED or are FINALIZED (these block a reset/void).
create or replace function public._blocking_dependents(m public.matches) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(d.code || ' (' || case when d.finalized then 'finalized' else d.status end || ')' order by d.match_no), '{}')
  from public.matches d
  where d.tournament_id = m.tournament_id
    and (d.status in ('live','full_time') or d.finalized)
    and case m.stage
          when 'group' then d.stage in ('semifinal','final','third_place')
          when 'semifinal' then d.stage in ('final','third_place')
          else false end
$$;

-- Core reset (no permission / dependency checks). Returns the reset id.
create or replace function public._reset_match(p_match uuid, p_kind text) returns uuid
language plpgsql security definer set search_path = public as $$
declare m public.matches; rid uuid := gen_random_uuid(); snap jsonb;
begin
  select * into m from public.matches where id = p_match for update;
  snap := jsonb_build_object(
    'match', to_jsonb(m),
    'lineups', coalesce((select jsonb_agg(to_jsonb(l)) from public.match_lineups l where l.match_id = p_match), '[]'::jsonb));
  update public.match_resets set discarded = true where match_id = p_match and not discarded and restored_at is null;
  insert into public.match_resets(id, match_id, actor, kind, snapshot) values (rid, p_match, auth.uid(), p_kind, snap);
  update public.match_events set deleted_at = now(), deleted_by = auth.uid(), reset_batch = rid where match_id = p_match and deleted_at is null;
  update public.player_match_ratings set deleted_at = now(), reset_batch = rid where match_id = p_match and deleted_at is null;
  delete from public.match_lineups where match_id = p_match;  -- kept in the snapshot above
  update public.matches set
    status = 'scheduled', finalized = false, finalized_at = null, finalized_by = null, started_at = null, ended_at = null,
    added_minutes = 0, result_type = 'normal', score_mode = 'events', manual_home = null, manual_away = null,
    pen_home = null, pen_away = null, decided_winner_id = null, decision_reason = null, var_home = 0, var_away = 0,
    mvp_player_id = null, voided_from = null,
    ratings_published = coalesce((select ratings_published_default from public.settings s where s.tournament_id = m.tournament_id), false)
  where id = p_match;
  insert into public.live_pings(match_id, at) values (p_match, now()) on conflict (match_id) do update set at = excluded.at;
  return rid;
end $$;

-- Detach knockout teams that depended on this match (only slots of matches that have not started).
create or replace function public._detach_dependents(m public.matches) returns void
language plpgsql security definer set search_path = public as $$
begin
  if m.stage = 'group' and exists (select 1 from public.matches k where k.tournament_id = m.tournament_id and k.stage = 'semifinal' and (k.home_team_id is not null or k.away_team_id is not null)) then
    update public.tournaments set bracket_needs_review = true where id = m.tournament_id;
  elsif m.stage = 'semifinal' then
    update public.matches set
      home_team_id = case when m.code = 'SF1' then null else home_team_id end,
      away_team_id = case when m.code = 'SF2' then null else away_team_id end
    where tournament_id = m.tournament_id and code = 'FINAL' and status = 'scheduled' and not finalized;
    update public.matches set
      home_team_id = case when m.code = 'SF1' then null else home_team_id end,
      away_team_id = case when m.code = 'SF2' then null else away_team_id end
    where tournament_id = m.tournament_id and code = 'THIRD' and status = 'scheduled' and not finalized;
  end if;
end $$;

-- Reset one match back to Scheduled 0–0. Finalized or with events → p_confirm must equal the match code.
create or replace function public.admin_match_reset(p_match uuid, p_confirm text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare m public.matches; blockers text[]; rid uuid;
begin
  perform public._require('scorer');
  select * into m from public.matches where id = p_match for update;
  if m.id is null then raise exception 'NOT_FOUND'; end if;
  blockers := public._blocking_dependents(m);
  if array_length(blockers, 1) > 0 then
    raise exception 'DEPENDENTS: reset these knockout matches first: %', array_to_string(blockers, ', ');
  end if;
  if (m.finalized or exists (select 1 from public.match_events where match_id = p_match and deleted_at is null))
     and coalesce(upper(trim(p_confirm)), '') <> upper(m.code) then
    raise exception 'CONFIRM_REQUIRED: type % to confirm', m.code;
  end if;
  rid := public._reset_match(p_match, 'reset');
  perform public._detach_dependents(m);
  return rid;
end $$;

-- Undo the last reset of a match (only while no new events were recorded and the match is still scheduled).
create or replace function public.admin_match_reset_restore(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.match_resets; cur public.matches; old jsonb; blockers text[];
begin
  perform public._require('scorer');
  select * into cur from public.matches where id = p_match for update;
  select * into r from public.match_resets where match_id = p_match and not discarded and restored_at is null order by at desc limit 1;
  if r.id is null then raise exception 'NOTHING_TO_RESTORE: no reset to undo (new events were recorded since)'; end if;
  if cur.status <> 'scheduled' or exists (select 1 from public.match_events where match_id = p_match and deleted_at is null) then
    raise exception 'NOT_RESTORABLE: the match has been played again since the reset';
  end if;
  old := r.snapshot -> 'match';
  blockers := public._blocking_dependents(cur);
  if array_length(blockers, 1) > 0 then
    raise exception 'DEPENDENTS: these later knockout matches have started since: %', array_to_string(blockers, ', ');
  end if;
  update public.match_events set deleted_at = null, deleted_by = null, reset_batch = null where reset_batch = r.id;
  update public.player_match_ratings set deleted_at = null, reset_batch = null where reset_batch = r.id;
  insert into public.match_lineups(match_id, player_id, team_id)
    select (x->>'match_id')::uuid, (x->>'player_id')::uuid, (x->>'team_id')::uuid from jsonb_array_elements(r.snapshot->'lineups') x
  on conflict do nothing;
  update public.matches set
    status = old->>'status', finalized = (old->>'finalized')::boolean, finalized_at = (old->>'finalized_at')::timestamptz,
    finalized_by = (old->>'finalized_by')::uuid, started_at = (old->>'started_at')::timestamptz, ended_at = (old->>'ended_at')::timestamptz,
    added_minutes = (old->>'added_minutes')::int, result_type = old->>'result_type', score_mode = old->>'score_mode',
    manual_home = (old->>'manual_home')::int, manual_away = (old->>'manual_away')::int,
    pen_home = (old->>'pen_home')::int, pen_away = (old->>'pen_away')::int,
    decided_winner_id = (old->>'decided_winner_id')::uuid, decision_reason = old->>'decision_reason',
    var_home = (old->>'var_home')::int, var_away = (old->>'var_away')::int,
    mvp_player_id = (old->>'mvp_player_id')::uuid, ratings_published = (old->>'ratings_published')::boolean,
    voided_from = old->'voided_from'
  where id = p_match;
  update public.match_resets set restored_at = now() where id = r.id;
  if cur.stage = 'semifinal' and (old->>'finalized')::boolean then perform public._prepare_final(cur.tournament_id); end if;
  insert into public.live_pings(match_id, at) values (p_match, now()) on conflict (match_id) do update set at = excluded.at;
end $$;

-- New events discard any pending reset snapshot for that match.
create or replace function public.discard_reset_on_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.deleted_at is null then
    update public.match_resets set discarded = true where match_id = new.match_id and not discarded and restored_at is null;
  end if;
  return new;
end $$;
drop trigger if exists match_events_discard_reset on public.match_events;
create trigger match_events_discard_reset after insert on public.match_events for each row execute function public.discard_reset_on_event();

-- Void: exclude from everything but keep all history. Restore puts back the previous state.
create or replace function public.admin_match_void(p_match uuid, p_confirm text default null)
returns void language plpgsql security definer set search_path = public as $$
declare m public.matches; blockers text[];
begin
  perform public._require('owner');
  select * into m from public.matches where id = p_match for update;
  if m.status = 'cancelled' then return; end if;
  blockers := public._blocking_dependents(m);
  if array_length(blockers, 1) > 0 then
    raise exception 'DEPENDENTS: reset these knockout matches first: %', array_to_string(blockers, ', ');
  end if;
  if (m.finalized or exists (select 1 from public.match_events where match_id = p_match and deleted_at is null))
     and coalesce(upper(trim(p_confirm)), '') <> upper(m.code) then
    raise exception 'CONFIRM_REQUIRED: type % to confirm', m.code;
  end if;
  update public.matches set voided_from = jsonb_build_object('status', m.status, 'finalized', m.finalized, 'finalized_at', m.finalized_at),
         status = 'cancelled', finalized = false where id = p_match;
  perform public._detach_dependents(m);
end $$;

create or replace function public.admin_match_restore(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m public.matches;
begin
  perform public._require('owner');
  select * into m from public.matches where id = p_match for update;
  if m.status <> 'cancelled' then return; end if;
  if m.voided_from is not null then
    update public.matches set status = m.voided_from->>'status', finalized = coalesce((m.voided_from->>'finalized')::boolean, false),
           finalized_at = (m.voided_from->>'finalized_at')::timestamptz, voided_from = null where id = p_match;
    if m.stage = 'semifinal' and coalesce((m.voided_from->>'finalized')::boolean, false) then perform public._prepare_final(m.tournament_id); end if;
    if m.stage = 'group' then update public.tournaments set bracket_needs_review = true
      where id = m.tournament_id and exists (select 1 from public.matches k where k.tournament_id = m.tournament_id and k.stage = 'semifinal' and k.home_team_id is not null); end if;
  else
    update public.matches set status = 'scheduled' where id = p_match;
  end if;
end $$;

-- Owner: reset every match of the tournament (knockouts first). Teams, players and payments untouched.
create or replace function public.admin_reset_all(p_tournament uuid, p_confirm text)
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  perform public._require('owner');
  if p_confirm is distinct from 'RESET' then raise exception 'CONFIRM_REQUIRED: type RESET to confirm'; end if;
  for r in select id from public.matches where tournament_id = p_tournament
             and (status <> 'scheduled' or finalized or exists (select 1 from public.match_events e where e.match_id = matches.id and e.deleted_at is null)
                  or exists (select 1 from public.player_match_ratings x where x.match_id = matches.id and x.deleted_at is null))
           order by case stage when 'final' then 0 when 'third_place' then 0 when 'semifinal' then 1 else 2 end, match_no
  loop
    perform public._reset_match(r.id, 'reset_all');
    n := n + 1;
  end loop;
  update public.matches set home_team_id = null, away_team_id = null
   where tournament_id = p_tournament and stage <> 'group' and status = 'scheduled';
  update public.tournaments set groups_confirmed_at = null, bracket_needs_review = false where id = p_tournament;
  return n;
end $$;

-- Restore a withdrawn team. p_group: move it to another group; p_swap_back: take its fixtures back from its replacement
-- (the replacement is then withdrawn).
create or replace function public.admin_team_restore(p_team uuid, p_group uuid default null, p_swap_back boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare t public.teams; succ public.teams; gid uuid; cnt int; names text;
begin
  perform public._require('owner');
  select * into t from public.teams where id = p_team for update;
  if t.status <> 'withdrawn' then return; end if;
  select * into succ from public.teams where replaces_team_id = t.id and status <> 'withdrawn' limit 1;
  if succ.id is not null and not p_swap_back then
    raise exception 'REPLACED: % took this team''s place — choose "swap back" to return its fixtures', succ.display_name;
  end if;
  gid := coalesce(p_group, t.group_id);
  select count(*), string_agg(display_name, ', ') into cnt, names from public.teams
   where group_id = gid and status <> 'withdrawn' and id <> t.id and (succ.id is null or id <> succ.id);
  if cnt >= 4 then raise exception 'GROUP_FULL: that group already has 4 teams (%) — pick another group or withdraw one', names; end if;
  if succ.id is not null then
    update public.matches set home_team_id = t.id where home_team_id = succ.id and status in ('scheduled','postponed','cancelled') and not finalized and started_at is null;
    update public.matches set away_team_id = t.id where away_team_id = succ.id and status in ('scheduled','postponed','cancelled') and not finalized and started_at is null;
    update public.teams set status = 'withdrawn', withdrawn_at = now(),
      results_policy = case when exists (select 1 from public.matches where (home_team_id = succ.id or away_team_id = succ.id) and finalized) then 'keep' else 'expunge' end
     where id = succ.id;
  end if;
  update public.teams set status = 'confirmed', withdrawn_at = null, results_policy = 'keep', group_id = gid where id = t.id;
  -- fixtures cancelled by the withdrawal come back (never ones that were voided on purpose)
  update public.matches set status = 'scheduled'
   where (home_team_id = t.id or away_team_id = t.id) and status = 'cancelled' and voided_from is null and started_at is null and not finalized;
end $$;

revoke all on function public.admin_match_reset(uuid, text) from public, anon;
revoke all on function public.admin_match_reset_restore(uuid) from public, anon;
revoke all on function public.admin_match_void(uuid, text) from public, anon;
revoke all on function public.admin_reset_all(uuid, text) from public, anon;
revoke all on function public.admin_team_restore(uuid, uuid, boolean) from public, anon;
revoke all on function public._reset_match(uuid, text) from public, anon, authenticated;
revoke all on function public._detach_dependents(public.matches) from public, anon, authenticated;
grant execute on function public.admin_match_reset(uuid, text) to authenticated;
grant execute on function public.admin_match_reset_restore(uuid) to authenticated;
grant execute on function public.admin_match_void(uuid, text) to authenticated;
grant execute on function public.admin_reset_all(uuid, text) to authenticated;
grant execute on function public.admin_team_restore(uuid, uuid, boolean) to authenticated;
