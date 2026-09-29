-- ============================================================
-- Kulup uyelik onay + is_club_member guncelleme
-- Supabase SQL Editor'da calistir
-- ============================================================

alter table public.club_members
  add column if not exists status text not null default 'approved';

alter table public.club_members
  drop constraint if exists club_members_status_check;

alter table public.club_members
  add constraint club_members_status_check
  check (status in ('pending', 'approved', 'rejected'));

-- Mevcut kayitlar onayli kalsin
update public.club_members set status = 'approved' where status is null or status = '';

-- Uye sayaci: sadece approved
create or replace function public.bump_club_member_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'approved' then
      update public.clubs set member_count = member_count + 1 where id = new.club_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.status = 'approved' then
      update public.clubs set member_count = greatest(member_count - 1, 0) where id = old.club_id;
    end if;
    return old;
  elsif tg_op = 'UPDATE' then
    if old.status is distinct from new.status then
      if old.status = 'approved' and new.status <> 'approved' then
        update public.clubs set member_count = greatest(member_count - 1, 0) where id = new.club_id;
      elsif old.status <> 'approved' and new.status = 'approved' then
        update public.clubs set member_count = member_count + 1 where id = new.club_id;
      end if;
    end if;
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists club_members_count on public.club_members;
create trigger club_members_count
  after insert or delete or update of status on public.club_members
  for each row execute function public.bump_club_member_count();

-- Forum erisimi: sadece approved
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
      and m.status = 'approved'
  );
$$;

revoke all on function public.is_club_member(uuid) from public;
grant execute on function public.is_club_member(uuid) to authenticated;

-- RLS: kurucu status guncelleyebilir
drop policy if exists "club_members_update_founder" on public.club_members;
create policy "club_members_update_founder" on public.club_members
  for update using (
    exists (
      select 1 from public.clubs c
      where c.id = club_members.club_id
        and c.created_by = auth.uid()
    )
  );

-- Bildirimler: istek + kabul
create or replace function public.notify_club_membership()
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
  if coalesce(new.role, 'member') = 'owner' then
    return new;
  end if;

  select c.created_by, c.name into v_owner, v_club_name
  from public.clubs c
  where c.id = new.club_id;

  if v_owner is null then
    return new;
  end if;

  v_label := public.actor_label(new.user_id);

  if tg_op = 'INSERT' and new.status = 'pending' and v_owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, title, body, data)
    values (
      v_owner,
      new.user_id,
      'club_join_request',
      'Katılım isteği',
      v_label || ' "' || coalesce(v_club_name, 'kulüp') || '" kulübüne katılmak istiyor.',
      jsonb_build_object('club_id', new.club_id, 'member_user_id', new.user_id)
    );
  elsif tg_op = 'UPDATE'
    and old.status is distinct from new.status
    and new.status = 'approved'
    and old.status = 'pending' then
    insert into public.notifications (user_id, actor_id, type, title, body, data)
    values (
      new.user_id,
      v_owner,
      'club_join_approved',
      'Kulüp kabul',
      '"' || coalesce(v_club_name, 'kulüp') || '" kulübüne kabul edildin.',
      jsonb_build_object('club_id', new.club_id)
    );
  elsif tg_op = 'UPDATE'
    and old.status is distinct from new.status
    and new.status = 'rejected'
    and old.status = 'pending' then
    insert into public.notifications (user_id, actor_id, type, title, body, data)
    values (
      new.user_id,
      v_owner,
      'club_join_rejected',
      'Kulüp red',
      '"' || coalesce(v_club_name, 'kulüp') || '" katılım isteğin reddedildi.',
      jsonb_build_object('club_id', new.club_id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists club_members_notify on public.club_members;
drop trigger if exists club_members_notify_membership on public.club_members;
create trigger club_members_notify_membership
  after insert or update of status on public.club_members
  for each row execute function public.notify_club_membership();
