-- ============================================================
-- CARPM — Opsiyonel seed (BOŞ başlamak istiyorsan ÇALIŞTIRMA)
-- Uygulama mock kullanmaz; tüm içerik kullanıcılardan gelir.
-- Bu dosya sadece demo/test için.
-- ============================================================

-- Kategoriler (filtre için faydalı — boş app'te de kullanılabilir)
insert into public.categories (slug, name, sort_order) values
  ('all', 'Tümü', 0),
  ('motorcycle', 'Motosiklet', 1),
  ('jdm-drift', 'JDM/Drift', 2),
  ('track', 'Pist Odaklı', 3),
  ('night-run', 'Gece Konvoy', 4)
on conflict (slug) do nothing;
