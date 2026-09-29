-- ============================================================
-- CARPM Auth patch
-- ÖNCE: supabase/schema.sql çalıştırılmış olmalı (profiles tablosu)
-- Bu dosya sadece auth/profil yamasıdır; tabloları oluşturmaz.
--
-- İlk kurulumda SADECE schema.sql yeterli (auth kodu içinde).
-- auth.sql'i yalnızca schema daha önce yüklendiyse tekrar çalıştır.
-- ============================================================

-- Güvenlik: profiles yoksa net hata ver
do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception
      'public.profiles yok. Önce supabase/schema.sql dosyasının TAMAMINI çalıştır, sonra bu auth.sql yamasını çalıştır.';
  end if;
end $$;

-- Daha sağlam profil bootstrap (username çakışması / metadata)
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

  -- Unique username garanti et
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
  -- Auth kaydını asla bozma; istemci ensureProfile ile tamamlar
  raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Username müsait mi? (anon + authenticated)
create or replace function public.is_username_available(u text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.profiles p
    where p.username = lower(trim(u))
  );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

-- Profil okuma/yazma politikalarını tazele (varsa drop + recreate)
drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;

create policy "profiles_select_all"
  on public.profiles for select
  using (true);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================================
-- Supabase Dashboard ayarları (SQL değil, manuel):
-- 1) Authentication → Providers → Email → Enable
-- 2) Geliştirme için "Confirm email" KAPAT (hemen giriş için)
-- 3) URL Configuration → Redirect URLs: carpm://**
-- ============================================================
