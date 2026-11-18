import { useEffect, useState } from 'react';
import { CalendarDays, ListChecks } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/apiClient';

interface Reminders {
  upcomingEvents: { title: string; date: string; location: string; type: string }[];
  pendingTasks: { task: string; priority: string; due: string }[];
}

/** Landing page for Volunteer and Board roles (limited, read-only workspace). */
export default function RoleHome() {
  const { user } = useAuth();
  const [data, setData] = useState<Reminders | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<Reminders>('/dashboard/reminders').then(setData).catch(e => setError(e instanceof Error ? e.message : 'Could not load your workspace.'));
  }, []);

  const isVolunteer = user?.role === 'Volunteer';
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold text-slate-900">Welcome, {user?.fullName}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {isVolunteer ? 'Your assigned tasks and the events coming up.' : 'Upcoming events across the organisation. Board access is read-only.'}
      </p>
      {isVolunteer && <Link className="mt-4 inline-flex rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800" to="/people-management/tasks">Open task tracker</Link>}
      {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {!data && !error && <p role="status" className="mt-6 text-sm text-slate-500">Loading…</p>}
      {data && (
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-2 font-semibold text-slate-800"><CalendarDays size={18} />Upcoming events</h2>
            {data.upcomingEvents.length === 0 ? <p className="mt-3 text-sm text-slate-500">No upcoming events.</p> : (
              <ul className="mt-3 divide-y divide-slate-100">
                {data.upcomingEvents.map((e, i) => (
                  <li key={i} className="py-2.5 text-sm"><p className="font-medium text-slate-800">{e.title}</p><p className="text-slate-500">{e.date} · {e.location}</p></li>
                ))}
              </ul>
            )}
          </section>
          {isVolunteer && (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="flex items-center gap-2 font-semibold text-slate-800"><ListChecks size={18} />My pending tasks</h2>
              {data.pendingTasks.length === 0 ? <p className="mt-3 text-sm text-slate-500">You have no pending tasks.</p> : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {data.pendingTasks.map((t, i) => (
                    <li key={i} className="py-2.5 text-sm"><p className="font-medium text-slate-800">{t.task}</p><p className="text-slate-500">{t.priority} priority · due {t.due}</p></li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
