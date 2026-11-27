import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; accent?: string }

/** Centered detail dialog used for every profile / detail view. */
export default function DetailDrawer({ open, onClose, title, subtitle, children, accent = '#1AACB8' }: Props) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!open) { setShown(false); return; }
    const raf = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="people-window fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className={`people-window-backdrop absolute inset-0 bg-slate-900/40 ${shown ? 'is-visible' : ''}`} onClick={onClose} aria-hidden />
      <aside
        role="dialog" aria-modal="true" aria-label={title}
        className={`people-window-panel relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl ${shown ? 'is-visible' : ''}`}
      >
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-100" style={{ borderTop: `3px solid ${accent}` }}>
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-slate-800 truncate" style={{ fontFamily: 'Nunito, sans-serif' }}>{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button className="people-close-button" onClick={onClose} aria-label="Close panel" title="Close"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </aside>
    </div>
  );
}
