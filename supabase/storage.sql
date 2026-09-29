-- ============================================================
-- CARPM Storage — bucket + RLS (idempotent)
-- Supabase SQL Editor'de çalıştır
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 8388608, array['image/jpeg','image/png','image/webp','image/heic']),
  ('club-banners', 'club-banners', true, 8388608, array['image/jpeg','image/png','image/webp','image/heic']),
  ('club-forum', 'club-forum', true, 8388608, array['image/jpeg','image/png','image/webp','image/heic']),
  ('vehicles', 'vehicles', true, 8388608, array['image/jpeg','image/png','image/webp','image/heic']),
  ('shots', 'shots', true, 52428800, array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime']),
  ('shot-thumbs', 'shot-thumbs', true, 8388608, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Eski politikaları temizle
drop policy if exists "public_read_media" on storage.objects;
drop policy if exists "auth_upload_media" on storage.objects;
drop policy if exists "owner_update_media" on storage.objects;
drop policy if exists "owner_delete_media" on storage.objects;
drop policy if exists "carpm_public_read" on storage.objects;
drop policy if exists "carpm_auth_upload" on storage.objects;
drop policy if exists "carpm_owner_update" on storage.objects;
drop policy if exists "carpm_owner_delete" on storage.objects;

-- Herkes okuyabilir (public buckets)
create policy "carpm_public_read" on storage.objects
  for select using (
    bucket_id in ('avatars', 'club-banners', 'club-forum', 'vehicles', 'shots', 'shot-thumbs')
  );

-- Giriş yapmış kullanıcı kendi klasörüne yükler: {userId}/...
create policy "carpm_auth_upload" on storage.objects
  for insert with check (
    auth.role() = 'authenticated'
    and bucket_id in ('avatars', 'club-banners', 'club-forum', 'vehicles', 'shots', 'shot-thumbs')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "carpm_owner_update" on storage.objects
  for update using (
    auth.role() = 'authenticated'
    and bucket_id in ('avatars', 'club-banners', 'club-forum', 'vehicles', 'shots', 'shot-thumbs')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "carpm_owner_delete" on storage.objects
  for delete using (
    auth.role() = 'authenticated'
    and bucket_id in ('avatars', 'club-banners', 'club-forum', 'vehicles', 'shots', 'shot-thumbs')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
