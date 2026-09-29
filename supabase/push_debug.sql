-- ============================================================
-- Push debug + daha sağlam gönderim
-- Önce push_notifications.sql çalışmış olmalı.
-- ============================================================

-- 1) Token var mı?
select id, user_id, left(token, 40) as token_prefix, platform, updated_at
from public.push_tokens
order by updated_at desc
limit 20;

-- 2) Trigger var mı?
select tgname, tgenabled
from pg_trigger
where tgname = 'notifications_dispatch_expo_push';

-- 3) pg_net var mı?
select extname, extversion from pg_extension where extname = 'pg_net';

-- 4) Son HTTP istekleri (pg_net)
select id, status_code, error_msg, created
from net._http_response
order by id desc
limit 10;

-- 5) Manuel test: kendi user_id'ni yaz, bildirim + push dener
-- insert into public.notifications (user_id, type, title, body, data)
-- values (
--   'abeb77ca-9376-4cfc-a026-3663ab1487f9',
--   'admin',
--   'Push test',
--   'Uygulama kapalıyken geldiyse OK',
--   '{"broadcast": true}'::jsonb
-- );
