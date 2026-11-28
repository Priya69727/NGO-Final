import { Check } from 'lucide-react';
import type { Stage, StageNo } from '../../types/project';

export default function StageStepper({ stages, current, compact = false, onSelect }: { stages: Stage[]; current: StageNo; compact?: boolean; onSelect?: (s: StageNo) => void }) {
  return (
    <ol className={`flex ${compact ? 'gap-1' : 'gap-2 overflow-x-auto pb-1'}`} aria-label="Project stages">
      {stages.map((s, i) => {
        const done = s.status === 'Completed', now = s.stage === current && !done;
        const dot = (
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
            style={{ background: done ? '#21865B' : now ? '#2A8C82' : 'var(--surface-muted)', color: done || now ? '#fff' : 'var(--text-secondary)', boxShadow: now ? '0 4px 10px rgba(42,140,130,.35)' : undefined }}>
            {done ? <Check size={13} /> : s.stage}
          </span>
        );
        const bar = <span className="flex-1 h-0.5 rounded" style={{ background: done ? '#21865B' : 'var(--surface-border)' }} />;
        if (compact) return (
          <li key={s.stage} className="flex items-center flex-1 min-w-0 gap-1" title={`Stage ${s.stage}: ${s.title}`}>{dot}{i < stages.length - 1 && bar}</li>
        );
        const Tag = onSelect ? 'button' : 'div';
        return (
          <li key={s.stage} className="flex-1 min-w-[150px]">
            <Tag type={onSelect ? 'button' : undefined} onClick={onSelect ? () => onSelect(s.stage) : undefined}
              className={`w-full text-left rounded-xl border p-3 h-full ${now ? 'border-teal-400 bg-teal-50 shadow-sm' : 'border-slate-200 bg-white'} ${onSelect ? 'hover:border-teal-300 hover:-translate-y-0.5 hover:shadow-md transition cursor-pointer' : ''}`}>
              <div className="flex items-center gap-2 mb-1.5">{dot}<span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Stage {s.stage}</span></div>
              <div className="text-[12.5px] font-semibold text-slate-700 leading-snug">{s.title}</div>
              <div className="text-[11px] text-slate-400 mt-1">{s.status}{s.status === 'In Progress' ? ` · ${s.progress}%` : ''}</div>
            </Tag>
          </li>
        );
      })}
    </ol>
  );
}
