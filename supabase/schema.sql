-- ============================================================
-- CARPM / REVSHOTS — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL → New query)
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
create type vehicle_type as enum ('car', 'motorcycle');
create type club_member_role as enum ('member', 'moderator', 'admin', 'owner');
create type event_type as enum ('convoy', 'track_day', 'meetup', 'dyno', 'other');
create type shot_destination as enum ('club', 'explore', 'both');
create type audio_source as enum ('original', 'soundbank');

-- ============================================================
-- PROFILES
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text,
  avatar_url text,
  bio text,
  title text,                          -- e.g. "PRO TRACK DRIVER"
  is_pro boolean not null default false,
  is_verified boolean not null default false,
  follower_count int not null default 0,
  following_count int not null default 0,
  like_count int not null default 0,
  vehicle_count int not null default 0,
  badge_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,30}$')
);

-- ============================================================
-- CATEGORIES (Motosiklet, JDM/Drift, Pist Odaklı…)
-- ============================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- TRACKS (İstanbul Park, etc.)
-- ============================================================
create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  length_km numeric(6,3),
  map_image_url text,
  route_label text,                    -- e.g. "Intercity Pist Rotası"
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CLUBS
-- ============================================================
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  location text,
  logo_url text,
  banner_url text,
  is_verified boolean not null default false,
  member_count int not null default 0,
  tags text[] not null default '{}',
  recent_activity text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.club_categories (
  club_id uuid not null references public.clubs(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (club_id, category_id)
);

create table public.club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role club_member_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (club_id, user_id)
);

-- ============================================================
-- EVENTS
-- ============================================================
create table public.events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references public.clubs(id) on delete set null,
  track_id uuid references public.tracks(id) on delete set null,
  title text not null,
  subtitle text,
  description text,
  event_type event_type not null default 'meetup',
  start_time timestamptz not null,
  end_time timestamptz,
  location_name text,
  banner_url text,
  is_live boolean not null default false,
  is_featured boolean not null default false,
  approved_vehicle_count int not null default 0,
  participant_count int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid,                     -- FK added after vehicles
  status text not null default 'going' check (status in ('going', 'interested', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- ============================================================
-- VEHICLES (Garaj)
-- ============================================================
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  make text not null,
  model text not null,
  year int,
  body_type text,                      -- Coupe, Sedan…
  engine_code text,
  vehicle_type vehicle_type not null default 'car',
  hp int,
  torque_nm int,
  weight_kg int,
  zero_to_hundred numeric(4,1),
  image_url text,
  garage_number int,
  ecu_map text,                        -- STG 2+
  exhaust_db numeric(5,1),
  last_dyno_at timestamptz,
  is_active boolean not null default false, -- "Aktif Canavar"
  badges text[] not null default '{}', -- STAGE 2 TUNE, TRACK READY…
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.event_participants
  add constraint event_participants_vehicle_fk
  foreign key (vehicle_id) references public.vehicles(id) on delete set null;

create table public.vehicle_mods (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  name text not null,
  category text,                       -- exhaust, suspension, ecu…
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- BADGES
-- ============================================================
create table public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  category text,                       -- GOLD, NORD…
  description text,
  icon_url text,
  created_at timestamptz not null default now()
);

create table public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  achievement_value text,              -- "7:14.2 BTG Lap Record"
  earned_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

-- ============================================================
-- FOLLOWS
-- ============================================================
create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);

-- ============================================================
-- SHOTS (short-form videos)
-- ============================================================
create table public.shots (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  club_id uuid references public.clubs(id) on delete set null,
  caption text,
  hashtags text[] not null default '{}',
  video_url text not null,
  thumbnail_url text,
  audio_title text,
  audio_source audio_source not null default 'original',
  destination shot_destination not null default 'explore',
  category_tag text,                   -- STAGE 2+ DYNO
  -- Telemetry HUD
  speed_max int,
  boost_bar numeric(4,2),
  rpm_max int,
  zero_to_hundred numeric(4,1),
  dyno_whp int,
  exhaust_db numeric(5,1),
  ecu_map text,
  telemetry_enabled boolean not null default true,
  -- Counters (denormalized for feed speed)
  like_count int not null default 0,
  comment_count int not null default 0,
  bookmark_count int not null default 0,
  share_count int not null default 0,
  view_count int not null default 0,
  duration_ms int,
  is_draft boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shot_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  shot_id uuid not null references public.shots(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, shot_id)
);

create table public.shot_bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  shot_id uuid not null references public.shots(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, shot_id)
);

create table public.shot_comments (
  id uuid primary key default gen_random_uuid(),
  shot_id uuid not null references public.shots(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.shot_comments(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,                  -- like, follow, event, club…
  title text not null,
  body text,
  data jsonb not null default '{}',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_profiles_username on public.profiles (username);
create index idx_clubs_location on public.clubs (location);
create index idx_clubs_member_count on public.clubs (member_count desc);
create index idx_events_start on public.events (start_time);
create index idx_events_live on public.events (is_live) where is_live = true;
create index idx_vehicles_owner on public.vehicles (owner_id);
create index idx_shots_creator on public.shots (creator_id);
create index idx_shots_published on public.shots (published_at desc nulls last)
  where is_draft = false;
create index idx_shots_club on public.shots (club_id) where club_id is not null;
create index idx_shot_comments_shot on public.shot_comments (shot_id, created_at);
create index idx_notifications_user on public.notifications (user_id, is_read, created_at desc);
create index idx_follows_following on public.follows (following_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger clubs_updated_at
  before update on public.clubs
  for each row execute function public.set_updated_at();

create trigger vehicles_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

create trigger shots_updated_at
  before update on public.shots
  for each row execute function public.set_updated_at();

-- ============================================================
-- AUTH → PROFILE bootstrap
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
  n int := 0;
begin
  base_username := lower(coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), ''));
  base_username := regexp_replace(base_username, '[^a-z0-9_]', '', 'g');

  if base_username is null or length(base_username) < 3 then
    base_username := 'pilot_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  if length(base_username) > 30 then
    base_username := substr(base_username, 1, 30);
  end if;

  final_username := base_username;

  while exists (select 1 from public.profiles p where p.username = final_username) loop
    n := n + 1;
    final_username := substr(base_username, 1, greatest(3, 30 - length(n::text) - 1)) || '_' || n::text;
    if n > 50 then
      final_username := 'pilot_' || substr(replace(new.id::text, '-', ''), 1, 12);
      exit;
    end if;
  end loop;

  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    final_username,
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'avatar_url', '')), '')
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  return new;
exception when others then
  raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_username_available(u text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles p where p.username = lower(trim(u))
  );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

-- ============================================================
-- COUNTER HELPERS
-- ============================================================
create or replace function public.bump_shot_like_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.shots set like_count = like_count + 1 where id = new.shot_id;
    update public.profiles p
      set like_count = like_count + 1
      from public.shots s
     where s.id = new.shot_id and p.id = s.creator_id;
  elsif tg_op = 'DELETE' then
    update public.shots set like_count = greatest(like_count - 1, 0) where id = old.shot_id;
    update public.profiles p
      set like_count = greatest(like_count - 1, 0)
      from public.shots s
     where s.id = old.shot_id and p.id = s.creator_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger shot_likes_count
  after insert or delete on public.shot_likes
  for each row execute function public.bump_shot_like_count();

create or replace function public.bump_club_member_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.clubs set member_count = member_count + 1 where id = new.club_id;
  elsif tg_op = 'DELETE' then
    update public.clubs set member_count = greatest(member_count - 1, 0) where id = old.club_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger club_members_count
  after insert or delete on public.club_members
  for each row execute function public.bump_club_member_count();

create or replace function public.bump_follow_counts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    update public.profiles set follower_count = follower_count + 1 where id = new.following_id;
  elsif tg_op = 'DELETE' then
    update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
    update public.profiles set follower_count = greatest(follower_count - 1, 0) where id = old.following_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger follows_counts
  after insert or delete on public.follows
  for each row execute function public.bump_follow_counts();

create or replace function public.bump_event_participant_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'going' then
    update public.events set participant_count = participant_count + 1 where id = new.event_id;
  elsif tg_op = 'DELETE' and old.status = 'going' then
    update public.events set participant_count = greatest(participant_count - 1, 0) where id = old.event_id;
  elsif tg_op = 'UPDATE' then
    if old.status <> 'going' and new.status = 'going' then
      update public.events set participant_count = participant_count + 1 where id = new.event_id;
    elsif old.status = 'going' and new.status <> 'going' then
      update public.events set participant_count = greatest(participant_count - 1, 0) where id = new.event_id;
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger event_participants_count
  after insert or update or delete on public.event_participants
  for each row execute function public.bump_event_participant_count();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.tracks enable row level security;
alter table public.clubs enable row level security;
alter table public.club_categories enable row level security;
alter table public.club_members enable row level security;
alter table public.events enable row level security;
alter table public.event_participants enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_mods enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.follows enable row level security;
alter table public.shots enable row level security;
alter table public.shot_likes enable row level security;
alter table public.shot_bookmarks enable row level security;
alter table public.shot_comments enable row level security;
alter table public.notifications enable row level security;

-- Profiles
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- Categories & tracks (public read)
create policy "categories_select" on public.categories for select using (true);
create policy "tracks_select" on public.tracks for select using (true);

-- Clubs
create policy "clubs_select" on public.clubs for select using (true);
create policy "clubs_insert_auth" on public.clubs for insert with check (auth.uid() = created_by);
create policy "clubs_update_admin" on public.clubs for update using (
  exists (
    select 1 from public.club_members m
    where m.club_id = id and m.user_id = auth.uid() and m.role in ('admin', 'owner')
  )
);

create policy "club_categories_select" on public.club_categories for select using (true);
create policy "club_members_select" on public.club_members for select using (true);
create policy "club_members_insert_self" on public.club_members for insert with check (auth.uid() = user_id);
create policy "club_members_delete_self" on public.club_members for delete using (auth.uid() = user_id);

-- Events
create policy "events_select" on public.events for select using (true);
create policy "events_insert_auth" on public.events for insert with check (auth.uid() = created_by);
create policy "event_participants_select" on public.event_participants for select using (true);
create policy "event_participants_upsert_self" on public.event_participants for insert with check (auth.uid() = user_id);
create policy "event_participants_update_self" on public.event_participants for update using (auth.uid() = user_id);
create policy "event_participants_delete_self" on public.event_participants for delete using (auth.uid() = user_id);

-- Vehicles
create policy "vehicles_select" on public.vehicles for select using (true);
create policy "vehicles_insert_own" on public.vehicles for insert with check (auth.uid() = owner_id);
create policy "vehicles_update_own" on public.vehicles for update using (auth.uid() = owner_id);
create policy "vehicles_delete_own" on public.vehicles for delete using (auth.uid() = owner_id);

create policy "vehicle_mods_select" on public.vehicle_mods for select using (true);
create policy "vehicle_mods_manage" on public.vehicle_mods for all using (
  exists (select 1 from public.vehicles v where v.id = vehicle_id and v.owner_id = auth.uid())
);

-- Badges
create policy "badges_select" on public.badges for select using (true);
create policy "user_badges_select" on public.user_badges for select using (true);

-- Follows
create policy "follows_select" on public.follows for select using (true);
create policy "follows_insert_self" on public.follows for insert with check (auth.uid() = follower_id);
create policy "follows_delete_self" on public.follows for delete using (auth.uid() = follower_id);

-- Shots
create policy "shots_select_published" on public.shots for select using (
  is_draft = false or creator_id = auth.uid()
);
create policy "shots_insert_own" on public.shots for insert with check (auth.uid() = creator_id);
create policy "shots_update_own" on public.shots for update using (auth.uid() = creator_id);
create policy "shots_delete_own" on public.shots for delete using (auth.uid() = creator_id);

create policy "shot_likes_select" on public.shot_likes for select using (true);
create policy "shot_likes_insert" on public.shot_likes for insert with check (auth.uid() = user_id);
create policy "shot_likes_delete" on public.shot_likes for delete using (auth.uid() = user_id);

create policy "shot_bookmarks_select" on public.shot_bookmarks for select using (auth.uid() = user_id);
create policy "shot_bookmarks_insert" on public.shot_bookmarks for insert with check (auth.uid() = user_id);
create policy "shot_bookmarks_delete" on public.shot_bookmarks for delete using (auth.uid() = user_id);

create policy "shot_comments_select" on public.shot_comments for select using (true);
create policy "shot_comments_insert" on public.shot_comments for insert with check (auth.uid() = user_id);
create policy "shot_comments_delete" on public.shot_comments for delete using (auth.uid() = user_id);

-- Notifications
create policy "notifications_select_own" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications_update_own" on public.notifications for update using (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKETS (run after creating buckets in dashboard, or via API)
-- Suggested buckets: avatars, club-banners, vehicles, shots, shot-thumbs
-- ============================================================
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('club-banners', 'club-banners', true),
  ('vehicles', 'vehicles', true),
  ('shots', 'shots', true),
  ('shot-thumbs', 'shot-thumbs', true)
on conflict (id) do nothing;

create policy "public_read_media" on storage.objects
  for select using (bucket_id in ('avatars', 'club-banners', 'vehicles', 'shots', 'shot-thumbs'));

create policy "auth_upload_media" on storage.objects
  for insert with check (
    auth.role() = 'authenticated'
    and bucket_id in ('avatars', 'club-banners', 'vehicles', 'shots', 'shot-thumbs')
  );

create policy "owner_update_media" on storage.objects
  for update using (auth.uid()::text = (storage.foldername(name))[1]);

create policy "owner_delete_media" on storage.objects
  for delete using (auth.uid()::text = (storage.foldername(name))[1]);
