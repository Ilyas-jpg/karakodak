// Karakodak — DEMO örnek veri üretici (yalnız test/geliştirme için)
// Kullanım: $env:DB_URL="postgresql://..."; node db/seed.mjs
// DİKKAT: tabloyu önce temizler (truncate). ESP32 canlı veri gönderirken ÇALIŞTIRMA.
import pg from "pg";

const connectionString = process.env.DB_URL;
if (!connectionString) {
  console.error("HATA: DB_URL yok.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const TOPLAM = 50;
const ARALIK_SN = 3;

function uret(i) {
  // i: 0 (en eski) -> TOPLAM-1 (en yeni)
  let isik = Math.round(60 + 30 * Math.sin(i / 7));
  let yagmur = false;

  // Gerçekçi bir arıza penceresi: bulutlanma + yağmur
  if (i >= 18 && i <= 26) {
    isik = Math.round(18 + Math.random() * 12);
    yagmur = i >= 20 && i <= 24;
  }

  isik = Math.max(0, Math.min(100, isik));
  let amper = (isik / 100) * 5 + (Math.random() * 0.3 - 0.15);
  if (yagmur) amper *= 0.6;
  amper = Math.max(0, Number(amper.toFixed(3)));

  const durum = isik < 35 || yagmur ? "ARIZA" : "NORMAL";
  const offsetSn = (TOPLAM - 1 - i) * ARALIK_SN;
  return { offsetSn, isik, amper, yagmur, durum };
}

try {
  await client.connect();
  console.log("Bağlandı ✓ — örnek veri ekleniyor...");

  await client.query("truncate public.panel_verileri restart identity");

  for (let i = 0; i < TOPLAM; i++) {
    const r = uret(i);
    await client.query(
      `insert into public.panel_verileri
         (created_at, isik_seviyesi, uretim_amper, yagis_durumu, durum)
       values (now() - ($1 || ' seconds')::interval, $2, $3, $4, $5)`,
      [r.offsetSn, r.isik, r.amper, r.yagmur, r.durum]
    );
  }

  const { rows } = await client.query(
    "select count(*)::int n, count(*) filter (where durum='ARIZA')::int ariza from public.panel_verileri"
  );
  console.log(`Eklendi ✓ — toplam ${rows[0].n} okuma, ${rows[0].ariza} ARIZA satırı.`);
} catch (e) {
  console.error("HATA:", e.code || "", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
