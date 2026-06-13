# 🌞 Karakodak — Güneş Paneli İzleme Sistemi

Beyza'nın bitirme projesi. ESP32 + 3 sensör güneş panelini izler, ölçümü Supabase'e yazar, canlı Next.js dashboard'ında gösterir.

**Canlı:** https://karakodak.vercel.app

---

## Mimari

```
ESP32 (LDR + ACS712 + yağmur) ──HTTPS POST (3sn)──▶ Supabase Postgres ──Realtime──▶ Next.js Dashboard @ Vercel
```

## Klasörler

| Klasör | İçerik |
|---|---|
| `esp32/gunes_paneli/` | ESP32 firmware (Arduino sketch) |
| `panel-izleme/` | Next.js 16 dashboard (Tailwind + Recharts + Supabase) |
| `db/` | Veritabanı şeması (`schema.sql`) + yardımcı scriptler |

## Sensörler / Pinler

| Bileşen | Pin | DB kolonu |
|---|---|---|
| LDR (ışık) | 35 | `isik_seviyesi` (%0-100) |
| ACS712 (akım) | 34 | `uretim_amper` (A) |
| Yağmur sensörü | 33 | `yagis_durumu` (bool) |
| Beyaz LED | 26 | NORMAL göstergesi |
| Kırmızı LED | 27 | ARIZA göstergesi |
| Buzzer | 25 | ARIZA sesi |

**Mantık:** ışık < %35 **veya** yağmur → `ARIZA` (kırmızı LED + buzzer); değilse `NORMAL` (beyaz LED).

---

## Kurulum

### Veritabanı (Supabase)
`db/schema.sql` içeriğini Supabase SQL Editor'de çalıştır (tablo + RLS + realtime + istatistik view).

### Web (panel-izleme)
```bash
cd panel-izleme
npm install
# .env.local olustur:
#   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
npm run dev          # http://localhost:3000
```

### ESP32
1. `esp32/gunes_paneli/gunes_paneli.ino` Arduino IDE'de aç
2. **ArduinoJson** kütüphanesini kur (Kütüphane Yöneticisi)
3. Kart: **ESP32 Dev Module**, doğru COM portu
4. WiFi (`WIFI_SSID`/`WIFI_PASSWORD`) ve Supabase (URL + anon key) kod içinde ayarlı
5. **Upload** → Serial Monitor (115200) ile bağlantı + gönderim loglarını izle

### Deploy
Vercel'e bağlı: `main`'e **push** → otomatik build + deploy.

---

## ESP32 firmware — dayanıklılık

Donanım + yazılım watchdog (takılırsa otomatik reboot) · `esp_reset_reason()` tanılama (arıza sonrası neden) · dayanıklı WiFi reconnect · HTTP retry · **çevrimdışı tampon** (internet kesilince ölçümleri RAM'de saklar, bağlanınca zaman damgasıyla toplu gönderir) · heap izleme · detaylı seviyeli seri log.

## ACS712 akım kalibrasyonu

Akım değeri voltaj bölücü oranına bağlıdır. Doğru okuma için: panel **0A** iken Serial'daki `ACS712 G34: X.XXX V` satırını oku → o voltajı firmware'deki `ACS712_SIFIR_VOLT` sabitine yaz.

---

*Stack: ESP32 (Arduino) · Supabase (Postgres + Realtime) · Next.js 16 · Vercel*

## Lisans

[MIT](LICENSE) © 2026 İlyas Saltay
