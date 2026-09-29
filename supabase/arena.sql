-- ============================================================
-- CaRPM Arena — araç oylama (Tinder swipe)
-- Supabase SQL Editor'da çalıştır.
-- ============================================================

alter table public.vehicles
  add column if not exists arena_score int not null default 0;

alter table public.vehicles
  add column if not exists arena_likes int not null default 0;

alter table public.vehicles
  add column if not exists arena_passes int not null default 0;

create table if not exists public.vehicle_votes (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  unique (voter_id, vehicle_id)
);

create index if not exists idx_vehicle_votes_voter
  on public.vehicle_votes (voter_id, created_at desc);

create index if not exists idx_vehicle_votes_vehicle
  on public.vehicle_votes (vehicle_id);

create index if not exists idx_vehicles_arena_score
  on public.vehicles (arena_score desc);

alter table public.vehicle_votes enable row level security;

drop policy if exists "vehicle_votes_select_own" on public.vehicle_votes;
create policy "vehicle_votes_select_own" on public.vehicle_votes
  for select using (auth.uid() = voter_id);

-- Insert yalnızca RPC üzerinden (batch)
revoke insert, update, delete on public.vehicle_votes from authenticated, anon;

-- ─── Deck: henüz oylanmamış başkalarının araçları ───────────
create or replace function public.arena_fetch_deck(
  p_limit int default 10,
  p_exclude uuid[] default '{}'
)
returns setof public.vehicles
language sql
stable
security definer
set search_path = public
as $$
  select v.*
  from public.vehicles v
  where v.owner_id is distinct from auth.uid()
    and v.image_url is not null
    and length(trim(v.image_url)) > 0
    and not (v.id = any (coalesce(p_exclude, '{}'::uuid[])))
    and not exists (
      select 1
      from public.vehicle_votes vv
      where vv.voter_id = auth.uid()
        and vv.vehicle_id = v.id
    )
  order by v.arena_score desc, v.created_at desc
  limit greatest(1, least(coalesce(p_limit, 10), 30));
$$;

revoke all on function public.arena_fetch_deck(int, uuid[]) from public;
grant execute on function public.arena_fetch_deck(int, uuid[]) to authenticated;

-- ─── Batch oy gönderimi ─────────────────────────────────────
create or replace function public.arena_batch_votes(p_votes jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_vid uuid;
  v_vote int;
  v_count int := 0;
  v_rows int;
begin
  if auth.uid() is null then
    raise exception 'Yetkisiz';
  end if;

  if p_votes is null or jsonb_typeof(p_votes) <> 'array' then
    raise exception 'p_votes dizi olmalı';
  end if;

  for v_item in select value from jsonb_array_elements(p_votes)
  loop
    begin
      v_vid := (v_item->>'vehicle_id')::uuid;
      v_vote := (v_item->>'vote')::int;
    exception when others then
      continue;
    end;

    if v_vid is null or v_vote not in (-1, 1) then
      continue;
    end if;

    -- kendi aracını oylama
    if exists (
      select 1 from public.vehicles v
      where v.id = v_vid and v.owner_id = auth.uid()
    ) then
      continue;
    end if;

    insert into public.vehicle_votes (voter_id, vehicle_id, vote)
    values (auth.uid(), v_vid, v_vote)
    on conflict (voter_id, vehicle_id) do nothing;

    get diagnostics v_rows = row_count;
    if v_rows > 0 then
      if v_vote = 1 then
        update public.vehicles
        set
          arena_likes = arena_likes + 1,
          arena_score = arena_score + 1
        where id = v_vid;
      else
        update public.vehicles
        set
          arena_passes = arena_passes + 1,
          arena_score = arena_score - 1
        where id = v_vid;
      end if;
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.arena_batch_votes(jsonb) from public;
grant execute on function public.arena_batch_votes(jsonb) to authenticated;

-- ─── Sıralama: arena_score liderlik tablosu ──────────────────
create or replace function public.arena_leaderboard(p_limit int default 50)
returns setof public.vehicles
language sql
stable
security definer
set search_path = public
as $$
  select v.*
  from public.vehicles v
  where v.image_url is not null
    and length(trim(v.image_url)) > 0
    and (v.arena_likes + v.arena_passes) > 0
  order by v.arena_score desc, v.arena_likes desc, v.created_at asc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

revoke all on function public.arena_leaderboard(int) from public;
grant execute on function public.arena_leaderboard(int) to authenticated;
