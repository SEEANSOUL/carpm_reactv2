-- ============================================================
-- Etkinlik: sadece kulüp kurucusu oluşturabilir
-- ============================================================

drop policy if exists "events_insert_auth" on public.events;

create policy "events_insert_club_owner" on public.events
  for insert with check (
    auth.uid() = created_by
    and club_id is not null
    and exists (
      select 1 from public.clubs c
      where c.id = club_id
        and c.created_by = auth.uid()
    )
  );

-- Kulüp etkinliği: sadece clubs.created_by oluşturabilir
