-- ============================================================
-- CaRPM Admin Panel — is_admin + RLS + broadcast + badges
-- Supabase SQL Editor'da çalıştır (tüm dosya).
--
-- Admin atama (ör. Kaan Pala / yedekpala@gmail.com):
--   update public.profiles
--   set is_admin = true
--   where id = 'abeb77ca-9376-4cfc-a026-3663ab1487f9';
-- ============================================================

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Profiles: admin update/delete
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update using (public.is_admin());

drop policy if exists "profiles_admin_delete" on public.profiles;
create policy "profiles_admin_delete" on public.profiles
  for delete using (public.is_admin());

-- Clubs
drop policy if exists "clubs_admin_all" on public.clubs;
create policy "clubs_admin_all" on public.clubs
  for all using (public.is_admin()) with check (public.is_admin());

-- Vehicles
drop policy if exists "vehicles_admin_all" on public.vehicles;
create policy "vehicles_admin_all" on public.vehicles
  for all using (public.is_admin()) with check (public.is_admin());

-- Shots
drop policy if exists "shots_admin_all" on public.shots;
create policy "shots_admin_all" on public.shots
  for all using (public.is_admin()) with check (public.is_admin());

-- Badges catalog
drop policy if exists "badges_admin_all" on public.badges;
create policy "badges_admin_all" on public.badges
  for all using (public.is_admin()) with check (public.is_admin());

-- User badges
drop policy if exists "user_badges_admin_all" on public.user_badges;
create policy "user_badges_admin_all" on public.user_badges
  for all using (public.is_admin()) with check (public.is_admin());

-- badge_count sync
create or replace function public.sync_badge_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles
    set badge_count = (
      select count(*)::int from public.user_badges where user_id = new.user_id
    )
    where id = new.user_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.profiles
    set badge_count = (
      select count(*)::int from public.user_badges where user_id = old.user_id
    )
    where id = old.user_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists user_badges_sync_count on public.user_badges;
create trigger user_badges_sync_count
  after insert or delete on public.user_badges
  for each row execute function public.sync_badge_count();

-- Toplu bildirim (admin)
create or replace function public.admin_broadcast_notification(
  p_title text,
  p_body text,
  p_user_ids uuid[] default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz: admin gerekli';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'Başlık zorunlu';
  end if;

  if p_user_ids is null then
    insert into public.notifications (user_id, actor_id, type, title, body, data)
    select
      p.id,
      auth.uid(),
      'admin',
      trim(p_title),
      nullif(trim(p_body), ''),
      jsonb_build_object('broadcast', true)
    from public.profiles p;

    get diagnostics v_count = row_count;
  else
    insert into public.notifications (user_id, actor_id, type, title, body, data)
    select
      u,
      auth.uid(),
      'admin',
      trim(p_title),
      nullif(trim(p_body), ''),
      jsonb_build_object('broadcast', true)
    from unnest(p_user_ids) as u
    where exists (select 1 from public.profiles p where p.id = u);

    get diagnostics v_count = row_count;
  end if;

  return v_count;
end;
$$;

revoke all on function public.admin_broadcast_notification(text, text, uuid[]) from public;
grant execute on function public.admin_broadcast_notification(text, text, uuid[]) to authenticated;

-- Rozet ver (admin)
create or replace function public.admin_award_badge(
  p_user_id uuid,
  p_badge_id uuid,
  p_achievement_value text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz: admin gerekli';
  end if;

  insert into public.user_badges (user_id, badge_id, achievement_value)
  values (p_user_id, p_badge_id, p_achievement_value)
  on conflict (user_id, badge_id) do update
    set achievement_value = coalesce(excluded.achievement_value, public.user_badges.achievement_value)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.admin_award_badge(uuid, uuid, text) from public;
grant execute on function public.admin_award_badge(uuid, uuid, text) to authenticated;
