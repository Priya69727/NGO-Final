import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({ title, message, action, icon }: { title: string; message?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-4">
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-3xl bg-teal-500/15 blur-xl" aria-hidden />
        <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-teal-600" style={{ background: 'linear-gradient(135deg, rgba(42,140,130,0.16), rgba(42,140,130,0.05))', boxShadow: 'inset 0 0 0 1px rgba(42,140,130,0.2)' }}>{icon ?? <Inbox size={24} />}</div>
      </div>
      <div className="text-sm font-bold text-slate-700">{title}</div>
      {message && <p className="text-[13px] text-slate-500 mt-1 max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
