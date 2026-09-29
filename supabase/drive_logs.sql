-- ============================================================
-- CaRPM sürüş takibi
-- Supabase SQL Editor'da çalıştır.
-- Sürüş sırasında yazma yok; kayıt tek insert.
-- Okuma yalnızca kaydın sahibi.
-- ============================================================

create table if not exists public.drive_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  total_distance_km double precision not null default 0,
  max_speed_kmh double precision not null default 0,
  average_speed_kmh double precision not null default 0,
  duration_seconds int not null default 0,
  route jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint drive_logs_route_is_array check (jsonb_typeof(route) = 'array'),
  constraint drive_logs_distance_nonneg check (total_distance_km >= 0),
  constraint drive_logs_max_speed_nonneg check (max_speed_kmh >= 0),
  constraint drive_logs_avg_speed_nonneg check (average_speed_kmh >= 0),
  constraint drive_logs_duration_nonneg check (duration_seconds >= 0)
);

create index if not exists idx_drive_logs_user_ended
  on public.drive_logs (user_id, ended_at desc);

alter table public.drive_logs enable row level security;

drop policy if exists "drive_logs_select_own" on public.drive_logs;
create policy "drive_logs_select_own" on public.drive_logs
  for select using (auth.uid() = user_id);

drop policy if exists "drive_logs_insert_own" on public.drive_logs;
create policy "drive_logs_insert_own" on public.drive_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists "drive_logs_delete_own" on public.drive_logs;
create policy "drive_logs_delete_own" on public.drive_logs
  for delete using (auth.uid() = user_id);
