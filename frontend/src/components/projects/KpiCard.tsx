import type { CSSProperties, ReactNode } from 'react';

export default function KpiCard({ label, value, sub, color = '#2A8C82', icon }: { label: string; value: ReactNode; sub?: ReactNode; color?: string; icon?: ReactNode }) {
  return (
    <div className="stat-card kpi-tile" style={{ '--kpi-color': color, padding: '16px 18px 16px 22px' } as CSSProperties}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11.5px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-1 truncate text-[26px] font-extrabold leading-tight" style={{ color: 'var(--text-primary)', fontFamily: 'Nunito, sans-serif' }}>{value}</div>
          {sub && <div className="mt-0.5 text-[11.5px] text-slate-400">{sub}</div>}
        </div>
        {icon && <div className="kpi-tile-icon" style={{ background: `${color}1F`, color }}>{icon}</div>}
      </div>
    </div>
  );
}
