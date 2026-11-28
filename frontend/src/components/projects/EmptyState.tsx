import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({ title, message, action, icon }: { title: string; message?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <div style={{ background: 'var(--soft-mint)', color: 'var(--primary-color)' }} className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3">{icon ?? <Inbox size={22} />}</div>
      <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</div>
      {message && <p className="text-[13px] text-slate-500 mt-1 max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
