-- Don't ping a match that is itself being deleted (cascades).
create or replace function public.ping_match() returns trigger
language plpgsql security definer set search_path = public as $$
declare mid uuid := coalesce(new.match_id, old.match_id);
begin
  if exists (select 1 from public.matches where id = mid) then
    insert into public.live_pings(match_id, at) values (mid, now())
    on conflict (match_id) do update set at = excluded.at;
  end if;
  return coalesce(new, old);
end $$;
