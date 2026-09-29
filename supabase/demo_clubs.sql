-- ============================================================
-- CARPM — Test için 3 tam donanımlı kulüp
-- Supabase SQL Editor’da çalıştır.
-- Owner: kaanpala07_ (yoksa palababa / ilk profil)
--
-- İçerik: kulüp + üye + etkinlik + forum post + yanıt + kategori
-- Temizlik: alttaki CLEANUP bloğu
-- ============================================================

do $$
declare
  v_owner uuid;
  v_other uuid;
  v_track uuid := 'b2222222-2222-4222-8222-222222222201'::uuid;
  v_has_status boolean;
  v_has_posts boolean;
  v_has_replies boolean;
  v_c1 uuid := 'c3333333-3333-4333-8333-333333333301'::uuid;
  v_c2 uuid := 'c3333333-3333-4333-8333-333333333302'::uuid;
  v_c3 uuid := 'c3333333-3333-4333-8333-333333333303'::uuid;
  v_e1 uuid := 'e4444444-4444-4444-8444-444444444401'::uuid;
  v_e2 uuid := 'e4444444-4444-4444-8444-444444444402'::uuid;
  v_e3 uuid := 'e4444444-4444-4444-8444-444444444403'::uuid;
  v_e4 uuid := 'e4444444-4444-4444-8444-444444444404'::uuid;
  v_p1 uuid := 'f5555555-5555-4555-8555-555555555501'::uuid;
  v_p2 uuid := 'f5555555-5555-4555-8555-555555555502'::uuid;
  v_p3 uuid := 'f5555555-5555-4555-8555-555555555503'::uuid;
  v_p4 uuid := 'f5555555-5555-4555-8555-555555555504'::uuid;
  v_p5 uuid := 'f5555555-5555-4555-8555-555555555505'::uuid;
  v_p6 uuid := 'f5555555-5555-4555-8555-555555555506'::uuid;
begin
  select id into v_owner
  from public.profiles
  where username in ('kaanpala07_', 'palababa')
  order by case when username = 'kaanpala07_' then 0 else 1 end
  limit 1;

  if v_owner is null then
    select id into v_owner from public.profiles order by created_at asc limit 1;
  end if;

  if v_owner is null then
    raise exception 'Hiç profil yok — önce uygulama ile kayıt ol.';
  end if;

  select id into v_other
  from public.profiles
  where id is distinct from v_owner
  order by created_at asc
  limit 1;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'club_members' and column_name = 'status'
  ) into v_has_status;

  select to_regclass('public.club_posts') is not null into v_has_posts;
  select to_regclass('public.club_post_replies') is not null into v_has_replies;

  -- ── Track ────────────────────────────────────────────────
  insert into public.tracks (id, name, location, length_km, route_label, map_image_url)
  values (
    v_track,
    'İstanbul Park',
    'Tuzla, İstanbul',
    5.338,
    'Grand Prix rotası',
    'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=1200'
  )
  on conflict (id) do update set
    name = excluded.name,
    location = excluded.location,
    map_image_url = excluded.map_image_url;

  -- ── 3 Kulüp ──────────────────────────────────────────────
  insert into public.clubs (
    id, name, slug, description, location,
    logo_url, banner_url, is_verified, member_count,
    tags, recent_activity, created_by
  ) values
  (
    v_c1,
    'Midnight Runners',
    'midnight-runners',
    'Gece konvoyu, tunnel pull ve street build. Cumartesi 00:00 Kadıköy toplanma.',
    'İstanbul',
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400',
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1400',
    true,
    2,
    array['nightrun', 'street', 'convoy'],
    'Yeni konvoy: Cumartesi 00:00',
    v_owner
  ),
  (
    v_c2,
    'Pist Canavarları',
    'pist-canavarlari',
    'İstanbul Park odaklı track day kulübü. Slick, time attack, BTG.',
    'Tuzla / İstanbul Park',
    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400',
    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1400',
    true,
    2,
    array['track', 'btg', 'timeattack'],
    'Track day kayıtları açıldı',
    v_owner
  ),
  (
    v_c3,
    'Dyno Lab TR',
    'dyno-lab-tr',
    'Dyno, map, E85 ve stage build paylaşımı. WHP konuşuruz, HP değil.',
    'Ankara / İstanbul',
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400',
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1400',
    true,
    2,
    array['dyno', 'ecu', 'stage2'],
    'Bu hafta: Stage 2+ E85 oturumu',
    v_owner
  )
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    location = excluded.location,
    logo_url = excluded.logo_url,
    banner_url = excluded.banner_url,
    is_verified = true,
    tags = excluded.tags,
    recent_activity = excluded.recent_activity,
    created_by = excluded.created_by,
    updated_at = now();

  -- slug conflict (eski kayıt) için de garanti
  update public.clubs set created_by = v_owner, is_verified = true
  where id in (v_c1, v_c2, v_c3);

  -- ── Üyelikler (owner + varsa 2. üye) ─────────────────────
  if v_has_status then
    insert into public.club_members (club_id, user_id, role, status, joined_at)
    values
      (v_c1, v_owner, 'owner', 'approved', now() - interval '30 days'),
      (v_c2, v_owner, 'owner', 'approved', now() - interval '20 days'),
      (v_c3, v_owner, 'owner', 'approved', now() - interval '10 days')
    on conflict (club_id, user_id) do update set role = 'owner', status = 'approved';

    if v_other is not null then
      insert into public.club_members (club_id, user_id, role, status, joined_at)
      values
        (v_c1, v_other, 'member', 'approved', now() - interval '5 days'),
        (v_c2, v_other, 'moderator', 'approved', now() - interval '4 days'),
        (v_c3, v_other, 'member', 'approved', now() - interval '2 days')
      on conflict (club_id, user_id) do update set status = 'approved';
    end if;
  else
    insert into public.club_members (club_id, user_id, role, joined_at)
    values
      (v_c1, v_owner, 'owner', now() - interval '30 days'),
      (v_c2, v_owner, 'owner', now() - interval '20 days'),
      (v_c3, v_owner, 'owner', now() - interval '10 days')
    on conflict (club_id, user_id) do update set role = 'owner';

    if v_other is not null then
      insert into public.club_members (club_id, user_id, role, joined_at)
      values
        (v_c1, v_other, 'member', now() - interval '5 days'),
        (v_c2, v_other, 'moderator', now() - interval '4 days'),
        (v_c3, v_other, 'member', now() - interval '2 days')
      on conflict (club_id, user_id) do nothing;
    end if;
  end if;

  -- ── Kategoriler ──────────────────────────────────────────
  insert into public.club_categories (club_id, category_id)
  select v_c1, id from public.categories where slug in ('night-run', 'all')
  on conflict do nothing;

  insert into public.club_categories (club_id, category_id)
  select v_c2, id from public.categories where slug in ('track', 'all')
  on conflict do nothing;

  insert into public.club_categories (club_id, category_id)
  select v_c3, id from public.categories where slug in ('jdm-drift', 'all')
  on conflict do nothing;

  -- ── Etkinlikler ──────────────────────────────────────────
  insert into public.events (
    id, club_id, track_id, title, subtitle, description,
    event_type, start_time, end_time, location_name, banner_url,
    is_live, is_featured, approved_vehicle_count, participant_count, created_by
  ) values
  (
    v_e1, v_c1, null,
    'Gece Konvoyu — Anadolu Yakası',
    'Kadıköy → Sahil → Tunnel',
    'Toplanma 00:00 Moda. Farlar açık, egzoz kontrol. Yağmurda iptal yok.',
    'convoy',
    now() + interval '2 days',
    now() + interval '2 days 3 hours',
    'Kadıköy Moda İskelesi',
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200',
    false, true, 18, 42, v_owner
  ),
  (
    v_e2, v_c2, v_track,
    'İstanbul Park Track Day',
    'Open pit · Time attack',
    'Kask zorunlu. Slick serbest. Briefing 08:30.',
    'track_day',
    now() + interval '9 days',
    now() + interval '9 days 8 hours',
    'İstanbul Park',
    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1200',
    false, true, 24, 56, v_owner
  ),
  (
    v_e3, v_c3, null,
    'Dyno Night — Stage 2+ E85',
    'Canlı WHP oturumu',
    'Map paylaşımı + back-to-back dyno. Rezervasyon DM.',
    'dyno',
    now() - interval '30 minutes',
    now() + interval '3 hours',
    'Dyno Lab — İstanbul',
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200',
    true, true, 8, 22, v_owner
  ),
  (
    v_e4, v_c1, null,
    'Sunday Cars & Coffee',
    'Kahve + build sohbeti',
    'Sabah 10:00. Foto çekimi serbest. Aile dostu.',
    'meetup',
    now() + interval '5 days',
    now() + interval '5 days 3 hours',
    'Caddebostan Sahil',
    'https://images.unsplash.com/photo-1542362567-b07e54358753?w=1200',
    false, false, 12, 28, v_owner
  )
  on conflict (id) do update set
    title = excluded.title,
    subtitle = excluded.subtitle,
    description = excluded.description,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    is_live = excluded.is_live,
    is_featured = excluded.is_featured,
    participant_count = excluded.participant_count,
    banner_url = excluded.banner_url,
    created_by = excluded.created_by;

  -- Etkinlik katılımı
  insert into public.event_participants (event_id, user_id, status)
  values
    (v_e1, v_owner, 'going'),
    (v_e2, v_owner, 'going'),
    (v_e3, v_owner, 'going'),
    (v_e4, v_owner, 'interested')
  on conflict (event_id, user_id) do update set status = excluded.status;

  if v_other is not null then
    insert into public.event_participants (event_id, user_id, status)
    values
      (v_e1, v_other, 'going'),
      (v_e2, v_other, 'interested'),
      (v_e3, v_other, 'going')
    on conflict (event_id, user_id) do nothing;
  end if;

  -- ── Forum postları ───────────────────────────────────────
  if v_has_posts then
    insert into public.club_posts (id, club_id, author_id, body, image_url, hashtags, like_count, created_at)
    values
    (
      v_p1, v_c1, v_owner,
      'Cumartesi konvoy rotası netleşti: Moda → Sahil → Tunnel. Yağmur lastiği olan yazsın 🔥',
      'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1000',
      array['nightrun', 'konvoy'],
      48,
      now() - interval '6 hours'
    ),
    (
      v_p2, v_c1, coalesce(v_other, v_owner),
      'Exhaust notası dün gece efsaneydi. Kimindi o V8?',
      null,
      array['exhaust'],
      22,
      now() - interval '3 hours'
    ),
    (
      v_p3, v_c2, v_owner,
      'Track day için briefing PDF’i yüklendi. Kask + yangın söndürücü kontrol listesi ekte mantığında düşünün.',
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1000',
      array['track', 'btg'],
      61,
      now() - interval '1 day'
    ),
    (
      v_p4, v_c2, coalesce(v_other, v_owner),
      'Slick mi yoksa cup 2 mi? Bu pist için tavsiye?',
      null,
      array['tyre'],
      15,
      now() - interval '10 hours'
    ),
    (
      v_p5, v_c3, v_owner,
      'Bugün Dyno Night CANLI. İlk araç 19:30’da bağlanıyor. WHP tahminlerinizi yazın 👀',
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1000',
      array['dyno', 'live'],
      94,
      now() - interval '45 minutes'
    ),
    (
      v_p6, v_c3, coalesce(v_other, v_owner),
      'E85 map’te AFR kaçta tutuyorsunuz? Biz 11.8 civarı geziyoruz.',
      null,
      array['e85', 'ecu'],
      33,
      now() - interval '2 hours'
    )
    on conflict (id) do update set
      body = excluded.body,
      image_url = excluded.image_url,
      hashtags = excluded.hashtags,
      like_count = excluded.like_count,
      updated_at = now();

    if v_has_replies then
      delete from public.club_post_replies
      where post_id in (v_p1, v_p2, v_p3, v_p4, v_p5, v_p6);

      insert into public.club_post_replies (post_id, club_id, author_id, body, created_at)
      values
        (v_p1, v_c1, coalesce(v_other, v_owner), 'Ben varım, yağmur lastiği hazır 👍', now() - interval '5 hours'),
        (v_p1, v_c1, v_owner, 'Süper — 23:45’te oradayız.', now() - interval '4 hours'),
        (v_p3, v_c2, coalesce(v_other, v_owner), 'BTG hedefim 1:52 bu sefer.', now() - interval '20 hours'),
        (v_p5, v_c3, coalesce(v_other, v_owner), 'Tahminim 480 WHP 🔥', now() - interval '30 minutes'),
        (v_p5, v_c3, v_owner, 'Göreceğiz, E85 dolu tank.', now() - interval '20 minutes'),
        (v_p6, v_c3, v_owner, '11.6–12.0 bandı güvenli bizim setup’ta.', now() - interval '90 minutes');

      update public.club_posts p
      set reply_count = (
        select count(*)::int from public.club_post_replies r where r.post_id = p.id
      )
      where p.id in (v_p1, v_p2, v_p3, v_p4, v_p5, v_p6);
    end if;
  end if;

  -- ── Üye sayacı düzelt ────────────────────────────────────
  if v_has_status then
    update public.clubs c
    set member_count = (
      select count(*)::int from public.club_members m
      where m.club_id = c.id and coalesce(m.status, 'approved') = 'approved'
    )
    where c.id in (v_c1, v_c2, v_c3);
  else
    update public.clubs c
    set member_count = (
      select count(*)::int from public.club_members m where m.club_id = c.id
    )
    where c.id in (v_c1, v_c2, v_c3);
  end if;

  -- Demo buzz sayıları (screenshot)
  update public.clubs
  set member_count = greatest(member_count, case id
    when v_c1 then 1840
    when v_c2 then 962
    when v_c3 then 1240
  end)
  where id in (v_c1, v_c2, v_c3);

  raise notice 'OK — 3 test kulübü hazır. Owner: %', v_owner;
end $$;

-- Kontrol
select id, name, slug, member_count, is_verified, recent_activity
from public.clubs
where id::text like 'c3333333-3333-4333-8333-%'
order by name;

select e.title, e.event_type, e.is_live, e.participant_count, c.name as club
from public.events e
join public.clubs c on c.id = e.club_id
where e.id::text like 'e4444444-4444-4444-8444-%'
order by e.start_time;

-- ============================================================
-- CLEANUP (test kulüplerini silmek için yorumu kaldır)
-- ============================================================
-- delete from public.events where id::text like 'e4444444-4444-4444-8444-%';
-- delete from public.club_post_replies where club_id::text like 'c3333333-3333-4333-8333-%';
-- delete from public.club_posts where club_id::text like 'c3333333-3333-4333-8333-%';
-- delete from public.club_members where club_id::text like 'c3333333-3333-4333-8333-%';
-- delete from public.club_categories where club_id::text like 'c3333333-3333-4333-8333-%';
-- delete from public.clubs where id::text like 'c3333333-3333-4333-8333-%';
-- delete from public.tracks where id = 'b2222222-2222-4222-8222-222222222201';
