-- ============================================================
-- Push notifications (Expo Push via pg_net)
-- Uygulama dışı: beğeni / takip / kulüp / admin broadcast
-- Supabase SQL Editor'da çalıştır.
-- ============================================================

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text, -- ios | android | web
  updated_at timestamptz not null default now(),
  unique (token)
);

create index if not exists idx_push_tokens_user on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens_select_own" on public.push_tokens;
create policy "push_tokens_select_own" on public.push_tokens
  for select using (auth.uid() = user_id);

drop policy if exists "push_tokens_insert_own" on public.push_tokens;
create policy "push_tokens_insert_own" on public.push_tokens
  for insert with check (auth.uid() = user_id);

drop policy if exists "push_tokens_update_own" on public.push_tokens;
create policy "push_tokens_update_own" on public.push_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push_tokens_delete_own" on public.push_tokens;
create policy "push_tokens_delete_own" on public.push_tokens
  for delete using (auth.uid() = user_id);

create or replace function public.set_push_token_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists push_tokens_set_updated_at on public.push_tokens;
create trigger push_tokens_set_updated_at
  before update on public.push_tokens
  for each row execute function public.set_push_token_updated_at();

-- Token kaydet / güncelle (mobil)
create or replace function public.upsert_push_token(
  p_token text,
  p_platform text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  if p_token is null or length(trim(p_token)) < 10 then
    raise exception 'Geçersiz push token';
  end if;

  insert into public.push_tokens (user_id, token, platform)
  values (auth.uid(), trim(p_token), nullif(trim(p_platform), ''))
  on conflict (token) do update
    set user_id = auth.uid(),
        platform = coalesce(excluded.platform, public.push_tokens.platform),
        updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_push_token(text, text) from public;
grant execute on function public.upsert_push_token(text, text) to authenticated;

-- Gönderim logu (debug)
create table if not exists public.push_dispatch_log (
  id bigserial primary key,
  notification_id uuid,
  user_id uuid,
  token_count int not null default 0,
  request_id bigint,
  error text,
  created_at timestamptz not null default now()
);

alter table public.push_dispatch_log enable row level security;

drop policy if exists "push_dispatch_log_admin_select" on public.push_dispatch_log;
create policy "push_dispatch_log_admin_select" on public.push_dispatch_log
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- notifications INSERT → Expo Push API
create or replace function public.dispatch_expo_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  v_messages jsonb;
  v_count int;
  v_req_id bigint;
  v_err text;
begin
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'to', pt.token,
          'title', new.title,
          'body', coalesce(new.body, ''),
          'sound', 'default',
          'priority', 'high',
          'channelId', 'carpm_default',
          'data', coalesce(new.data, '{}'::jsonb) || jsonb_build_object(
            'notification_id', new.id,
            'type', new.type,
            'actor_id', new.actor_id
          )
        )
      ),
      '[]'::jsonb
    ),
    count(*)::int
  into v_messages, v_count
  from public.push_tokens pt
  where pt.user_id = new.user_id;

  if v_count is null or v_count = 0 then
    insert into public.push_dispatch_log (notification_id, user_id, token_count, error)
    values (new.id, new.user_id, 0, 'no_push_token');
    return new;
  end if;

  begin
    v_req_id := net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Accept', 'application/json',
        'Accept-Encoding', 'gzip, deflate'
      ),
      body := v_messages
    );
  exception
    when others then
      v_err := sqlerrm;
      v_req_id := null;
  end;

  insert into public.push_dispatch_log (notification_id, user_id, token_count, request_id, error)
  values (new.id, new.user_id, v_count, v_req_id, v_err);

  return new;
exception
  when others then
    raise warning 'dispatch_expo_push failed: %', sqlerrm;
    begin
      insert into public.push_dispatch_log (notification_id, user_id, token_count, error)
      values (new.id, new.user_id, 0, sqlerrm);
    exception when others then
      null;
    end;
    return new;
end;
$$;

drop trigger if exists notifications_dispatch_expo_push on public.notifications;
create trigger notifications_dispatch_expo_push
  after insert on public.notifications
  for each row execute function public.dispatch_expo_push();
