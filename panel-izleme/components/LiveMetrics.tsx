"use client";

import { Sun, Zap, CloudRain, Droplets, Activity, ShieldAlert } from "lucide-react";
import type { PanelVerisi } from "@/lib/types";
import { MetricCard } from "./MetricCard";

export function LiveMetrics({ latest }: { latest: PanelVerisi | null }) {
  const isik = latest?.isik_seviyesi ?? 0;
  const amper = latest ? Number(latest.uretim_amper) : 0;
  const yagmur = latest?.yagis_durumu ?? false;
  const ariza = latest?.durum === "ARIZA";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        icon={<Sun className="h-5 w-5" />}
        label="Işık Seviyesi"
        value={latest ? isik : "—"}
        unit="%"
        accent="text-amber-400"
      >
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, isik))}%` }}
          />
        </div>
      </MetricCard>

      <MetricCard
        icon={<Zap className="h-5 w-5" />}
        label="Üretim (Akım)"
        value={latest ? amper.toFixed(2) : "—"}
        unit="A"
        accent="text-emerald-400"
        hint="Panelin anlık ürettiği akım"
      />

      <MetricCard
        icon={
          yagmur ? <CloudRain className="h-5 w-5" /> : <Droplets className="h-5 w-5" />
        }
        label="Yağış Durumu"
        value={latest ? (yagmur ? "Yağmurlu" : "Kuru") : "—"}
        accent={yagmur ? "text-sky-400" : "text-slate-300"}
        hint={yagmur ? "Yağmur algılandı" : "Yağış yok"}
      />

      <MetricCard
        icon={
          ariza ? <ShieldAlert className="h-5 w-5" /> : <Activity className="h-5 w-5" />
        }
        label="Sistem"
        value={latest ? (ariza ? "ARIZA" : "NORMAL") : "—"}
        accent={ariza ? "text-red-400" : "text-emerald-400"}
        hint={ariza ? "Kırmızı LED + buzzer aktif" : "Beyaz LED aktif"}
      />
    </div>
  );
}
