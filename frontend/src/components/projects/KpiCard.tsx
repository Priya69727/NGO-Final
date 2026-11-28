import type { ReactNode } from 'react';

export default function KpiCard({ label, value, sub, color = '#1AACB8', icon }: { label: string; value: ReactNode; sub?: ReactNode; color?: string; icon?: ReactNode }) {
  return (
    <div className="stat-card group" style={{ padding: '18px 20px', backgroundImage: `radial-gradient(120% 140% at 100% 0%, ${color}14 0%, transparent 55%)` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 truncate" style={{ overflowWrap: 'normal' }} title={label}>{label}</div>
          <div className="text-[26px] leading-tight font-extrabold truncate mt-1.5" style={{ color, fontFamily: 'Nunito, sans-serif' }}>{value}</div>
          {sub && <div className="text-[11.5px] text-slate-400 mt-1">{sub}</div>}
        </div>
        {icon && (
          <div className="p-2.5 rounded-xl flex-shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3" style={{ background: `linear-gradient(135deg, ${color}26, ${color}0F)`, color, boxShadow: `inset 0 0 0 1px ${color}22` }}>{icon}</div>
        )}
      </div>
    </div>
  );
}
