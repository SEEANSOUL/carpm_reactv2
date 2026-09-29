-- ============================================================
-- Username: palababa → kaanpala07_
-- Supabase SQL Editor’da çalıştır
-- ============================================================

-- Hedef boş mu?
select id, username
from public.profiles
where username in ('palababa', 'kaanpala07_');

-- Değiştir
update public.profiles
set
  username = 'kaanpala07_',
  updated_at = now()
where username = 'palababa';

-- Kontrol
select id, username, full_name
from public.profiles
where username = 'kaanpala07_';
