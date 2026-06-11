/* ============================================================
   Karakodak — Güneş Paneli İzleme Sistemi (ESP32)
   PRODUCTION / DAYANIKLI SÜRÜM
   ------------------------------------------------------------
   3 sensör okur, paneli değerlendirir, her 3 sn Supabase'e yazar:
     • LDR (ışık)        -> isik_seviyesi (%0-100)
     • ACS712 (akım)     -> uretim_amper  (A)
     • Yağmur sensörü    -> yagis_durumu  (true/false)
   Işık < %35 VEYA yağmur  -> ARIZA (kırmızı LED + buzzer)
   Aksi halde              -> NORMAL (beyaz LED)

   DAYANIKLILIK ÖZELLİKLERİ (İlyas isteği — "en üst düzey"):
     1) Donanım Task Watchdog — loop takılırsa otomatik reboot
     2) Yazılım watchdog — uzun süre başarı yoksa kendini resetler
     3) esp_reset_reason() — her açılışta NEDEN resetlendiğini yazar
     4) Dayanıklı WiFi — kopunca bloklamadan yeniden bağlanır
     5) HTTPS POST — timeout + tekrar denemeli (retry)
     6) Çevrimdışı tampon — internet yokken ölçümleri RAM'de saklar,
        bağlanınca zaman damgasıyla toplu gönderir (veri kaybı yok)
     7) Heap (RAM) izleme — kritik düşerse loglar/reboot
     8) Seviyeli detaylı loglama (uptime + INFO/WARN/ERROR) + sayaçlar

   Gerekli kütüphane: ArduinoJson  |  Kart: ESP32 Dev Module
   ============================================================ */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <esp_task_wdt.h>
#include <esp_system.h>
#include <time.h>

// ==================== AYARLAR ====================
const char* WIFI_SSID     = "Karakodak";
const char* WIFI_PASSWORD = "dmnmim01";

// Supabase — karakodak projesi (REST endpoint + anon public key)
const char* SUPABASE_URL  = "https://tfmtsrovkmvnsjozfjui.supabase.co/rest/v1/panel_verileri";
const char* SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmbXRzcm92a212bnNqb3pmanVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTAwNDMsImV4cCI6MjA5Njc2NjA0M30.qGgaZyRJdtzfzA0CWkbdj1_03ngyh2tbYOWRVTWC-3A";

// ==================== PİNLER ====================
#define LDR_PIN      35   // ışık sensörü   (analog giriş)
#define CURRENT_PIN  34   // ACS712 akım    (analog giriş)
#define RAIN_PIN     33   // yağmur sensörü (dijital; LOW = yağmur)
#define WHITE_LED    26   // NORMAL göstergesi
#define RED_LED      27   // ARIZA göstergesi
#define BUZZER_PIN   25   // ARIZA sesi

// ==================== PARAMETRELER ====================
const unsigned long GONDERIM_ARALIGI   = 3000;     // ms — 3 sn'de bir ölçüm/gönderim
const uint32_t      WDT_TIMEOUT_S       = 30;      // donanım watchdog (loop bu süre takılırsa reboot)
const unsigned long YAZILIM_WDT_MS      = 300000;  // 5 dk hiç başarılı gönderim yoksa kendini resetle
const unsigned long WIFI_BAGLANTI_TIMEOUT = 20000; // WiFi bağlanma denemesi üst sınırı (ms)
const int           HTTP_RETRY           = 2;      // başarısız POST tekrar deneme sayısı
const size_t        KRITIK_HEAP          = 20000;  // bu seviyenin altında reboot (bytes)
const int           TAMPON_BOYUT         = 40;     // çevrimdışı ölçüm tamponu (RAM ring buffer)
const int           STATUS_HER_N_GONDERIM= 20;     // her N gönderimde özet durum logu

// ---- ACS712 akım kalibrasyonu — DİKKAT: voltaj bölücüye bağlı, KALİBRE EDİLMELİ ----
// G34'e gelen sinyal, ACS712 OUT'unun direnç bölücüyle ölçeklenmiş hâli. Doğru amper için:
//   1) Paneli kapat/sök (0 akım), Serial Monitor'de "ACS712 G34: X.XXX V" satırını oku
//   2) O voltajı aşağıdaki ACS712_SIFIR_VOLT'a yaz
//   3) Bilinen bir akımda ölçüp gerekirse ACS712_VOLT_PER_AMP'i ayarla
const float ACS712_SIFIR_VOLT   = 1.65f;   // G34'te 0A iken voltaj (offset) — KALİBRE ET
const float ACS712_VOLT_PER_AMP = 0.185f;  // amper başına voltaj (V/A), bölücüyle ölçekli — KALİBRE ET

// ==================== DURUM / SAYAÇLAR ====================
unsigned long sonGonderim       = 0;
unsigned long sonBasariliEylem  = 0;   // yazılım watchdog referansı (ms)
unsigned long toplamGonderildi  = 0;
unsigned long toplamHata        = 0;
unsigned long ardisikHata       = 0;
size_t        minHeap           = SIZE_MAX;

// Çevrimdışı tampon (ring buffer)
struct Olcum {
  time_t zaman;       // epoch (0 = saat geçersizdi)
  int    isik;
  float  amper;
  bool   yagmur;
  char   durum[8];
};
Olcum  tampon[TAMPON_BOYUT];
int    tamponBas  = 0;
int    tamponSayi = 0;

// ============================================================
// LOGLAMA — [uptime] [SEVIYE] mesaj
// ============================================================
void logf(const char* seviye, const char* fmt, ...) {
  char msg[256];
  va_list args;
  va_start(args, fmt);
  vsnprintf(msg, sizeof(msg), fmt, args);
  va_end(args);
  unsigned long s = millis() / 1000UL;
  Serial.printf("[%02lu:%02lu:%02lu] [%s] %s\n",
                (s / 3600UL), (s / 60UL) % 60UL, s % 60UL, seviye, msg);
}

// ============================================================
// RESET SEBEBİ — "bir arıza olunca ne olduğunu anlayalım"
// ============================================================
const char* resetSebebiYazi(esp_reset_reason_t r) {
  switch (r) {
    case ESP_RST_POWERON:  return "Guc verildi (normal acilis)";
    case ESP_RST_SW:       return "Yazilimdan reset (ESP.restart)";
    case ESP_RST_PANIC:    return "PANIC — kod cokmesi/exception";
    case ESP_RST_INT_WDT:  return "Interrupt watchdog";
    case ESP_RST_TASK_WDT: return "TASK watchdog — loop takildi, otomatik kurtarildi";
    case ESP_RST_WDT:      return "Diger watchdog reset";
    case ESP_RST_BROWNOUT: return "BROWNOUT — besleme voltaji dustu (guc/kablo kontrol et)";
    case ESP_RST_DEEPSLEEP:return "Deep sleep sonrasi uyanma";
    case ESP_RST_EXT:      return "Harici reset (EN pini)";
    default:               return "Bilinmiyor";
  }
}

// ============================================================
// WATCHDOG (donanım) — versiyon güvenli (core 2.x / 3.x)
// ============================================================
void watchdogBaslat() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  esp_task_wdt_config_t cfg = {
    .timeout_ms    = WDT_TIMEOUT_S * 1000UL,
    .idle_core_mask = 0,
    .trigger_panic = true
  };
  esp_err_t e = esp_task_wdt_init(&cfg);
  if (e == ESP_ERR_INVALID_STATE) esp_task_wdt_reconfigure(&cfg);
#else
  esp_task_wdt_init(WDT_TIMEOUT_S, true);
#endif
  esp_task_wdt_add(NULL);   // bu task'i (loop) izle
  logf("INFO", "Donanim watchdog aktif: %us", (unsigned)WDT_TIMEOUT_S);
}
inline void watchdogBesle() { esp_task_wdt_reset(); }

// ============================================================
// KURULUM
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println();
  logf("INFO", "====== KARAKODAK GUNES PANELI IZLEME ======");

  // Son reset sebebini yaz (arıza tanılama)
  esp_reset_reason_t rr = esp_reset_reason();
  logf("INFO", "Onceki reset sebebi: %s", resetSebebiYazi(rr));
  if (rr == ESP_RST_BROWNOUT) {
    logf("WARN", "Brownout tespit edildi! USB/adaptor gucu ya da kablo zayif olabilir.");
  }
  logf("INFO", "Chip: %s  |  Bos heap: %u byte", ESP.getChipModel(), (unsigned)ESP.getFreeHeap());

  pinMode(WHITE_LED, OUTPUT);
  pinMode(RED_LED,   OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RAIN_PIN,  INPUT);

  // ADC: 0–3.3V tam aralık + 12-bit (0–4095)
  analogSetAttenuation(ADC_11db);
  analogReadResolution(12);

  watchdogBaslat();

  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  wifiBaglan();

  // NTP — çevrimdışı tampon ölçümlerine doğru zaman damgası için (UTC)
  if (WiFi.status() == WL_CONNECTED) ntpBaslat();

  sonBasariliEylem = millis();
  logf("INFO", "Kurulum tamam, dongu basliyor.");
}

// ============================================================
// ANA DÖNGÜ
// ============================================================
void loop() {
  watchdogBesle();              // donanım watchdog'u besle (loop yaşıyor)

  // Yazılım watchdog: uzun süre hiç başarı yoksa temiz başlangıç
  if (millis() - sonBasariliEylem > YAZILIM_WDT_MS) {
    logf("ERROR", "%lu dk basarili gonderim yok — kendini resetliyor (self-recovery).",
         YAZILIM_WDT_MS / 60000UL);
    delay(150);
    ESP.restart();
  }

  // Heap izleme: kritik düşerse (sızıntı vb.) temiz başlangıç
  size_t heap = ESP.getFreeHeap();
  if (heap < minHeap) minHeap = heap;
  if (heap < KRITIK_HEAP) {
    logf("ERROR", "Heap kritik (%u byte) — reboot.", (unsigned)heap);
    delay(150);
    ESP.restart();
  }

  // WiFi koptuysa bloklamadan yeniden bağlanmayı dene
  if (WiFi.status() != WL_CONNECTED) {
    wifiBaglan();
  }

  // 1) Sensörleri oku
  int   isik   = isikOku();
  float amper  = akimOku();
  bool  yagmur = yagmurVar();
  bool  ariza  = (isik < 35 || yagmur);

  // 2) Yerel uyarı: LED + buzzer
  if (ariza) {
    digitalWrite(RED_LED, HIGH);
    digitalWrite(WHITE_LED, LOW);
    tone(BUZZER_PIN, 1000);
  } else {
    digitalWrite(RED_LED, LOW);
    digitalWrite(WHITE_LED, HIGH);
    noTone(BUZZER_PIN);
  }

  // 3) Her 3 sn'de bir gönderim
  if (millis() - sonGonderim >= GONDERIM_ARALIGI) {
    sonGonderim = millis();
    const char* durum = ariza ? "ARIZA" : "NORMAL";

    bool basarili = false;
    if (WiFi.status() == WL_CONNECTED) {
      basarili = veriGonder(isik, amper, yagmur, durum);   // anlık (created_at = sunucu now())
      if (basarili) {
        tamponFlush();      // birikmiş çevrimdışı ölçümler varsa onları da gönder
      }
    }

    if (!basarili) {
      // WiFi/server yok ya da POST başarısız -> ölçümü zaman damgasıyla tampona al
      tamponaEkle(suAnEpoch(), isik, amper, yagmur, durum);
      logf("WARN", "Gonderilemedi -> tampona alindi (tampon: %d/%d)", tamponSayi, TAMPON_BOYUT);
    }

    durumOzeti();
  }
}

// ============================================================
// WiFi — bloklamayan, timeout'lu bağlanma (watchdog beslenir)
// ============================================================
void wifiBaglan() {
  if (WiFi.status() == WL_CONNECTED) return;

  logf("INFO", "WiFi baglaniyor: %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long basla = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - basla < WIFI_BAGLANTI_TIMEOUT) {
    delay(300);
    watchdogBesle();        // uzun bekleme sırasında watchdog'u besle (reboot olmasın)
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    logf("INFO", "WiFi OK — IP: %s  RSSI: %d dBm",
         WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    logf("WARN", "WiFi baglanamadi (timeout). Donguye devam, tekrar denenecek.");
  }
}

// ============================================================
// NTP — UTC saat (çevrimdışı tampon zaman damgaları için)
// ============================================================
void ntpBaslat() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");   // UTC
  logf("INFO", "NTP saat senkronu bekleniyor...");
  unsigned long basla = millis();
  while (!zamanGecerli() && millis() - basla < 8000) {
    delay(300);
    watchdogBesle();
  }
  if (zamanGecerli()) logf("INFO", "NTP senkron tamam (UTC).");
  else                logf("WARN", "NTP senkron olmadi — tampon kayitlari sunucu saatiyle yazilir.");
}

bool   zamanGecerli() { return time(nullptr) > 1700000000UL; }     // ~2023 sonrası geçerli
time_t suAnEpoch()    { return zamanGecerli() ? time(nullptr) : 0; }

String isoZaman(time_t t) {
  struct tm g;
  gmtime_r(&t, &g);
  char buf[25];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &g);
  return String(buf);
}

// ============================================================
// SENSÖRLER (matematik orijinalle birebir — donanımla uyumlu)
// ============================================================
int isikOku() {
  int ham   = analogRead(LDR_PIN);
  int yuzde = map(ham, 4095, 0, 0, 100);     // karanlık=0, aydınlık=100
  return constrain(yuzde, 0, 100);
}

float akimOku() {
  // ACS712: 0A ~1.65V (3.3V'un yarısı), hassasiyet 0.185 V/A
  float ham   = analogRead(CURRENT_PIN);
  float volt  = (ham / 4095.0f) * 3.3f;
  float amper = fabs((volt - 1.65f) / 0.185f);
  if (amper < 0.1f) amper = 0.0f;            // gürültü eşiği
  return amper;
}

bool yagmurVar() {
  return digitalRead(RAIN_PIN) == LOW;       // LOW = yağmur algılandı
}

// ============================================================
// SUPABASE — anlık tek gönderim (retry'li, timeout'lu)
// created_at gönderilmez -> sunucu now() yazar (en doğru anlık saat)
// ============================================================
bool veriGonder(int isik, float amper, bool yagmur, const char* durum) {
  StaticJsonDocument<200> doc;
  doc["isik_seviyesi"] = isik;
  doc["uretim_amper"]  = amper;
  doc["yagis_durumu"]  = yagmur;
  doc["durum"]         = durum;
  String govde;
  serializeJson(doc, govde);

  return httpGonder(govde);   // tek obje (array değil)
}

// ============================================================
// ÇEVRİMDIŞI TAMPON — ring buffer (en eskiyi düşürür)
// ============================================================
void tamponaEkle(time_t z, int isik, float amper, bool yagmur, const char* durum) {
  int idx = (tamponBas + tamponSayi) % TAMPON_BOYUT;
  tampon[idx].zaman  = z;
  tampon[idx].isik   = isik;
  tampon[idx].amper  = amper;
  tampon[idx].yagmur = yagmur;
  strncpy(tampon[idx].durum, durum, sizeof(tampon[idx].durum) - 1);
  tampon[idx].durum[sizeof(tampon[idx].durum) - 1] = '\0';

  if (tamponSayi < TAMPON_BOYUT) {
    tamponSayi++;
  } else {
    tamponBas = (tamponBas + 1) % TAMPON_BOYUT;   // tampon dolu -> en eskiyi at
    logf("WARN", "Tampon dolu — en eski olcum dusuruldu.");
  }
}

// Birikmiş ölçümleri TEK toplu POST (array) ile gönder
void tamponFlush() {
  if (tamponSayi == 0) return;

  String govde = "[";
  for (int i = 0; i < tamponSayi; i++) {
    int idx = (tamponBas + i) % TAMPON_BOYUT;
    if (i) govde += ",";
    govde += "{";
    if (tampon[idx].zaman > 0) {                 // zaman varsa orijinal damgayı koru
      govde += "\"created_at\":\"" + isoZaman(tampon[idx].zaman) + "\",";
    }
    govde += "\"isik_seviyesi\":" + String(tampon[idx].isik) + ",";
    govde += "\"uretim_amper\":"  + String(tampon[idx].amper, 3) + ",";
    govde += "\"yagis_durumu\":"  + String(tampon[idx].yagmur ? "true" : "false") + ",";
    govde += "\"durum\":\""        + String(tampon[idx].durum) + "\"}";
  }
  govde += "]";

  logf("INFO", "Tampon gonderiliyor (%d olcum, toplu)...", tamponSayi);
  if (httpGonder(govde)) {
    logf("INFO", "Tampon basariyla bosaltildi (%d olcum).", tamponSayi);
    tamponBas  = 0;
    tamponSayi = 0;
  } else {
    logf("WARN", "Tampon gonderilemedi — bir sonraki baglantida tekrar denenecek.");
  }
}

// ============================================================
// HTTP — ortak gönderim (timeout + retry). Başarıda true.
// ============================================================
bool httpGonder(const String& govde) {
  if (WiFi.status() != WL_CONNECTED) return false;

  for (int deneme = 0; deneme <= HTTP_RETRY; deneme++) {
    watchdogBesle();

    WiFiClientSecure client;
    client.setInsecure();                 // Supabase TLS — sertifika doğrulaması atlanır

    HTTPClient https;
    https.setConnectTimeout(5000);
    https.setTimeout(8000);

    if (!https.begin(client, SUPABASE_URL)) {
      logf("ERROR", "HTTPS begin hatasi (deneme %d)", deneme + 1);
      continue;
    }
    https.addHeader("apikey", SUPABASE_ANON);
    https.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON);
    https.addHeader("Content-Type", "application/json");
    https.addHeader("Prefer", "return=minimal");

    int kod = https.POST(govde);
    https.end();

    if (kod == 200 || kod == 201) {
      toplamGonderildi++;
      ardisikHata = 0;
      sonBasariliEylem = millis();
      logf("INFO", "Gonderildi [%d]  (toplam: %lu)", kod, toplamGonderildi);
      return true;
    }

    // Hata — detaylı logla
    toplamHata++;
    ardisikHata++;
    if (kod > 0) {
      logf("ERROR", "HTTP %d (deneme %d/%d). Yanit: %s",
           kod, deneme + 1, HTTP_RETRY + 1, https.getString().c_str());
    } else {
      logf("ERROR", "Baglanti hatasi: %s (deneme %d/%d)",
           HTTPClient::errorToString(kod).c_str(), deneme + 1, HTTP_RETRY + 1);
    }
    delay(300);
  }
  return false;
}

// ============================================================
// PERİYODİK DURUM ÖZETİ — sağlık göstergeleri
// ============================================================
void durumOzeti() {
  static unsigned long sayac = 0;
  sayac++;
  if (sayac % STATUS_HER_N_GONDERIM != 0) return;

  unsigned long up = millis() / 1000UL;
  logf("INFO", "== DURUM == uptime:%lus  heap:%u(min:%u)  RSSI:%d  gonderim:%lu  hata:%lu  tampon:%d",
       up, (unsigned)ESP.getFreeHeap(), (unsigned)minHeap,
       (WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0),
       toplamGonderildi, toplamHata, tamponSayi);
}
