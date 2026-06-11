"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import type { PanelVerisi, GunlukOzet, ArizaOlayi } from "./types";
import { arizaSebebi } from "./types";

// Bellekte tutulacak son okuma sayısı (3sn aralık → ~6 dk geçmiş)
const MAX_SATIR = 120;

// --- Beyza'nın ayarlayabileceği davranış: cihaz ne zaman "çevrimdışı" sayılır? ---
// ESP32 her 3 sn veri yolluyor. 12 sn (4 kaçan okuma) boyunca veri gelmezse
// cihazı çevrimdışı kabul ediyoruz. Bu eşiği projenin ihtiyacına göre değiştir.
const CEVRIMDISI_ESIGI_MS = 12000;

// Ardışık ARIZA okumalarını tek bir "arıza olayı"na grupla.
// (Aksi halde her 3sn'lik ARIZA satırı ayrı olay gibi görünürdü.)
function arizalariGrupla(rows: PanelVerisi[]): ArizaOlayi[] {
  const kronolojik = [...rows].reverse(); // eski -> yeni
  const olaylar: ArizaOlayi[] = [];
  let aktif: ArizaOlayi | null = null;

  for (const r of kronolojik) {
    if (r.durum === "ARIZA") {
      if (!aktif) {
        aktif = {
          baslangic: r.created_at,
          bitis: r.created_at,
          sebep: arizaSebebi(r),
          okumaSayisi: 1,
        };
      } else {
        aktif.bitis = r.created_at;
        aktif.okumaSayisi += 1;
      }
    } else if (aktif) {
      olaylar.push(aktif);
      aktif = null;
    }
  }
  if (aktif) olaylar.push(aktif);

  return olaylar.reverse(); // en yeni olay en üstte
}

export function useRealtimeData() {
  const [rows, setRows] = useState<PanelVerisi[]>([]);
  const [ozet, setOzet] = useState<GunlukOzet | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<number>(() => Date.now());

  // 1) İlk yükleme + realtime INSERT aboneliği
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data, error } = await supabase
        .from("panel_verileri")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(MAX_SATIR);
      if (mounted) {
        if (!error && data) setRows(data as PanelVerisi[]);
        setLoading(false);
      }
    })();

    const channel = supabase
      .channel("panel-verileri-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "panel_verileri" },
        (payload) => {
          setRows((prev) =>
            [payload.new as PanelVerisi, ...prev].slice(0, MAX_SATIR)
          );
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // 2) Günlük istatistik özeti (view) — 15 sn'de bir tazele
  useEffect(() => {
    let mounted = true;
    const getir = async () => {
      const { data, error } = await supabase
        .from("panel_gunluk_ozet")
        .select("*")
        .order("gun", { ascending: false })
        .limit(1);
      if (mounted && !error && data && data[0]) {
        setOzet(data[0] as GunlukOzet);
      }
    };
    getir();
    const id = setInterval(getir, 15000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  // 3) Saniye sayacı — "x sn önce" ve çevrimdışı hesabı için
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const latest = rows[0] ?? null;

  const online = useMemo(() => {
    if (!latest) return false;
    return now - new Date(latest.created_at).getTime() < CEVRIMDISI_ESIGI_MS;
  }, [latest, now]);

  // Grafikler için kronolojik (eski -> yeni) seri
  const chartData = useMemo(
    () =>
      [...rows].reverse().map((r) => ({
        saat: new Date(r.created_at).toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        isik: r.isik_seviyesi,
        amper: Number(r.uretim_amper),
      })),
    [rows]
  );

  const arizalar = useMemo(() => arizalariGrupla(rows), [rows]);

  return { rows, latest, online, chartData, ozet, arizalar, loading, now };
}
