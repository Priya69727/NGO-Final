export default function ProgressBar({ value, color = '#1AACB8', height = 6, showLabel = false, label }: { value: number; color?: string; height?: number; showLabel?: boolean; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="progress-track flex-1" style={{ height }} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? 'Progress'}>
        <div className="progress-fill" style={{ width: `${v}%`, background: `linear-gradient(90deg, ${color}CC, ${color})` }} />
      </div>
      {showLabel && <span className="text-xs font-bold text-slate-600 w-9 text-right tabular-nums">{v}%</span>}
    </div>
  );
}
