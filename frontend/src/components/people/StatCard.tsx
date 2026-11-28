import type { ReactNode } from 'react';

interface Props { label: string; value: string | number; icon: ReactNode; color: string }

/** Compact metric panel shared across the management dashboards. */
export default function StatCard({ label, value, icon, color }: Props) {
  return (
    <div className="people-stat-card stat-card group flex items-center gap-3.5">
      <div className="p-3 rounded-2xl shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3" style={{ background: `linear-gradient(135deg, ${color}26, ${color}0F)`, color, boxShadow: `inset 0 0 0 1px ${color}22` }}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[22px] leading-none font-extrabold text-slate-800" style={{ fontFamily: 'Nunito, sans-serif' }}>{value}</div>
        <div className="text-xs font-semibold text-slate-500 truncate mt-1.5" style={{ overflowWrap: 'normal' }} title={label}>{label}</div>
      </div>
    </div>
  );
}
