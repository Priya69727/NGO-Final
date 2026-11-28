import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props { open: boolean; onClose: () => void; title: string; onSubmit: () => void | Promise<void>; submitLabel?: string; children: ReactNode; wide?: boolean }

/** Form modal: Enter / submit button calls onSubmit; Escape or backdrop closes. */
export default function Modal({ open, onClose, title, onSubmit, submitLabel = 'Save', children, wide = false }: Props) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!open) { setShown(false); return; }
    const raf = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;
  const submit = (e: FormEvent) => { e.preventDefault(); void onSubmit(); };
  return (
    <div className="people-window fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className={`people-window-backdrop absolute inset-0 bg-slate-900/40 ${shown ? 'is-visible' : ''}`} onClick={onClose} aria-hidden />
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-label={title} className={`people-window-panel relative bg-white rounded-[22px] shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] flex flex-col ${shown ? 'is-visible' : ''}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-black text-slate-800" style={{ fontFamily: 'Nunito, sans-serif' }}>{title}</h2>
          <button type="button" className="people-close-button" onClick={onClose} aria-label="Close dialog" title="Close"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">{submitLabel}</button>
        </div>
      </form>
    </div>
  );
}
