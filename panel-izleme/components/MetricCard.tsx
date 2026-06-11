import type { ReactNode } from "react";

export function MetricCard({
  icon,
  label,
  value,
  unit,
  accent = "text-amber-400",
  hint,
  children,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  unit?: string;
  accent?: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="glass fade-up flex flex-col gap-3 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-400">{label}</span>
        <span className={accent}>{icon}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tabular-nums">{value}</span>
        {unit && <span className="text-sm text-slate-400">{unit}</span>}
      </div>
      {children}
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </div>
  );
}
