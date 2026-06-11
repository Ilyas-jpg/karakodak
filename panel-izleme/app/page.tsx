"use client";

import { Sun } from "lucide-react";
import { useRealtimeData } from "@/lib/useRealtimeData";
import { StatusHero } from "@/components/StatusHero";
import { LiveMetrics } from "@/components/LiveMetrics";
import { TrendCharts } from "@/components/Charts";
import { StatsSummary } from "@/components/StatsSummary";
import { HistoryTable } from "@/components/HistoryTable";

export default function Home() {
  const { latest, online, chartData, ozet, arizalar, rows, loading, now } =
    useRealtimeData();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 text-amber-400">
            <Sun className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Güneş Paneli İzleme
            </h1>
            <p className="text-sm text-slate-400">Karakodak · ESP32 canlı veri</p>
          </div>
        </div>
        <span className="text-xs text-slate-500">
          {loading ? "Bağlanıyor…" : `${rows.length} okuma yüklü`}
        </span>
      </header>

      <StatusHero latest={latest} online={online} now={now} />
      <LiveMetrics latest={latest} />
      <StatsSummary ozet={ozet} />
      <TrendCharts data={chartData} />
      <HistoryTable rows={rows} arizalar={arizalar} />

      <footer className="pt-4 text-center text-xs text-slate-600">
        Beyza · Bitirme Projesi — Güneş Paneli İzleme &amp; Arıza Tespit Sistemi
      </footer>
    </main>
  );
}
