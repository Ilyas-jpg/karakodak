"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { PanelVerisi } from "@/lib/types";

function zamanFarki(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} sn önce`;
  const m = Math.floor(s / 60);
  return `${m} dk ${s % 60} sn önce`;
}

export function StatusHero({
  latest,
  online,
  now,
}: {
  latest: PanelVerisi | null;
  online: boolean;
  now: number;
}) {
  if (!latest) {
    return (
      <section className="glass fade-up rounded-3xl p-8 text-center">
        <p className="text-lg text-slate-300">Veri bekleniyor…</p>
        <p className="mt-1 text-sm text-slate-500">
          ESP32 cihazından ilk okuma henüz gelmedi.
        </p>
      </section>
    );
  }

  const ariza = latest.durum === "ARIZA";

  return (
    <section
      className={`fade-up relative overflow-hidden rounded-3xl border p-8 ${
        ariza
          ? "border-red-500/30 bg-red-500/5"
          : "border-emerald-500/25 bg-emerald-500/5"
      }`}
    >
      <div
        className={`pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full blur-3xl ${
          ariza ? "bg-red-500/20" : "bg-emerald-500/15"
        }`}
      />
      <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-5">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
              ariza ? "ariza-pulse bg-red-500/15" : "bg-emerald-500/15"
            }`}
          >
            {ariza ? (
              <AlertTriangle className="h-8 w-8 text-red-400" />
            ) : (
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-slate-400">
              Sistem Durumu
            </p>
            <h2
              className={`text-4xl font-bold ${
                ariza ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {ariza ? "ARIZA" : "NORMAL"}
            </h2>
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
              online
                ? "bg-emerald-500/10 text-emerald-300"
                : "bg-slate-500/10 text-slate-400"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                online ? "live-dot bg-emerald-400" : "bg-slate-500"
              }`}
            />
            {online ? "Cihaz çevrimiçi" : "Cihaz çevrimdışı"}
          </span>
          <span className="text-sm text-slate-400">
            Son güncelleme: {zamanFarki(latest.created_at, now)}
          </span>
        </div>
      </div>
    </section>
  );
}
