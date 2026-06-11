"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Nokta = { saat: string; isik: number; amper: number };

function TrendKart({
  baslik,
  data,
  dataKey,
  renk,
  birim,
}: {
  baslik: string;
  data: Nokta[];
  dataKey: "isik" | "amper";
  renk: string;
  birim: string;
}) {
  return (
    <div className="glass fade-up rounded-2xl p-5">
      <h3 className="mb-4 text-sm font-medium text-slate-300">{baslik}</h3>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={renk} stopOpacity={0.4} />
                <stop offset="95%" stopColor={renk} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="saat"
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={38}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(6,9,16,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                color: "#e8edf5",
                fontSize: 12,
              }}
              labelStyle={{ color: "#94a3b8" }}
              formatter={(v) => [`${v} ${birim}`, baslik]}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={renk}
              strokeWidth={2}
              fill={`url(#grad-${dataKey})`}
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function TrendCharts({ data }: { data: Nokta[] }) {
  if (!data.length) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-sm text-slate-500">
        Grafikler için yeterli veri henüz yok.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <TrendKart
        baslik="Işık Seviyesi (%)"
        data={data}
        dataKey="isik"
        renk="#f5a623"
        birim="%"
      />
      <TrendKart
        baslik="Üretim — Akım (A)"
        data={data}
        dataKey="amper"
        renk="#10b981"
        birim="A"
      />
    </div>
  );
}
