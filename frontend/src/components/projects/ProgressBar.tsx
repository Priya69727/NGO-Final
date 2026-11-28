export default function ProgressBar({ value, color = '#2A8C82', height = 8, showLabel = false, label }: { value: number; color?: string; height?: number; showLabel?: boolean; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="progress-track flex-1 rounded-full overflow-hidden" style={{ height }} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? 'Progress'}>
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: `linear-gradient(90deg, ${color}CC, ${color})`, transition: 'width 600ms cubic-bezier(0.22, 1, 0.36, 1)' }} />
      </div>
      {showLabel && <span className="w-9 text-right text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>{v}%</span>}
    </div>
  );
}
