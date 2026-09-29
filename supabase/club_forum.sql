-- ============================================================
-- CARPM Club Forum — üyelere özel gönderiler
-- Supabase SQL Editor'de çalıştır
-- ============================================================

-- Üyelik kontrolü (RLS için)
create or replace function public.is_club_member(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_members m
    where m.club_id = p_club_id
      and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_club_member(uuid) from public;
grant execute on function public.is_club_member(uuid) to authenticated;

-- Forum gönderileri (sadece kulüp üyeleri)
create table if not exists public.club_posts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  image_url text,
  hashtags text[] not null default '{}',
  like_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint club_posts_body_len check (char_length(body) between 1 and 4000)
);

create index if not exists idx_club_posts_club_created
  on public.club_posts (club_id, created_at desc);

create index if not exists idx_club_posts_hashtags
  on public.club_posts using gin (hashtags);

create table if not exists public.club_post_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.club_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

drop trigger if exists club_posts_updated_at on public.club_posts;
create trigger club_posts_updated_at
  before update on public.club_posts
  for each row execute function public.set_updated_at();

-- Beğeni sayacı
create or replace function public.bump_club_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.club_posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.club_posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists club_post_likes_count on public.club_post_likes;
create trigger club_post_likes_count
  after insert or delete on public.club_post_likes
  for each row execute function public.bump_club_post_like_count();

-- RLS
alter table public.club_posts enable row level security;
alter table public.club_post_likes enable row level security;

drop policy if exists "club_posts_select_member" on public.club_posts;
drop policy if exists "club_posts_insert_member" on public.club_posts;
drop policy if exists "club_posts_update_own" on public.club_posts;
drop policy if exists "club_posts_delete_own" on public.club_posts;
drop policy if exists "club_post_likes_select_member" on public.club_post_likes;
drop policy if exists "club_post_likes_insert_member" on public.club_post_likes;
drop policy if exists "club_post_likes_delete_own" on public.club_post_likes;

create policy "club_posts_select_member" on public.club_posts
  for select using (public.is_club_member(club_id));

create policy "club_posts_insert_member" on public.club_posts
  for insert with check (
    auth.uid() = author_id
    and public.is_club_member(club_id)
  );

create policy "club_posts_update_own" on public.club_posts
  for update using (
    auth.uid() = author_id
    and public.is_club_member(club_id)
  );

create policy "club_posts_delete_own" on public.club_posts
  for delete using (
    auth.uid() = author_id
    or exists (
      select 1 from public.club_members m
      where m.club_id = club_posts.club_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin', 'moderator')
    )
  );

create policy "club_post_likes_select_member" on public.club_post_likes
  for select using (
    exists (
      select 1 from public.club_posts p
      where p.id = post_id and public.is_club_member(p.club_id)
    )
  );

create policy "club_post_likes_insert_member" on public.club_post_likes
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.club_posts p
      where p.id = post_id and public.is_club_member(p.club_id)
    )
  );

create policy "club_post_likes_delete_own" on public.club_post_likes
  for delete using (auth.uid() = user_id);

-- Storage bucket: club-forum
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('club-forum', 'club-forum', true, 8388608, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "club_forum_public_read" on storage.objects;
drop policy if exists "club_forum_auth_upload" on storage.objects;
drop policy if exists "club_forum_owner_update" on storage.objects;
drop policy if exists "club_forum_owner_delete" on storage.objects;

create policy "club_forum_public_read" on storage.objects
  for select using (bucket_id = 'club-forum');

create policy "club_forum_auth_upload" on storage.objects
  for insert with check (
    auth.role() = 'authenticated'
    and bucket_id = 'club-forum'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "club_forum_owner_update" on storage.objects
  for update using (
    auth.role() = 'authenticated'
    and bucket_id = 'club-forum'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "club_forum_owner_delete" on storage.objects
  for delete using (
    auth.role() = 'authenticated'
    and bucket_id = 'club-forum'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
