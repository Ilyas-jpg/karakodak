// Karakodak DB şema uygulayıcı — doğrudan Postgres bağlantısı (pg)
// Kullanım: $env:DB_URL="postgresql://..."; node db/apply.mjs
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');

const connectionString = process.env.DB_URL;
if (!connectionString) {
  console.error('HATA: DB_URL env değişkeni yok.');
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },     // Supabase SSL
  connectionTimeoutMillis: 15000,
  query_timeout: 30000,
});

try {
  console.log('Bağlanıyor →', connectionString.replace(/:[^:@]*@/, ':****@'));
  await client.connect();
  console.log('Bağlandı ✓');

  await client.query(sql);
  console.log('Şema uygulandı ✓');

  const { rows } = await client.query(
    'select count(*)::int as n from public.panel_verileri'
  );
  console.log('panel_verileri satır sayısı:', rows[0].n);

  const { rows: pol } = await client.query(
    "select policyname from pg_policies where tablename = 'panel_verileri'"
  );
  console.log('RLS politikaları:', pol.map((r) => r.policyname).join(', ') || '(yok)');

  const { rows: rt } = await client.query(
    "select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename='panel_verileri'"
  );
  console.log('Realtime aktif:', rt.length ? 'EVET ✓' : 'HAYIR (panelden açılmalı)');
} catch (e) {
  console.error('HATA:', e.code || '', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
