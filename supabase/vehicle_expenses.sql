-- Garaj arabasının yakıt masrafı.
-- drive_logs.sql çalıştıktan sonra Supabase SQL Editor'da bir kez çalıştır.

alter table public.vehicles
  add column if not exists fuel_l_per_100km numeric(5,2),
  add column if not exists fuel_price_try numeric(8,2);

alter table public.drive_logs
  add column if not exists vehicle_id uuid references public.vehicles(id) on delete set null,
  add column if not exists vehicle_label text,
  add column if not exists vehicle_image_url text,
  add column if not exists fuel_liters numeric(8,3),
  add column if not exists fuel_cost_try numeric(10,2),
  add column if not exists fuel_l_per_100km numeric(5,2);

create table if not exists public.vehicle_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  drive_log_id uuid references public.drive_logs(id) on delete set null,
  kind text not null default 'yakit',
  title text not null,
  amount_try numeric(10,2) not null default 0,
  liters numeric(8,3),
  distance_km numeric(8,3),
  note text,
  spent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint vehicle_expenses_amount_nonneg check (amount_try >= 0)
);

create index if not exists idx_vehicle_expenses_vehicle
  on public.vehicle_expenses (vehicle_id, spent_at desc);

alter table public.vehicle_expenses enable row level security;

drop policy if exists "vehicle_expenses_select_own" on public.vehicle_expenses;
create policy "vehicle_expenses_select_own" on public.vehicle_expenses
  for select using (auth.uid() = user_id);

drop policy if exists "vehicle_expenses_insert_own" on public.vehicle_expenses;
create policy "vehicle_expenses_insert_own" on public.vehicle_expenses
  for insert with check (auth.uid() = user_id);

drop policy if exists "vehicle_expenses_delete_own" on public.vehicle_expenses;
create policy "vehicle_expenses_delete_own" on public.vehicle_expenses
  for delete using (auth.uid() = user_id);
