-- Shot'ta audio opsiyonel olsun (Yok seçilince null)
alter table public.shots
  alter column audio_source drop not null;

alter table public.shots
  alter column audio_source set default null;
