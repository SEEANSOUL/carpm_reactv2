-- ============================================================
-- Bildirimler: beğeni, takip, kulüp katılımı
-- Supabase SQL Editor'da çalıştır.
-- ============================================================

-- Actor profilini okuyabilmek için (trigger SECURITY DEFINER)
create or replace function public.actor_label(p_actor uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim(p.full_name), ''),
    nullif(trim(p.username), ''),
    'Bir pilot'
  )
  from public.profiles p
  where p.id = p_actor;
$$;

-- ─── Shot beğenisi ─────────────────────────────────────────
create or replace function public.notify_shot_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator uuid;
  v_label text;
begin
  select s.creator_id into v_creator
  from public.shots s
  where s.id = new.shot_id;

  if v_creator is null or v_creator = new.user_id then
    return new;
  end if;

  v_label := public.actor_label(new.user_id);

  insert into public.notifications (user_id, actor_id, type, title, body, data)
  values (
    v_creator,
    new.user_id,
    'like',
    'Yeni beğeni',
    v_label || ' shot''unu beğendi.',
    jsonb_build_object('shot_id', new.shot_id)
  );

  return new;
end;
$$;

drop trigger if exists shot_likes_notify on public.shot_likes;
create trigger shot_likes_notify
  after insert on public.shot_likes
  for each row execute function public.notify_shot_like();

-- ─── Takip ─────────────────────────────────────────────────
create or replace function public.notify_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  if new.following_id = new.follower_id then
    return new;
  end if;

  v_label := public.actor_label(new.follower_id);

  insert into public.notifications (user_id, actor_id, type, title, body, data)
  values (
    new.following_id,
    new.follower_id,
    'follow',
    'Yeni takipçi',
    v_label || ' seni takip etmeye başladı.',
    jsonb_build_object('actor_id', new.follower_id)
  );

  return new;
end;
$$;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify
  after insert on public.follows
  for each row execute function public.notify_follow();

-- ─── Kulüp / forum katılımı ────────────────────────────────
create or replace function public.notify_club_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_club_name text;
  v_label text;
begin
  -- Sadece üye katılımı (owner oluştururken bildirim atma)
  if coalesce(new.role, 'member') = 'owner' then
    return new;
  end if;

  select c.created_by, c.name into v_owner, v_club_name
  from public.clubs c
  where c.id = new.club_id;

  if v_owner is null or v_owner = new.user_id then
    return new;
  end if;

  v_label := public.actor_label(new.user_id);

  insert into public.notifications (user_id, actor_id, type, title, body, data)
  values (
    v_owner,
    new.user_id,
    'club_join',
    'Yeni üye',
    v_label || ' "' || coalesce(v_club_name, 'kulüp') || '" kulübüne katıldı.',
    jsonb_build_object('club_id', new.club_id)
  );

  return new;
end;
$$;

drop trigger if exists club_members_notify on public.club_members;
create trigger club_members_notify
  after insert on public.club_members
  for each row execute function public.notify_club_join();
