"use client";

import type { ReactNode } from "react";
import { TrendingUp, Sun, ShieldAlert, Database } from "lucide-react";
import type { GunlukOzet } from "@/lib/types";

function StatTile({
  icon,
  etiket,
  deger,
  accent,
}: {
  icon: ReactNode;
  etiket: string;
  deger: ReactNode;
  accent: string;
}) {
  return (
    <div className="glass fade-up flex items-center gap-3 rounded-2xl p-4">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 ${accent}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-slate-400">{etiket}</p>
        <p className="text-lg font-semibold tabular-nums">{deger}</p>
      </div>
    </div>
  );
}

export function StatsSummary({ ozet }: { ozet: GunlukOzet | null }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatTile
        icon={<TrendingUp className="h-5 w-5" />}
        etiket="Bugün ort. üretim"
        deger={ozet?.ort_uretim != null ? `${ozet.ort_uretim} A` : "—"}
        accent="text-emerald-400"
      />
      <StatTile
        icon={<Sun className="h-5 w-5" />}
        etiket="Bugün max ışık"
        deger={ozet?.max_isik != null ? `%${ozet.max_isik}` : "—"}
        accent="text-amber-400"
      />
      <StatTile
        icon={<ShieldAlert className="h-5 w-5" />}
        etiket="Bugün arıza"
        deger={ozet?.ariza_sayisi ?? 0}
        accent="text-red-400"
      />
      <StatTile
        icon={<Database className="h-5 w-5" />}
        etiket="Bugün okuma"
        deger={ozet?.toplam_okuma ?? 0}
        accent="text-sky-400"
      />
    </div>
  );
}
