-- ============================================================
-- Kulüp içi ayar: kaanpala07_ → tüm kulüplerde OWNER
-- Supabase SQL Editor’da çalıştır
-- ============================================================

do $$
declare
  v_uid uuid;
  v_club record;
  v_has_status boolean;
begin
  select id into v_uid
  from public.profiles
  where username in ('kaanpala07_', 'palababa')
  order by case when username = 'kaanpala07_' then 0 else 1 end
  limit 1;

  if v_uid is null then
    raise exception 'Kullanıcı bulunamadı (kaanpala07_ / palababa)';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'club_members'
      and column_name = 'status'
  ) into v_has_status;

  for v_club in select id from public.clubs
  loop
    if v_has_status then
      insert into public.club_members (club_id, user_id, role, status, joined_at)
      values (v_club.id, v_uid, 'owner', 'approved', now())
      on conflict (club_id, user_id) do update set
        role = 'owner',
        status = 'approved';
    else
      insert into public.club_members (club_id, user_id, role, joined_at)
      values (v_club.id, v_uid, 'owner', now())
      on conflict (club_id, user_id) do update set
        role = 'owner';
    end if;

    update public.clubs
    set
      created_by = v_uid,
      is_verified = true,
      updated_at = now()
    where id = v_club.id;
  end loop;

  if v_has_status then
    update public.clubs c
    set member_count = (
      select count(*)::int
      from public.club_members m
      where m.club_id = c.id
        and coalesce(m.status, 'approved') = 'approved'
    );
  else
    update public.clubs c
    set member_count = (
      select count(*)::int
      from public.club_members m
      where m.club_id = c.id
    );
  end if;

  raise notice 'OK — owner ayarlandı: %', v_uid;
end $$;

-- Kontrol
select
  c.name,
  c.slug,
  c.member_count,
  c.is_verified,
  p.username as owner_username,
  m.role
from public.clubs c
join public.club_members m on m.club_id = c.id and m.user_id = (
  select id from public.profiles
  where username in ('kaanpala07_', 'palababa')
  order by case when username = 'kaanpala07_' then 0 else 1 end
  limit 1
)
join public.profiles p on p.id = m.user_id
order by c.name;
