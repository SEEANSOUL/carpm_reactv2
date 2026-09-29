-- ============================================================
-- CARPM — Demo / screenshot “buzz” verisi (GEÇİCİ)
-- Supabase SQL Editor’da çalıştır.
--
-- Ne yapar?
--  • Mevcut shot’lara 2K–12K beğeni, yüzlerce yorum sayısı basar
--  • Her shot’a gerçek görünen Türkçe örnek yorumlar ekler
--  • Profil / araç / kulüp sayaçlarını şişirir
--  • Az shot varsa Unsplash’li demo shot’lar oluşturur
--
-- Temizlemek için: dosyanın sonundaki CLEANUP bloğunu çalıştır.
-- ============================================================

-- ─── 1) Mevcut shot sayaçlarını şişir ───────────────────────
with ranked as (
  select
    id,
    row_number() over (order by coalesce(published_at, created_at) desc) as rn
  from public.shots
  where is_draft = false
)
update public.shots s
set
  like_count = case (r.rn % 7)
    when 0 then 12480
    when 1 then 8620
    when 2 then 5340
    when 3 then 4210
    when 4 then 3890
    when 5 then 2750
    else 1980
  end,
  comment_count = case (r.rn % 7)
    when 0 then 642
    when 1 then 418
    when 2 then 286
    when 3 then 194
    when 4 then 156
    when 5 then 98
    else 72
  end,
  bookmark_count = case (r.rn % 5)
    when 0 then 1840
    when 1 then 920
    when 2 then 640
    when 3 then 410
    else 280
  end,
  share_count = case (r.rn % 4)
    when 0 then 980
    when 1 then 520
    when 2 then 310
    else 180
  end,
  view_count = case (r.rn % 6)
    when 0 then 284000
    when 1 then 156000
    when 2 then 98000
    when 3 then 64000
    when 4 then 42000
    else 28000
  end
from ranked r
where s.id = r.id;

-- ─── 2) Örnek yorumlar (yorum ekranı dolu görünsün) ─────────
-- Önce eski demo yorumları temizle (tekrar çalıştırılabilir)
delete from public.shot_comments
where body like '[DEMO] %';

insert into public.shot_comments (shot_id, user_id, body, created_at)
select
  s.id,
  p.id,
  '[DEMO] ' || c.body,
  now() - (c.mins || ' minutes')::interval
from public.shots s
cross join lateral (
  select id
  from public.profiles
  where id is distinct from s.creator_id
  order by random()
  limit 1
) p
cross join lateral (
  values
    (1,  'Bu ses efsane 🔥 motor nasıl map?'),
    (3,  'Stage kaç bu canavar?'),
    (7,  '0-100 iddiası gerçek mi lan'),
    (12, 'İstanbul Park’ta görsem bayılırım'),
    (18, 'Downpipe + pop & bang mi?'),
    (25, 'WHP kaç çıkmış dyno’da?'),
    (40, 'Garaja yaz bunu abim'),
    (55, 'Konvoyda bu araba önde gider'),
    (80, 'Exhaust notası 100/100'),
    (120,'CaRPM Arena’da 1. olur bu')
) as c(mins, body)
where s.is_draft = false
  and exists (select 1 from public.profiles x where x.id is distinct from s.creator_id)
limit 200;

-- Sayaçları yorum trigger’ı bozmasın diye tekrar sabitle
with ranked as (
  select
    id,
    row_number() over (order by coalesce(published_at, created_at) desc) as rn
  from public.shots
  where is_draft = false
)
update public.shots s
set
  comment_count = case (r.rn % 7)
    when 0 then 642
    when 1 then 418
    when 2 then 286
    when 3 then 194
    when 4 then 156
    when 5 then 98
    else 72
  end
from ranked r
where s.id = r.id;

-- ─── 3) Profil “ün”ü ────────────────────────────────────────
update public.profiles p
set
  follower_count = greatest(coalesce(follower_count, 0), 1200 + (abs(hashtext(p.id::text)) % 48000)),
  following_count = greatest(coalesce(following_count, 0), 80 + (abs(hashtext(p.username)) % 400)),
  like_count = greatest(coalesce(like_count, 0), 8000 + (abs(hashtext(p.id::text)) % 120000)),
  is_verified = coalesce(is_verified, false) or (abs(hashtext(p.username)) % 3 = 0),
  is_pro = coalesce(is_pro, false) or (abs(hashtext(p.username)) % 4 = 0),
  title = coalesce(nullif(title, ''), case (abs(hashtext(p.username)) % 5)
    when 0 then 'PRO TRACK DRIVER'
    when 1 then 'STREET LEGEND'
    when 2 then 'DYNO HUNTER'
    when 3 then 'NIGHT RUNNER'
    else 'BUILDER'
  end),
  bio = coalesce(
    nullif(bio, ''),
    'İstanbul • tunnel pull • CaRPM Arena regular 🏁'
  );

-- ─── 4) Araç arena skorları (arena.sql çalıştıysa) ──────────
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vehicles' and column_name = 'arena_score'
  ) then
    update public.vehicles v
    set
      arena_score = greatest(coalesce(arena_score, 0), 40 + (abs(hashtext(v.id::text)) % 420)),
      arena_likes = greatest(coalesce(arena_likes, 0), 80 + (abs(hashtext(v.id::text)) % 900)),
      arena_passes = greatest(coalesce(arena_passes, 0), 10 + (abs(hashtext(v.model)) % 120)),
      badges = case
        when coalesce(array_length(badges, 1), 0) > 0 then badges
        else array['STAGE 2', 'TRACK READY', 'STREET LEGAL']
      end;
  else
    update public.vehicles
    set badges = case
      when coalesce(array_length(badges, 1), 0) > 0 then badges
      else array['STAGE 2', 'TRACK READY', 'STREET LEGAL']
    end;
  end if;
end $$;

-- ─── 5) Kulüp üye sayıları ──────────────────────────────────
update public.clubs c
set member_count = greatest(coalesce(member_count, 0), 450 + (abs(hashtext(c.slug)) % 12000))
where true;

-- ─── 6) Az shot varsa ekstra demo shot’lar (Unsplash) ───────
-- Sabit UUID → tekrar çalıştırınca duplicate olmaz
insert into public.shots (
  id, creator_id, vehicle_id, caption, hashtags,
  video_url, thumbnail_url,
  like_count, comment_count, bookmark_count, share_count, view_count,
  speed_max, boost_bar, rpm_max, dyno_whp, zero_to_hundred, ecu_map,
  telemetry_enabled, is_draft, published_at, category_tag
)
select
  d.id,
  p.id,
  v.id,
  d.caption,
  d.hashtags,
  d.media_url,
  d.media_url,
  d.likes,
  d.comments,
  d.bookmarks,
  d.shares,
  d.views,
  d.speed,
  d.boost,
  d.rpm,
  d.whp,
  d.zth,
  d.ecu,
  true,
  false,
  now() - (d.hours || ' hours')::interval,
  d.tag
from (
  values
    (
      'a1111111-1111-4111-8111-111111111101'::uuid,
      'Gece yağmur + downpipe 🔥 #nightrun',
      array['nightrun','exhaust','istanbul'],
      'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1080',
      8620, 418, 920, 520, 156000,
      248, 1.4::numeric, 7200, 412, 4.2::numeric, 'STG 2+',
      2, 'NIGHT RUN'
    ),
    (
      'a1111111-1111-4111-8111-111111111102'::uuid,
      'Dyno günü — +87 WHP 💪',
      array['dyno','stage2','whp'],
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1080',
      12480, 642, 1840, 980, 284000,
      272, 1.8::numeric, 7800, 487, 3.9::numeric, 'STG 2+ E85',
      5, 'STAGE 2+ DYNO'
    ),
    (
      'a1111111-1111-4111-8111-111111111103'::uuid,
      'İstanbul Park warm-up laps',
      array['track','istanbulpark','btg'],
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1080',
      5340, 286, 640, 310, 98000,
      210, 1.1::numeric, 6900, 356, 4.8::numeric, 'STG 1',
      8, 'TRACK'
    ),
    (
      'a1111111-1111-4111-8111-111111111104'::uuid,
      'Tunnel pull — ses ayarı net',
      array['tunnel','pull','boost'],
      'https://images.unsplash.com/photo-1542362567-b07e54358753?w=1080',
      4210, 194, 410, 180, 64000,
      235, 1.6::numeric, 7400, null, 4.4::numeric, 'STG 2',
      12, 'STREET'
    ),
    (
      'a1111111-1111-4111-8111-111111111105'::uuid,
      'Arena’ya girdik, ateş yağmuru 🔥',
      array['arena','carpm','vote'],
      'https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=1080',
      3890, 156, 280, 210, 42000,
      null, null, null, null, null, null,
      18, 'ARENA'
    ),
    (
      'a1111111-1111-4111-8111-111111111106'::uuid,
      'Sabah cold start ASMR',
      array['coldstart','exhaust','asmr'],
      'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=1080',
      2750, 98, 360, 140, 38000,
      null, null, 6500, null, null, 'STOCK+',
      26, 'SOUND'
    )
) as d(
  id, caption, hashtags, media_url,
  likes, comments, bookmarks, shares, views,
  speed, boost, rpm, whp, zth, ecu,
  hours, tag
)
cross join lateral (
  select id from public.profiles order by created_at asc limit 1
) p
left join lateral (
  select id from public.vehicles where owner_id = p.id order by is_active desc nulls last limit 1
) v on true
on conflict (id) do update set
  like_count = excluded.like_count,
  comment_count = excluded.comment_count,
  bookmark_count = excluded.bookmark_count,
  share_count = excluded.share_count,
  view_count = excluded.view_count,
  caption = excluded.caption,
  video_url = excluded.video_url,
  thumbnail_url = excluded.thumbnail_url,
  published_at = excluded.published_at,
  is_draft = false;

-- Demo shot’lara da yorum bas
insert into public.shot_comments (shot_id, user_id, body, created_at)
select
  s.id,
  coalesce(
    (select id from public.profiles where id is distinct from s.creator_id order by random() limit 1),
    s.creator_id
  ),
  '[DEMO] ' || c.body,
  now() - (c.mins || ' minutes')::interval
from public.shots s
cross join lateral (
  values
    (2,  'Bu build efsane olmuş 🔥'),
    (9,  'WHP / TQ paylaşır mısın?'),
    (16, 'Arena skoru kaç şimdi?'),
    (28, 'Exhaust markası ne?'),
    (45, 'Konvoya alın bunu'),
    (70, 'Screenshot’a layık kare')
) as c(mins, body)
where s.id::text like 'a1111111-1111-4111-8111-%';

-- Demo shot yorum sayaçlarını tekrar sabitle
update public.shots
set comment_count = case id::text
  when 'a1111111-1111-4111-8111-111111111101' then 418
  when 'a1111111-1111-4111-8111-111111111102' then 642
  when 'a1111111-1111-4111-8111-111111111103' then 286
  when 'a1111111-1111-4111-8111-111111111104' then 194
  when 'a1111111-1111-4111-8111-111111111105' then 156
  when 'a1111111-1111-4111-8111-111111111106' then 98
  else comment_count
end
where id::text like 'a1111111-1111-4111-8111-%';

-- ─── Özet ───────────────────────────────────────────────────
select
  (select count(*) from public.shots where is_draft = false) as shots,
  (select coalesce(max(like_count), 0) from public.shots) as max_likes,
  (select coalesce(max(comment_count), 0) from public.shots) as max_comments,
  (select count(*) from public.shot_comments where body like '[DEMO] %') as demo_comments;

-- ============================================================
-- CLEANUP (demo’yu silmek için aşağıyı ayrı çalıştır)
-- ============================================================
-- delete from public.shot_comments where body like '[DEMO] %';
-- delete from public.shots where id::text like 'a1111111-1111-4111-8111-%';
-- -- Sayaçları elle eski haline getirmek istersen shot’ları app’ten yeniden yayınla
-- -- veya like_count/comment_count’u 0’a çek:
-- -- update public.shots set like_count = 0, comment_count = 0,
-- --   bookmark_count = 0, share_count = 0, view_count = 0;
