// Supabase `panel_verileri` tablosunun bir satırı (ESP32'nin gönderdiği veri)
export type PanelVerisi = {
  id: number;
  created_at: string; // ISO timestamp
  isik_seviyesi: number; // LDR, %0-100
  uretim_amper: number; // ACS712 akım (A)
  yagis_durumu: boolean; // yağmur var/yok
  durum: "NORMAL" | "ARIZA";
};

// `panel_gunluk_ozet` view'undan gelen günlük özet
export type GunlukOzet = {
  gun: string;
  ort_uretim: number | null;
  max_isik: number | null;
  ariza_sayisi: number;
  toplam_okuma: number;
};

// Ardışık ARIZA okumalarının gruplandığı tek bir arıza olayı
export type ArizaOlayi = {
  baslangic: string;
  bitis: string;
  sebep: string; // "Düşük ışık", "Yağmur", "Düşük ışık + Yağmur"
  okumaSayisi: number;
};

// ARIZA eşiği — ESP32 kodundaki mantıkla birebir aynı (ışık < 35 veya yağmur)
export const ISIK_ARIZA_ESIGI = 35;

export function arizaSebebi(r: PanelVerisi): string {
  const dusukIsik = r.isik_seviyesi < ISIK_ARIZA_ESIGI;
  if (dusukIsik && r.yagis_durumu) return "Düşük ışık + Yağmur";
  if (r.yagis_durumu) return "Yağmur";
  if (dusukIsik) return "Düşük ışık";
  return "Bilinmiyor";
}
