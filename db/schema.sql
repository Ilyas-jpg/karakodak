-- ============================================================
-- Karakodak — Güneş Paneli İzleme Sistemi
-- Veritabanı şeması (idempotent — tekrar çalıştırılabilir)
-- ============================================================

-- 1) Ana veri tablosu (ESP32 her 3sn buraya POST atar)
create table if not exists public.panel_verileri (
  id            bigint generated always as identity primary key,
  created_at    timestamptz  not null default now(),
  isik_seviyesi integer      not null,                       -- LDR, %0-100
  uretim_amper  numeric(6,3) not null,                       -- ACS712 akım (A)
  yagis_durumu  boolean      not null,                       -- yağmur var/yok
  durum         text         not null
                  check (durum in ('NORMAL','ARIZA'))        -- ışık<35 ya da yağmur -> ARIZA
);

-- 2) "Son okumalar" ve geçmiş sorguları için index
create index if not exists panel_verileri_created_at_idx
  on public.panel_verileri (created_at desc);

-- 3) Row Level Security — ESP32 yazsın, site okusun; UPDATE/DELETE yasak
alter table public.panel_verileri enable row level security;

drop policy if exists "anon can insert" on public.panel_verileri;
create policy "anon can insert" on public.panel_verileri
  for insert to anon with check (true);

drop policy if exists "anon can select" on public.panel_verileri;
create policy "anon can select" on public.panel_verileri
  for select to anon using (true);

-- 4) PostgREST anon erişimi için tablo izinleri
grant usage on schema public to anon;
grant select, insert on public.panel_verileri to anon;

-- 5) Realtime — canlı INSERT push (publication güvenli ekleme)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'panel_verileri'
    ) then
      alter publication supabase_realtime add table public.panel_verileri;
    end if;
  end if;
end $$;

-- 6) Günlük istatistik özeti view'u (security_invoker -> RLS uygulanır)
create or replace view public.panel_gunluk_ozet
  with (security_invoker = true) as
select
  date_trunc('day', created_at)            as gun,
  round(avg(uretim_amper), 2)              as ort_uretim,
  max(isik_seviyesi)                       as max_isik,
  count(*) filter (where durum = 'ARIZA')  as ariza_sayisi,
  count(*)                                 as toplam_okuma
from public.panel_verileri
group by 1;

grant select on public.panel_gunluk_ozet to anon;
