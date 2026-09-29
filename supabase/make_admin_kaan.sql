-- ============================================================
-- Kaan Pala → admin
-- Önce supabase/admin.sql dosyasının tamamını çalıştır,
-- sonra bunu çalıştır.
-- ============================================================

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

update public.profiles
set is_admin = true
where id = 'abeb77ca-9376-4cfc-a026-3663ab1487f9';

-- Kontrol:
select id, username, full_name, is_admin
from public.profiles
where id = 'abeb77ca-9376-4cfc-a026-3663ab1487f9';
