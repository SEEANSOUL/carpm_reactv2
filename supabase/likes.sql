-- ============================================================
-- Beğeni / bookmark sayaçları + RLS güvenli trigger
-- Beğenirken hata alıyorsan bunu SQL Editor'de çalıştır
-- ============================================================

-- shot_likes RLS (yeniden)
alter table public.shot_likes enable row level security;

drop policy if exists "shot_likes_select" on public.shot_likes;
drop policy if exists "shot_likes_insert" on public.shot_likes;
drop policy if exists "shot_likes_delete" on public.shot_likes;

create policy "shot_likes_select" on public.shot_likes
  for select using (true);

create policy "shot_likes_insert" on public.shot_likes
  for insert with check (auth.uid() = user_id);

create policy "shot_likes_delete" on public.shot_likes
  for delete using (auth.uid() = user_id);

-- Güvenli sayaç: shots + profiles güncellemesi RLS'e takılmaz
create or replace function public.bump_shot_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.shots
      set like_count = coalesce(like_count, 0) + 1
     where id = new.shot_id;
    update public.profiles p
      set like_count = coalesce(p.like_count, 0) + 1
     from public.shots s
    where s.id = new.shot_id
      and p.id = s.creator_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.shots
      set like_count = greatest(coalesce(like_count, 0) - 1, 0)
     where id = old.shot_id;
    update public.profiles p
      set like_count = greatest(coalesce(p.like_count, 0) - 1, 0)
     from public.shots s
    where s.id = old.shot_id
      and p.id = s.creator_id;
    return old;
  end if;
  return null;
exception when others then
  -- Sayac bozulsa bile like kaydı düşmesin
  raise warning 'bump_shot_like_count: %', sqlerrm;
  return coalesce(new, old);
end;
$$;

drop trigger if exists shot_likes_count on public.shot_likes;
create trigger shot_likes_count
  after insert or delete on public.shot_likes
  for each row execute function public.bump_shot_like_count();

-- Function'ı authenticated çağırabilsin (trigger zaten kullanır)
revoke all on function public.bump_shot_like_count() from public;
grant execute on function public.bump_shot_like_count() to postgres, anon, authenticated, service_role;
