-- ============================================================
-- Kulüp forum yanıtları + bildirim
-- Supabase SQL Editor'da çalıştır
-- ============================================================

alter table public.club_posts
  add column if not exists reply_count int not null default 0;

create table if not exists public.club_post_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.club_posts(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint club_post_replies_body_len check (char_length(body) between 1 and 2000)
);

create index if not exists idx_club_post_replies_post
  on public.club_post_replies (post_id, created_at asc);

create index if not exists idx_club_post_replies_club
  on public.club_post_replies (club_id, created_at desc);

-- Sayaç
create or replace function public.bump_club_post_reply_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.club_posts
      set reply_count = reply_count + 1
    where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.club_posts
      set reply_count = greatest(reply_count - 1, 0)
    where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists club_post_replies_count on public.club_post_replies;
create trigger club_post_replies_count
  after insert or delete on public.club_post_replies
  for each row execute function public.bump_club_post_reply_count();

-- Bildirim: post sahibine
create or replace function public.notify_club_post_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
  v_club uuid;
  v_label text;
begin
  select p.author_id, p.club_id into v_author, v_club
  from public.club_posts p
  where p.id = new.post_id;

  if v_author is null or v_author = new.author_id then
    return new;
  end if;

  v_label := public.actor_label(new.author_id);

  insert into public.notifications (user_id, actor_id, type, title, body, data)
  values (
    v_author,
    new.author_id,
    'club_reply',
    'Forum yanıtı',
    v_label || ' gönderine yanıt verdi.',
    jsonb_build_object(
      'club_id', coalesce(new.club_id, v_club),
      'post_id', new.post_id,
      'reply_id', new.id
    )
  );

  return new;
end;
$$;

drop trigger if exists club_post_replies_notify on public.club_post_replies;
create trigger club_post_replies_notify
  after insert on public.club_post_replies
  for each row execute function public.notify_club_post_reply();

-- RLS
alter table public.club_post_replies enable row level security;

drop policy if exists "club_post_replies_select_member" on public.club_post_replies;
drop policy if exists "club_post_replies_insert_member" on public.club_post_replies;
drop policy if exists "club_post_replies_delete_own" on public.club_post_replies;

create policy "club_post_replies_select_member" on public.club_post_replies
  for select using (public.is_club_member(club_id));

create policy "club_post_replies_insert_member" on public.club_post_replies
  for insert with check (
    auth.uid() = author_id
    and public.is_club_member(club_id)
    and exists (
      select 1 from public.club_posts p
      where p.id = post_id and p.club_id = club_id
    )
  );

create policy "club_post_replies_delete_own" on public.club_post_replies
  for delete using (
    auth.uid() = author_id
    or exists (
      select 1 from public.club_members m
      where m.club_id = club_post_replies.club_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin', 'moderator')
    )
  );
