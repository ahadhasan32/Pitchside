-- =============================================================================
-- Winter Showdown / Pitchside — initial schema
-- Relational model, RLS everywhere, match-affecting writes via RPC, audit log.
-- Safe to run on an empty project. Does not touch any pre-existing tables.
-- =============================================================================
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Admin roles
-- ---------------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  role       text not null default 'scorer' check (role in ('owner','scorer','viewer')),
  created_at timestamptz not null default now()
);

create or replace function public.role_rank(r text) returns int
language sql immutable as $$
  select case r when 'owner' then 3 when 'scorer' then 2 when 'viewer' then 1 else 0 end
$$;

create or replace function public.current_admin_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.admin_users where user_id = auth.uid()
$$;

create or replace function public.has_role(min_role text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.role_rank(public.current_admin_role()) >= public.role_rank(min_role), false)
$$;

create or replace function public.current_admin_email() returns text
language sql stable security definer set search_path = public as $$
  select email from public.admin_users where user_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Tournament + settings
-- ---------------------------------------------------------------------------
create table if not exists public.tournaments (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique,
  name                   text not null,
  starts_at              timestamptz,
  venue                  text,
  is_test                boolean not null default false,
  groups_confirmed_at    timestamptz,
  bracket_needs_review   boolean not null default false,
  created_at             timestamptz not null default now()
);

create table if not exists public.settings (
  tournament_id          uuid primary key references public.tournaments(id) on delete cascade,
  site_mode              text not null default 'live' check (site_mode in ('pre','live','completed')),
  registration_open      boolean not null default false,
  banner_en              text,
  banner_bn              text,
  tiebreak_order         text[] not null default array['gd','gf','h2h','fairplay','lot'],
  knockout_tie_resolution text not null default 'penalties' check (knockout_tie_resolution in ('penalties','organizer')),
  second_yellow_points   int not null default 2,   -- first yellow (1) + second yellow (2) = 3 = a red
  ratings_published_default boolean not null default false,
  third_place_enabled    boolean not null default false,
  rating_min_matches     int not null default 2,
  walkover_goals         int not null default 3,
  golden_boot_tiebreak   text not null default 'fewer_matches_then_assists',
  stage_rules            jsonb not null default '{"group":{"normal":10,"max_added":2},"semifinal":{"normal":15,"max_added":3},"final":{"normal":20,"max_added":4},"third_place":{"normal":15,"max_added":3}}',
  updated_at             timestamptz not null default now()
);

create table if not exists public.groups (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  code          text not null,
  name          text not null,
  unique (tournament_id, code)
);

-- ---------------------------------------------------------------------------
-- Teams & players (public) + private companions
-- ---------------------------------------------------------------------------
create table if not exists public.teams (
  id                uuid primary key default gen_random_uuid(),
  tournament_id     uuid not null references public.tournaments(id) on delete cascade,
  group_id          uuid references public.groups(id) on delete set null,
  name              text not null,           -- registered name (may be Bangla)
  display_name      text not null,
  short_code        text not null check (char_length(short_code) between 1 and 5),
  color             text not null default '#00E5FF' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_url          text,
  captain_player_id uuid,
  lot_rank          int,
  status            text not null default 'confirmed' check (status in ('pending','confirmed','withdrawn')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists teams_tournament_idx on public.teams(tournament_id);

create table if not exists public.team_private (
  team_id         uuid primary key references public.teams(id) on delete cascade,
  reg_id          text unique,
  contact_phone   text,
  bkash_trx       text,
  registered_at   timestamptz,
  terms_accepted  text check (terms_accepted in ('yes','no')),  -- null = unknown
  fee_total       numeric(10,2) not null default 3050,
  notes           text,
  raw             jsonb,
  updated_at      timestamptz not null default now()
);

create table if not exists public.players (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  slot       int check (slot between 1 and 10),
  name       text not null check (char_length(trim(name)) > 0),
  position   text not null default 'midfielder' check (position in ('goalkeeper','defender','midfielder','striker')),
  jersey     int check (jersey between 0 and 99),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists players_team_idx on public.players(team_id);
create unique index if not exists players_team_jersey_uq on public.players(team_id, jersey) where jersey is not null and active;

alter table public.teams drop constraint if exists teams_captain_fk;
alter table public.teams add constraint teams_captain_fk foreign key (captain_player_id) references public.players(id) on delete set null;

create table if not exists public.player_private (
  player_id   uuid primary key references public.players(id) on delete cascade,
  institution text,
  age         int check (age between 5 and 99),
  phone       text,
  photo_path  text,
  updated_at  timestamptz not null default now()
);

-- Max 10 active players per team
create or replace function public.enforce_squad_limit() returns trigger
language plpgsql as $$
begin
  if new.active and (select count(*) from public.players p where p.team_id = new.team_id and p.active and p.id <> new.id) >= 10 then
    raise exception 'SQUAD_FULL: a team may register at most 10 active players';
  end if;
  return new;
end $$;
drop trigger if exists players_squad_limit on public.players;
create trigger players_squad_limit before insert or update of active, team_id on public.players
  for each row execute function public.enforce_squad_limit();

-- ---------------------------------------------------------------------------
-- Matches, events, lineups, ratings
-- ---------------------------------------------------------------------------
create table if not exists public.matches (
  id                 uuid primary key default gen_random_uuid(),
  tournament_id      uuid not null references public.tournaments(id) on delete cascade,
  code               text not null,                -- M01..M12, SF1, SF2, FINAL, THIRD (slot)
  match_no           int not null,
  stage              text not null check (stage in ('group','semifinal','final','third_place')),
  group_id           uuid references public.groups(id) on delete set null,
  home_team_id       uuid references public.teams(id) on delete set null,
  away_team_id       uuid references public.teams(id) on delete set null,
  home_placeholder   text,
  away_placeholder   text,
  scheduled_at       timestamptz,
  ends_at            timestamptz,
  venue              text,
  status             text not null default 'scheduled' check (status in ('scheduled','live','full_time','postponed','cancelled')),
  finalized          boolean not null default false,
  finalized_at       timestamptz,
  finalized_by       uuid,
  started_at         timestamptz,
  ended_at           timestamptz,
  added_minutes      int not null default 0 check (added_minutes between 0 and 10),
  result_type        text not null default 'normal' check (result_type in ('normal','walkover_home','walkover_away','abandoned')),
  score_mode         text not null default 'events' check (score_mode in ('events','manual')),
  manual_home        int check (manual_home >= 0),
  manual_away        int check (manual_away >= 0),
  pen_home           int check (pen_home >= 0),
  pen_away           int check (pen_away >= 0),
  decided_winner_id  uuid references public.teams(id) on delete set null,
  decision_reason    text,
  note               text,
  var_home           int not null default 0 check (var_home between 0 and 2),
  var_away           int not null default 0 check (var_away between 0 and 2),
  mvp_player_id      uuid references public.players(id) on delete set null,
  ratings_published  boolean not null default false,
  imported_from      text,
  version            int not null default 1,
  updated_at         timestamptz not null default now(),
  updated_by         uuid,
  unique (tournament_id, code),
  check (home_team_id is null or away_team_id is null or home_team_id <> away_team_id),
  check (finalized = false or status in ('full_time','cancelled') or result_type <> 'normal')
);
create index if not exists matches_tournament_idx on public.matches(tournament_id, match_no);

create table if not exists public.match_events (
  id               uuid primary key default gen_random_uuid(),   -- client-generated => idempotent
  match_id         uuid not null references public.matches(id) on delete cascade,
  type             text not null check (type in ('goal','own_goal','yellow','second_yellow','red','red_violent')),
  team_id          uuid not null references public.teams(id),     -- the player's own team
  player_id        uuid not null references public.players(id),
  assist_player_id uuid references public.players(id),
  minute           int check (minute between 0 and 60),
  note             text,
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (assist_player_id is null or (type = 'goal' and assist_player_id <> player_id))
);
create index if not exists match_events_match_idx on public.match_events(match_id);
create index if not exists match_events_player_idx on public.match_events(player_id);

create or replace function public.validate_match_event() returns trigger
language plpgsql as $$
declare m record; p_team uuid; a_team uuid;
begin
  select * into m from public.matches where id = new.match_id;
  if new.team_id is distinct from m.home_team_id and new.team_id is distinct from m.away_team_id then
    raise exception 'EVENT_TEAM: team is not playing in this match';
  end if;
  select team_id into p_team from public.players where id = new.player_id;
  if p_team is distinct from new.team_id then
    raise exception 'EVENT_PLAYER: player is not on the selected team';
  end if;
  if new.assist_player_id is not null then
    select team_id into a_team from public.players where id = new.assist_player_id;
    if a_team is distinct from new.team_id then
      raise exception 'EVENT_ASSIST: assist must come from the scorer''s team';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists match_events_validate on public.match_events;
create trigger match_events_validate before insert or update on public.match_events
  for each row execute function public.validate_match_event();

create table if not exists public.match_lineups (
  match_id  uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  team_id   uuid not null references public.teams(id) on delete cascade,
  primary key (match_id, player_id)
);

create table if not exists public.player_match_ratings (
  match_id   uuid not null references public.matches(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  rating     numeric(3,1) not null check (rating >= 0 and rating <= 10),
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

-- ---------------------------------------------------------------------------
-- Awards, payments, registrations, audit, legacy keys
-- ---------------------------------------------------------------------------
create table if not exists public.awards (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  key           text not null check (key in ('winter_crown','iron_wall','golden_gloves','golden_boot')),
  player_id     uuid references public.players(id) on delete set null,
  team_id       uuid references public.teams(id) on delete set null,
  label         text,
  published     boolean not null default false,
  published_at  timestamptz,
  updated_at    timestamptz not null default now(),
  primary key (tournament_id, key)
);

create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  amount      numeric(10,2) not null check (amount <> 0),
  paid_on     date,
  method      text,
  trx_id      text,
  note        text,
  import_key  text unique,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

create table if not exists public.registration_submissions (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  payload       jsonb not null check (pg_column_size(payload) < 40000),
  status        text not null default 'new' check (status in ('new','approved','rejected')),
  created_at    timestamptz not null default now()
);

create or replace function public.registration_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.registration_submissions where created_at > now() - interval '10 minutes') >= 20 then
    raise exception 'RATE_LIMITED: too many submissions, try again later';
  end if;
  new.status := 'new';
  new.created_at := now();
  return new;
end $$;
drop trigger if exists registration_rate_limit on public.registration_submissions;
create trigger registration_rate_limit before insert on public.registration_submissions
  for each row execute function public.registration_rate_limit();

create table if not exists public.audit_log (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  actor       uuid,
  actor_email text,
  action      text not null,
  entity      text not null,
  entity_id   text,
  before      jsonb,
  after       jsonb
);
create index if not exists audit_log_at_idx on public.audit_log(at desc);
create index if not exists audit_log_entity_idx on public.audit_log(entity, entity_id);

create table if not exists public.legacy_keys (
  source  text not null,     -- 'regid', 'regid_slot', 'pitchside'
  key     text not null,
  entity  text not null,
  new_id  uuid not null,
  primary key (source, key)
);

-- ---------------------------------------------------------------------------
-- Generic audit + updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_id text;
begin
  if tg_op = 'DELETE' then
    v_id := coalesce(to_jsonb(old)->>'id', to_jsonb(old)->>'team_id', to_jsonb(old)->>'player_id', to_jsonb(old)->>'match_id');
  else
    v_id := coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'team_id', to_jsonb(new)->>'player_id', to_jsonb(new)->>'match_id');
  end if;
  insert into public.audit_log(actor, actor_email, action, entity, entity_id, before, after)
  values (auth.uid(), coalesce(public.current_admin_email(), case when auth.uid() is null then 'system' end),
          lower(tg_op), tg_table_name, v_id,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['tournaments','settings','groups','teams','team_private','players','player_private','matches',
                           'match_events','match_lineups','player_match_ratings','awards','payments','admin_users'] loop
    execute format('drop trigger if exists %I_audit on public.%I', t, t);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row()', t, t);
  end loop;
  foreach t in array array['settings','teams','team_private','players','player_private','player_match_ratings','awards'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- matches: version bump on every update (optimistic concurrency)
create or replace function public.matches_bump_version() returns trigger
language plpgsql as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;
drop trigger if exists matches_version on public.matches;
create trigger matches_version before update on public.matches
  for each row execute function public.matches_bump_version();

-- Last owner protection
create or replace function public.protect_last_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    if (select count(*) from public.admin_users where role = 'owner' and user_id <> old.user_id) = 0 then
      raise exception 'LAST_OWNER: the last owner cannot be removed or demoted';
    end if;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists admin_users_last_owner on public.admin_users;
create trigger admin_users_last_owner before update or delete on public.admin_users
  for each row execute function public.protect_last_owner();

-- ---------------------------------------------------------------------------
-- Derived score: events are authoritative (unless walkover / manual mode)
-- ---------------------------------------------------------------------------
create or replace view public.match_scores with (security_invoker = true) as
select
  m.id as match_id,
  coalesce(e.home_goals, 0) as events_home,
  coalesce(e.away_goals, 0) as events_away,
  case
    when m.result_type = 'walkover_home' then s.walkover_goals
    when m.result_type = 'walkover_away' then 0
    when m.score_mode = 'manual' or m.result_type = 'abandoned' then coalesce(m.manual_home, coalesce(e.home_goals, 0))
    else coalesce(e.home_goals, 0)
  end as home_score,
  case
    when m.result_type = 'walkover_away' then s.walkover_goals
    when m.result_type = 'walkover_home' then 0
    when m.score_mode = 'manual' or m.result_type = 'abandoned' then coalesce(m.manual_away, coalesce(e.away_goals, 0))
    else coalesce(e.away_goals, 0)
  end as away_score,
  (m.score_mode = 'manual' and (coalesce(e.home_goals,0) <> coalesce(m.manual_home,0) or coalesce(e.away_goals,0) <> coalesce(m.manual_away,0))) as details_incomplete
from public.matches m
left join public.settings s on s.tournament_id = m.tournament_id
left join lateral (
  select
    count(*) filter (where (ev.type = 'goal' and ev.team_id = m.home_team_id) or (ev.type = 'own_goal' and ev.team_id = m.away_team_id)) as home_goals,
    count(*) filter (where (ev.type = 'goal' and ev.team_id = m.away_team_id) or (ev.type = 'own_goal' and ev.team_id = m.home_team_id)) as away_goals
  from public.match_events ev where ev.match_id = m.id
) e on true;

create or replace function public.match_winner(p_match uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select case
    when m.decided_winner_id is not null then m.decided_winner_id
    when m.result_type = 'walkover_home' then m.home_team_id
    when m.result_type = 'walkover_away' then m.away_team_id
    when s.home_score > s.away_score then m.home_team_id
    when s.away_score > s.home_score then m.away_team_id
    when m.pen_home is not null and m.pen_away is not null and m.pen_home > m.pen_away then m.home_team_id
    when m.pen_home is not null and m.pen_away is not null and m.pen_away > m.pen_home then m.away_team_id
    else null end
  from public.matches m join public.match_scores s on s.match_id = m.id
  where m.id = p_match
$$;

create or replace function public.match_loser(p_match uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select case when w is null then null when w = m.home_team_id then m.away_team_id else m.home_team_id end
  from public.matches m, lateral (select public.match_winner(m.id) as w) x where m.id = p_match
$$;

-- ---------------------------------------------------------------------------
-- RPCs (match-affecting writes)
-- ---------------------------------------------------------------------------
create or replace function public._require(min_role text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(min_role) then raise exception 'FORBIDDEN: requires % role', min_role; end if;
end $$;

create or replace function public._check_version(m public.matches, expected int) returns void
language plpgsql stable security definer set search_path = public as $$
declare who text;
begin
  if expected is not null and expected <> m.version then
    select email into who from public.admin_users where user_id = m.updated_by;
    raise exception 'CONFLICT: this match was changed by % — reload', coalesce(who, 'another admin');
  end if;
end $$;

-- Final (and optional third place) are prepared automatically once both semis are finalized.
create or replace function public._prepare_final(p_tournament uuid) returns void
language plpgsql security definer set search_path = public as $$
declare sf1 public.matches; sf2 public.matches; fin public.matches; third public.matches;
begin
  select * into sf1 from public.matches where tournament_id = p_tournament and code = 'SF1';
  select * into sf2 from public.matches where tournament_id = p_tournament and code = 'SF2';
  select * into fin from public.matches where tournament_id = p_tournament and code = 'FINAL';
  if sf1.id is null or sf2.id is null or fin.id is null then return; end if;
  if fin.status <> 'scheduled' or fin.finalized then return; end if;
  update public.matches set
    home_team_id = case when sf1.finalized then public.match_winner(sf1.id) end,
    away_team_id = case when sf2.finalized then public.match_winner(sf2.id) end
  where id = fin.id
    and (home_team_id is distinct from case when sf1.finalized then public.match_winner(sf1.id) end
      or away_team_id is distinct from case when sf2.finalized then public.match_winner(sf2.id) end);
  select * into third from public.matches where tournament_id = p_tournament and code = 'THIRD';
  if third.id is not null and third.status = 'scheduled' and not third.finalized then
    update public.matches set
      home_team_id = case when sf1.finalized then public.match_loser(sf1.id) end,
      away_team_id = case when sf2.finalized then public.match_loser(sf2.id) end
    where id = third.id;
  end if;
end $$;

create or replace function public.admin_match_action(p_match uuid, p_action text, p_expected_version int default null)
returns public.matches
language plpgsql security definer set search_path = public as $$
declare m public.matches; t public.tournaments;
begin
  perform public._require('scorer');
  select * into m from public.matches where id = p_match for update;
  if m.id is null then raise exception 'NOT_FOUND'; end if;

  -- idempotency: already in the requested state => no-op
  if (p_action = 'start' and m.status = 'live')
     or (p_action = 'end' and m.status = 'full_time' and not m.finalized)
     or (p_action = 'finalize' and m.finalized)
     or (p_action = 'reopen' and not m.finalized and m.status <> 'cancelled' and m.status = 'live')
     or (p_action = 'postpone' and m.status = 'postponed')
     or (p_action = 'cancel' and m.status = 'cancelled') then
    return m;
  end if;
  perform public._check_version(m, p_expected_version);

  if p_action = 'start' then
    if m.finalized then raise exception 'FINALIZED: reopen the match first'; end if;
    if m.home_team_id is null or m.away_team_id is null then raise exception 'NO_TEAMS: both teams must be set before kick-off'; end if;
    update public.matches set status = 'live', started_at = coalesce(started_at, now()), ended_at = null where id = p_match returning * into m;
  elsif p_action = 'end' then
    if m.status not in ('live','scheduled','postponed') then raise exception 'BAD_STATE: match is %', m.status; end if;
    if m.status <> 'live' and m.result_type = 'normal' then raise exception 'BAD_STATE: start the match first'; end if;
    update public.matches set status = 'full_time', ended_at = now() where id = p_match returning * into m;
  elsif p_action = 'finalize' then
    if m.status <> 'full_time' and m.result_type = 'normal' then raise exception 'BAD_STATE: end the match (Full Time) before finalizing'; end if;
    if m.home_team_id is null or m.away_team_id is null then raise exception 'NO_TEAMS'; end if;
    if m.stage <> 'group' and public.match_winner(m.id) is null then
      raise exception 'KO_DRAW: knockout matches need a winner — enter the penalty shootout (or an organizer decision)';
    end if;
    update public.matches set finalized = true, finalized_at = now(), finalized_by = auth.uid(),
      status = case when status in ('scheduled','postponed','live') then 'full_time' else status end
    where id = p_match returning * into m;
    if m.stage = 'semifinal' then perform public._prepare_final(m.tournament_id); end if;
  elsif p_action = 'reopen' then
    if m.finalized then
      if m.stage = 'semifinal' and exists (select 1 from public.matches f where f.tournament_id = m.tournament_id and f.code in ('FINAL','THIRD') and (f.status <> 'scheduled' or f.finalized)) then
        raise exception 'KO_STARTED: the final has already started — it cannot be silently changed';
      end if;
      update public.matches set finalized = false, finalized_at = null, finalized_by = null where id = p_match returning * into m;
      if m.stage = 'group' and exists (select 1 from public.matches k where k.tournament_id = m.tournament_id and k.stage = 'semifinal' and (k.home_team_id is not null or k.away_team_id is not null)) then
        update public.tournaments set bracket_needs_review = true where id = m.tournament_id;
      end if;
      if m.stage = 'semifinal' then
        update public.matches set home_team_id = case when code='FINAL' and m.code='SF1' then null else home_team_id end,
                                  away_team_id = case when code='FINAL' and m.code='SF2' then null else away_team_id end
        where tournament_id = m.tournament_id and code = 'FINAL' and status = 'scheduled' and not finalized;
      end if;
    elsif m.status in ('full_time','postponed','cancelled') then
      update public.matches set status = 'live', ended_at = null where id = p_match returning * into m;
    end if;
  elsif p_action = 'unstart' then
    if m.finalized then raise exception 'FINALIZED: reopen first'; end if;
    if exists (select 1 from public.match_events where match_id = p_match) then raise exception 'HAS_EVENTS: delete the events before resetting the match'; end if;
    update public.matches set status = 'scheduled', started_at = null, ended_at = null where id = p_match returning * into m;
  elsif p_action = 'postpone' then
    if m.finalized then raise exception 'FINALIZED: reopen first'; end if;
    update public.matches set status = 'postponed' where id = p_match returning * into m;
  elsif p_action = 'cancel' then
    perform public._require('owner');
    if m.finalized then raise exception 'FINALIZED: reopen first'; end if;
    update public.matches set status = 'cancelled' where id = p_match returning * into m;
  else
    raise exception 'BAD_ACTION: %', p_action;
  end if;
  return m;
end $$;

create or replace function public.admin_match_update(p_match uuid, p_patch jsonb, p_expected_version int default null)
returns public.matches
language plpgsql security definer set search_path = public as $$
declare m public.matches; s public.settings; max_added int; ev_count int; k text;
begin
  perform public._require('scorer');
  select * into m from public.matches where id = p_match for update;
  if m.id is null then raise exception 'NOT_FOUND'; end if;
  perform public._check_version(m, p_expected_version);
  select * into s from public.settings where tournament_id = m.tournament_id;

  -- schedule / team assignment fields are owner-only
  foreach k in array array['scheduled_at','ends_at','home_team_id','away_team_id','home_placeholder','away_placeholder','venue'] loop
    if p_patch ? k then perform public._require('owner'); end if;
  end loop;
  if m.finalized and exists (select 1 from jsonb_object_keys(p_patch) x where x not in ('ratings_published','mvp_player_id','note')) then
    raise exception 'FINALIZED: reopen the match before changing its result';
  end if;
  if (p_patch ? 'home_team_id' or p_patch ? 'away_team_id') and m.status <> 'scheduled' then
    raise exception 'KO_STARTED: teams cannot be changed after kick-off';
  end if;

  if p_patch ? 'added_minutes' then
    max_added := coalesce((s.stage_rules -> m.stage ->> 'max_added')::int, 10);
    if (p_patch->>'added_minutes')::int > max_added then
      raise exception 'ADDED_TIME: maximum added time for this stage is % min', max_added;
    end if;
  end if;

  if p_patch ? 'score_mode' and p_patch->>'score_mode' = 'manual' then
    select count(*) into ev_count from public.match_events where match_id = p_match and type in ('goal','own_goal');
    if ev_count > 0 and coalesce((p_patch->>'confirm_override')::boolean, false) = false then
      raise exception 'CONFIRM_REQUIRED: goal events exist — confirm the manual score override';
    end if;
  end if;

  if (p_patch ? 'pen_home' or p_patch ? 'pen_away') and m.stage = 'group' then
    raise exception 'NO_PENS: penalty shootouts only apply to knockout matches';
  end if;

  update public.matches set
    added_minutes     = coalesce((p_patch->>'added_minutes')::int, added_minutes),
    result_type       = coalesce(p_patch->>'result_type', result_type),
    score_mode        = coalesce(p_patch->>'score_mode', score_mode),
    manual_home       = case when p_patch ? 'manual_home' then (p_patch->>'manual_home')::int else manual_home end,
    manual_away       = case when p_patch ? 'manual_away' then (p_patch->>'manual_away')::int else manual_away end,
    pen_home          = case when p_patch ? 'pen_home' then (p_patch->>'pen_home')::int else pen_home end,
    pen_away          = case when p_patch ? 'pen_away' then (p_patch->>'pen_away')::int else pen_away end,
    decided_winner_id = case when p_patch ? 'decided_winner_id' then (p_patch->>'decided_winner_id')::uuid else decided_winner_id end,
    decision_reason   = case when p_patch ? 'decision_reason' then p_patch->>'decision_reason' else decision_reason end,
    note              = case when p_patch ? 'note' then p_patch->>'note' else note end,
    var_home          = coalesce((p_patch->>'var_home')::int, var_home),
    var_away          = coalesce((p_patch->>'var_away')::int, var_away),
    mvp_player_id     = case when p_patch ? 'mvp_player_id' then (p_patch->>'mvp_player_id')::uuid else mvp_player_id end,
    ratings_published = coalesce((p_patch->>'ratings_published')::boolean, ratings_published),
    scheduled_at      = case when p_patch ? 'scheduled_at' then (p_patch->>'scheduled_at')::timestamptz else scheduled_at end,
    ends_at           = case when p_patch ? 'ends_at' then (p_patch->>'ends_at')::timestamptz else ends_at end,
    home_team_id      = case when p_patch ? 'home_team_id' then (p_patch->>'home_team_id')::uuid else home_team_id end,
    away_team_id      = case when p_patch ? 'away_team_id' then (p_patch->>'away_team_id')::uuid else away_team_id end,
    home_placeholder  = case when p_patch ? 'home_placeholder' then p_patch->>'home_placeholder' else home_placeholder end,
    away_placeholder  = case when p_patch ? 'away_placeholder' then p_patch->>'away_placeholder' else away_placeholder end,
    venue             = case when p_patch ? 'venue' then p_patch->>'venue' else venue end
  where id = p_match returning * into m;

  if m.decided_winner_id is not null and m.decided_winner_id not in (m.home_team_id, m.away_team_id) then
    raise exception 'BAD_WINNER: winner must be one of the two teams';
  end if;
  if m.decided_winner_id is not null and coalesce(trim(m.decision_reason), '') = '' then
    raise exception 'REASON_REQUIRED: an organizer decision needs a recorded reason';
  end if;
  if m.mvp_player_id is not null and not exists (select 1 from public.players p where p.id = m.mvp_player_id and p.team_id in (m.home_team_id, m.away_team_id)) then
    raise exception 'BAD_MVP: MVP must play for one of the two teams';
  end if;
  return m;
end $$;

-- Switch a manual (details-incomplete) match back to event mode once the events match.
create or replace function public._reconcile_manual(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.matches m set score_mode = 'events'
  from public.match_scores s
  where m.id = p_match and s.match_id = m.id and m.score_mode = 'manual' and m.result_type = 'normal'
    and s.events_home = coalesce(m.manual_home, 0) and s.events_away = coalesce(m.manual_away, 0);
end $$;

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
  select mt.* into m from public.matches mt join public.match_events e on e.match_id = mt.id where e.id = p_id;
  if m.id is null then return; end if;  -- already deleted: idempotent
  if m.finalized then raise exception 'FINALIZED: reopen the match before editing events'; end if;
  delete from public.match_events where id = p_id;
  perform public._reconcile_manual(m.id);
end $$;

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
    delete from public.player_match_ratings where match_id = p_match and player_id = p_player;
  else
    insert into public.player_match_ratings(match_id, player_id, rating) values (p_match, p_player, round(p_rating, 1))
    on conflict (match_id, player_id) do update set rating = excluded.rating;
  end if;
end $$;

create or replace function public.admin_lineup_set(p_match uuid, p_team uuid, p_players uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare m public.matches;
begin
  perform public._require('scorer');
  select * into m from public.matches where id = p_match;
  if p_team not in (m.home_team_id, m.away_team_id) then raise exception 'EVENT_TEAM'; end if;
  delete from public.match_lineups where match_id = p_match and team_id = p_team and not (player_id = any(p_players));
  insert into public.match_lineups(match_id, player_id, team_id)
  select p_match, p.id, p_team from public.players p where p.id = any(p_players) and p.team_id = p_team
  on conflict do nothing;
end $$;

create or replace function public.admin_confirm_groups(p_tournament uuid, p_confirm boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._require('owner');
  if p_confirm and exists (select 1 from public.matches where tournament_id = p_tournament and stage = 'group' and not finalized and status <> 'cancelled') then
    raise exception 'GROUPS_INCOMPLETE: finalize all group matches first';
  end if;
  update public.tournaments set groups_confirmed_at = case when p_confirm then now() end where id = p_tournament;
end $$;

-- Semis from confirmed standings (computed by the app with the official tie-breakers).
-- Idempotent; never overwrites a started knockout match.
create or replace function public.admin_generate_semis(p_tournament uuid, p_a1 uuid, p_a2 uuid, p_b1 uuid, p_b2 uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare t public.tournaments; sf1 public.matches; sf2 public.matches;
begin
  perform public._require('owner');
  select * into t from public.tournaments where id = p_tournament for update;
  if t.groups_confirmed_at is null then raise exception 'NOT_CONFIRMED: confirm the group standings first'; end if;
  if array_length(array(select distinct x from unnest(array[p_a1,p_a2,p_b1,p_b2]) x where x is not null), 1) <> 4 then
    raise exception 'BAD_TEAMS: four distinct qualified teams are required';
  end if;
  select * into sf1 from public.matches where tournament_id = p_tournament and code = 'SF1' for update;
  select * into sf2 from public.matches where tournament_id = p_tournament and code = 'SF2' for update;
  if (sf1.home_team_id is distinct from p_a1 or sf1.away_team_id is distinct from p_b2) and (sf1.status <> 'scheduled' or sf1.finalized) then
    raise exception 'KO_STARTED: SF1 has already started — it will not be overwritten';
  end if;
  if (sf2.home_team_id is distinct from p_b1 or sf2.away_team_id is distinct from p_a2) and (sf2.status <> 'scheduled' or sf2.finalized) then
    raise exception 'KO_STARTED: SF2 has already started — it will not be overwritten';
  end if;
  update public.matches set home_team_id = p_a1, away_team_id = p_b2
   where id = sf1.id and (home_team_id is distinct from p_a1 or away_team_id is distinct from p_b2);
  update public.matches set home_team_id = p_b1, away_team_id = p_a2
   where id = sf2.id and (home_team_id is distinct from p_b1 or away_team_id is distinct from p_a2);
  update public.tournaments set bracket_needs_review = false where id = p_tournament;
  perform public._prepare_final(p_tournament);
end $$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['admin_users','tournaments','settings','groups','teams','team_private','players','player_private',
                           'matches','match_events','match_lineups','player_match_ratings','awards','payments',
                           'registration_submissions','audit_log','legacy_keys'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- public read
do $$
declare t text;
begin
  foreach t in array array['tournaments','settings','groups','teams','players','matches','match_events','match_lineups'] loop
    execute format('drop policy if exists public_read on public.%I', t);
    execute format('create policy public_read on public.%I for select using (true)', t);
  end loop;
end $$;

drop policy if exists public_read on public.player_match_ratings;
create policy public_read on public.player_match_ratings for select using (
  public.has_role('viewer') or exists (select 1 from public.matches m where m.id = match_id and m.ratings_published));

drop policy if exists public_read on public.awards;
create policy public_read on public.awards for select using (published or public.has_role('viewer'));

-- owner writes on catalog tables
do $$
declare t text;
begin
  foreach t in array array['tournaments','settings','groups','teams','team_private','players','player_private','awards','payments','legacy_keys'] loop
    execute format('drop policy if exists owner_write on public.%I', t);
    execute format('create policy owner_write on public.%I for all using (public.has_role(''owner'')) with check (public.has_role(''owner''))', t);
  end loop;
end $$;

-- private reads: owner + viewer (read-only admin). Scorers do not see private data.
drop policy if exists admin_read on public.team_private;
create policy admin_read on public.team_private for select using (public.has_role('owner') or public.current_admin_role() = 'viewer');
drop policy if exists admin_read on public.player_private;
create policy admin_read on public.player_private for select using (public.has_role('owner') or public.current_admin_role() = 'viewer');
drop policy if exists admin_read on public.payments;
create policy admin_read on public.payments for select using (public.has_role('owner') or public.current_admin_role() = 'viewer');
drop policy if exists admin_read on public.audit_log;
create policy admin_read on public.audit_log for select using (public.has_role('viewer'));
drop policy if exists admin_read on public.legacy_keys;
create policy admin_read on public.legacy_keys for select using (public.has_role('viewer'));

drop policy if exists admin_read on public.admin_users;
create policy admin_read on public.admin_users for select using (public.has_role('viewer'));
drop policy if exists owner_write on public.admin_users;
create policy owner_write on public.admin_users for all using (public.has_role('owner')) with check (public.has_role('owner'));

drop policy if exists admin_read on public.registration_submissions;
create policy admin_read on public.registration_submissions for select using (public.has_role('owner'));
drop policy if exists owner_write on public.registration_submissions;
create policy owner_write on public.registration_submissions for update using (public.has_role('owner')) with check (public.has_role('owner'));
drop policy if exists public_insert_when_open on public.registration_submissions;
create policy public_insert_when_open on public.registration_submissions for insert to anon, authenticated
  with check (exists (select 1 from public.settings s where s.tournament_id = registration_submissions.tournament_id and s.registration_open));

-- Grants: anon/authenticated get only what RLS allows; RPC execution limited to authenticated.
grant usage on schema public to anon, authenticated;
grant select on public.match_scores to anon, authenticated;
revoke all on function public.admin_match_action(uuid, text, int) from public, anon;
revoke all on function public.admin_match_update(uuid, jsonb, int) from public, anon;
revoke all on function public.admin_event_save(uuid, uuid, text, uuid, uuid, uuid, int, text) from public, anon;
revoke all on function public.admin_event_delete(uuid) from public, anon;
revoke all on function public.admin_rating_set(uuid, uuid, numeric) from public, anon;
revoke all on function public.admin_lineup_set(uuid, uuid, uuid[]) from public, anon;
revoke all on function public.admin_confirm_groups(uuid, boolean) from public, anon;
revoke all on function public.admin_generate_semis(uuid, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.admin_match_action(uuid, text, int) to authenticated;
grant execute on function public.admin_match_update(uuid, jsonb, int) to authenticated;
grant execute on function public.admin_event_save(uuid, uuid, text, uuid, uuid, uuid, int, text) to authenticated;
grant execute on function public.admin_event_delete(uuid) to authenticated;
grant execute on function public.admin_rating_set(uuid, uuid, numeric) to authenticated;
grant execute on function public.admin_lineup_set(uuid, uuid, uuid[]) to authenticated;
grant execute on function public.admin_confirm_groups(uuid, boolean) to authenticated;
grant execute on function public.admin_generate_semis(uuid, uuid, uuid, uuid, uuid) to authenticated;
revoke all on function public._prepare_final(uuid) from public, anon, authenticated;
revoke all on function public._reconcile_manual(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['matches','match_events','player_match_ratings','match_lineups','teams','players','settings','awards','tournaments'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; when undefined_object then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Storage: logos (public), player photos (private)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('logos', 'logos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('player-photos', 'player-photos', false) on conflict (id) do nothing;

drop policy if exists "logos owner write" on storage.objects;
create policy "logos owner write" on storage.objects for all to authenticated
  using (bucket_id = 'logos' and public.has_role('owner')) with check (bucket_id = 'logos' and public.has_role('owner'));
drop policy if exists "photos admin read" on storage.objects;
create policy "photos admin read" on storage.objects for select to authenticated
  using (bucket_id = 'player-photos' and (public.has_role('owner') or public.current_admin_role() = 'viewer'));
drop policy if exists "photos owner write" on storage.objects;
create policy "photos owner write" on storage.objects for all to authenticated
  using (bucket_id = 'player-photos' and public.has_role('owner')) with check (bucket_id = 'player-photos' and public.has_role('owner'));
