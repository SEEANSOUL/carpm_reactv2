-- ============================================================
-- CRUD politikaları + bookmark sayacı
-- schema.sql sonrası çalıştır
-- ============================================================

-- Clubs: creator/owner silebilir
drop policy if exists "clubs_delete_owner" on public.clubs;
create policy "clubs_delete_owner" on public.clubs
  for delete using (
    auth.uid() = created_by
    or exists (
      select 1 from public.club_members m
      where m.club_id = id and m.user_id = auth.uid() and m.role in ('owner', 'admin')
    )
  );

-- Events: creator güncelleyebilir / silebilir
drop policy if exists "events_update_own" on public.events;
drop policy if exists "events_delete_own" on public.events;
create policy "events_update_own" on public.events
  for update using (auth.uid() = created_by);
create policy "events_delete_own" on public.events
  for delete using (auth.uid() = created_by);

-- Bookmark count trigger
create or replace function public.bump_shot_bookmark_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.shots set bookmark_count = bookmark_count + 1 where id = new.shot_id;
  elsif tg_op = 'DELETE' then
    update public.shots set bookmark_count = greatest(bookmark_count - 1, 0) where id = old.shot_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists shot_bookmarks_count on public.shot_bookmarks;
create trigger shot_bookmarks_count
  after insert or delete on public.shot_bookmarks
  for each row execute function public.bump_shot_bookmark_count();

-- Comment count trigger
create or replace function public.bump_shot_comment_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.shots set comment_count = comment_count + 1 where id = new.shot_id;
  elsif tg_op = 'DELETE' then
    update public.shots set comment_count = greatest(comment_count - 1, 0) where id = old.shot_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists shot_comments_count on public.shot_comments;
create trigger shot_comments_count
  after insert or delete on public.shot_comments
  for each row execute function public.bump_shot_comment_count();
