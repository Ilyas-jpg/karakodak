"use client";

import { History, AlertTriangle } from "lucide-react";
import type { PanelVerisi, ArizaOlayi } from "@/lib/types";

function saat(iso: string) {
  return new Date(iso).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function HistoryTable({
  rows,
  arizalar,
}: {
  rows: PanelVerisi[];
  arizalar: ArizaOlayi[];
}) {
  const sonOkumalar = rows.slice(0, 12);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Son okumalar tablosu */}
      <div className="glass fade-up rounded-2xl p-5 lg:col-span-2">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-300">
          <History className="h-4 w-4 text-amber-400" /> Son Okumalar
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="pb-2 font-medium">Saat</th>
                <th className="pb-2 font-medium">Işık</th>
                <th className="pb-2 font-medium">Üretim</th>
                <th className="pb-2 font-medium">Yağış</th>
                <th className="pb-2 font-medium">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sonOkumalar.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    Henüz okuma yok.
                  </td>
                </tr>
              ) : (
                sonOkumalar.map((r) => (
                  <tr key={r.id} className="text-slate-300">
                    <td className="py-2 tabular-nums text-slate-400">
                      {saat(r.created_at)}
                    </td>
                    <td className="py-2 tabular-nums">%{r.isik_seviyesi}</td>
                    <td className="py-2 tabular-nums">
                      {Number(r.uretim_amper).toFixed(2)} A
                    </td>
                    <td className="py-2">{r.yagis_durumu ? "Yağmurlu" : "Kuru"}</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.durum === "ARIZA"
                            ? "bg-red-500/15 text-red-300"
                            : "bg-emerald-500/15 text-emerald-300"
                        }`}
                      >
                        {r.durum}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Arıza kaydı (gruplanmış olaylar) */}
      <div className="glass fade-up rounded-2xl p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-300">
          <AlertTriangle className="h-4 w-4 text-red-400" /> Arıza Kaydı
        </h3>
        {arizalar.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Kayıtlı arıza yok. 🎉
          </p>
        ) : (
          <ul className="space-y-3">
            {arizalar.slice(0, 8).map((a, i) => (
              <li
                key={i}
                className="rounded-xl border border-red-500/15 bg-red-500/5 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-red-300">{a.sebep}</span>
                  <span className="text-xs text-slate-500">{a.okumaSayisi} okuma</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {saat(a.baslangic)} – {saat(a.bitis)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
