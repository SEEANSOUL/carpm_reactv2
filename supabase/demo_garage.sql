-- ============================================================
-- CARPM — Test garajı (kaanpala07_)
-- Supabase SQL Editor’da çalıştır.
-- 4 araç + modlar + badge + arena skor + aktif canavar
-- Temizlik: alttaki CLEANUP
-- ============================================================

do $$
declare
  v_owner uuid;
  v1 uuid := 'a6666666-6666-4666-8666-666666666601'::uuid;
  v2 uuid := 'a6666666-6666-4666-8666-666666666602'::uuid;
  v3 uuid := 'a6666666-6666-4666-8666-666666666603'::uuid;
  v4 uuid := 'a6666666-6666-4666-8666-666666666604'::uuid;
  v_has_arena boolean;
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
    raise exception 'Profil yok — önce kayıt ol.';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vehicles' and column_name = 'arena_score'
  ) into v_has_arena;

  -- Diğer araçların aktifliğini kapat (tek aktif canavar)
  update public.vehicles
  set is_active = false
  where owner_id = v_owner
    and id not in (v1, v2, v3, v4);

  insert into public.vehicles (
    id, owner_id, make, model, year, body_type, engine_code, vehicle_type,
    hp, torque_nm, weight_kg, zero_to_hundred, image_url, garage_number,
    ecu_map, exhaust_db, last_dyno_at, is_active, badges
  ) values
  (
    v1, v_owner,
    'BMW', 'M4 Competition', 2022, 'Coupe', 'S58B30', 'car',
    510, 650, 1775, 3.9,
    'https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=1400',
    1, 'STG 2+ E85', 98.5, now() - interval '12 days',
    true,
    array['STAGE 2+', 'TRACK READY', 'E85']
  ),
  (
    v2, v_owner,
    'Nissan', 'GT-R', 2018, 'Coupe', 'VR38DETT', 'car',
    565, 633, 1752, 3.2,
    'https://images.unsplash.com/photo-1542362567-b07e54358753?w=1400',
    2, 'STG 1.5', 102.0, now() - interval '40 days',
    false,
    array['GODZILLA', 'AWD BEAST']
  ),
  (
    v3, v_owner,
    'Porsche', '911 GT3', 2021, 'Coupe', '9A2 Evo', 'car',
    510, 470, 1435, 3.4,
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1400',
    3, 'STOCK+', 96.0, now() - interval '5 days',
    false,
    array['TRACK WEAPON', 'NA SOUND']
  ),
  (
    v4, v_owner,
    'Yamaha', 'MT-09 SP', 2023, 'Naked', 'CP3', 'motorcycle',
    119, 93, 189, 3.1,
    'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1400',
    4, 'FLASH', null, null,
    false,
    array['STREET FIGHTER', 'WHEELIE READY']
  )
  on conflict (id) do update set
    owner_id = excluded.owner_id,
    make = excluded.make,
    model = excluded.model,
    year = excluded.year,
    body_type = excluded.body_type,
    engine_code = excluded.engine_code,
    vehicle_type = excluded.vehicle_type,
    hp = excluded.hp,
    torque_nm = excluded.torque_nm,
    weight_kg = excluded.weight_kg,
    zero_to_hundred = excluded.zero_to_hundred,
    image_url = excluded.image_url,
    garage_number = excluded.garage_number,
    ecu_map = excluded.ecu_map,
    exhaust_db = excluded.exhaust_db,
    last_dyno_at = excluded.last_dyno_at,
    is_active = excluded.is_active,
    badges = excluded.badges,
    updated_at = now();

  if v_has_arena then
    update public.vehicles set
      arena_score = case id
        when v1 then 286
        when v2 then 412
        when v3 then 198
        when v4 then 94
      end,
      arena_likes = case id
        when v1 then 520
        when v2 then 780
        when v3 then 340
        when v4 then 160
      end,
      arena_passes = case id
        when v1 then 48
        when v2 then 62
        when v3 then 35
        when v4 then 22
      end
    where id in (v1, v2, v3, v4);
  end if;

  -- Modlar (tekrar çalıştırılabilir)
  delete from public.vehicle_mods where vehicle_id in (v1, v2, v3, v4);

  insert into public.vehicle_mods (vehicle_id, name, category, sort_order) values
    (v1, 'Downpipe + catless', 'exhaust', 1),
    (v1, 'Intercooler FMIC', 'cooling', 2),
    (v1, 'E85 flex fuel kit', 'fuel', 3),
    (v1, 'Coilovers KW V3', 'suspension', 4),
    (v1, 'Brake pads + lines', 'brakes', 5),
    (v2, 'Ecutek map', 'ecu', 1),
    (v2, 'Full titanium exhaust', 'exhaust', 2),
    (v2, 'HKS BOV', 'boost', 3),
    (v2, 'Oil cooler', 'cooling', 4),
    (v3, 'Cup 2 R tires', 'tyres', 1),
    (v3, 'Carbon wing', 'aero', 2),
    (v3, 'Pad upgrade', 'brakes', 3),
    (v4, 'Akrapovic slip-on', 'exhaust', 1),
    (v4, 'ECU flash', 'ecu', 2),
    (v4, 'Rearsets', 'chassis', 3);

  -- Profil sayaçları
  update public.profiles p
  set
    vehicle_count = (select count(*)::int from public.vehicles v where v.owner_id = p.id),
    title = coalesce(nullif(title, ''), 'PRO TRACK DRIVER'),
    is_verified = true,
    bio = coalesce(nullif(bio, ''), 'İstanbul • M4 / GT-R / GT3 • CaRPM Arena 🏁'),
    updated_at = now()
  where id = v_owner;

  -- Opsiyonel: user badge (badges tablosu doluysa)
  if to_regclass('public.badges') is not null then
    insert into public.badges (slug, title, category, description)
    values
      ('gold-builder', 'GOLD BUILDER', 'GOLD', 'Stage 2+ build tamamladı'),
      ('track-ace', 'TRACK ACE', 'NORD', 'Pist günü tamamladı'),
      ('dyno-hunter', 'DYNO HUNTER', 'GOLD', 'Dyno oturumu yaptı')
    on conflict (slug) do nothing;

    insert into public.user_badges (user_id, badge_id, achievement_value)
    select v_owner, b.id, case b.slug
      when 'gold-builder' then 'STG 2+ E85 · 510 HP'
      when 'track-ace' then 'İstanbul Park · warm-up'
      when 'dyno-hunter' then '487 WHP peak'
    end
    from public.badges b
    where b.slug in ('gold-builder', 'track-ace', 'dyno-hunter')
    on conflict (user_id, badge_id) do update set
      achievement_value = excluded.achievement_value;

    update public.profiles
    set badge_count = (
      select count(*)::int from public.user_badges ub where ub.user_id = v_owner
    )
    where id = v_owner;
  end if;

  raise notice 'OK — garaj hazır. Owner: %', v_owner;
end $$;

-- Kontrol
select
  garage_number,
  make || ' ' || model as car,
  year,
  hp,
  ecu_map,
  is_active,
  badges
from public.vehicles
where id::text like 'a6666666-6666-4666-8666-%'
order by garage_number;

select v.make, m.name as mod, m.category
from public.vehicle_mods m
join public.vehicles v on v.id = m.vehicle_id
where v.id::text like 'a6666666-6666-4666-8666-%'
order by v.garage_number, m.sort_order;

-- ============================================================
-- CLEANUP
-- ============================================================
-- delete from public.vehicle_mods where vehicle_id::text like 'a6666666-6666-4666-8666-%';
-- delete from public.vehicles where id::text like 'a6666666-6666-4666-8666-%';
-- -- badge’leri de silmek istersen:
-- -- delete from public.user_badges where badge_id in (
-- --   select id from public.badges where slug in ('gold-builder','track-ace','dyno-hunter')
-- -- );
