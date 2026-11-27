import { Link } from 'react-router-dom';
import { Briefcase, CalendarDays, ClipboardList, GraduationCap, UserCheck, ArrowRight, Sparkles, ShieldCheck, type LucideIcon } from 'lucide-react';
import { ACCENT } from '../../components/people';

const MODULES: { to: string; title: string; desc: string; color: string; Icon: LucideIcon; tabs: string[] }[] = [
  { to: '/people-management/hr', title: 'HR Management', desc: 'Employees, departments, requirements, attendance & performance.', color: ACCENT.hr, Icon: Briefcase, tabs: ['Dashboard', 'Departments', 'Employees', 'Requirements', 'Attendance & Leave', 'Performance', 'Reports'] },
  { to: '/people-management/interns', title: 'Intern Management', desc: 'Applications pipeline, internship work, feedback & certificates.', color: ACCENT.intern, Icon: GraduationCap, tabs: ['Dashboard', 'Applications', 'Intern List', 'Internship Work', 'Attendance & Feedback', 'Completion & Certificate', 'Reports'] },
  { to: '/people-management/volunteers', title: 'Volunteer Management', desc: 'Applications, assignments, availability, attendance & recognition.', color: ACCENT.volunteer, Icon: UserCheck, tabs: ['Dashboard', 'Applications', 'Volunteer List', 'Assignments', 'Skills & Availability', 'Attendance', 'Performance & Feedback', 'Certificates & Recognition', 'Reports'] },
];

export default function PeopleIndex() {
  return (
    <div className="flex flex-col gap-6">
      <section className="people-overview-hero relative overflow-hidden rounded-[24px] px-6 py-7 text-white shadow-[0_18px_40px_rgba(36,50,71,0.18)] md:px-8 md:py-9">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-teal-200"><Sparkles size={15} /> People operations hub</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">People Management</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-200 md:text-base">Build a thoughtful employee, intern, and volunteer experience from one calm, connected workspace.</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {['3 people teams', 'Shared workforce tools', 'Live operational data'].map(item => <span key={item} className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100 backdrop-blur-sm">{item}</span>)}
          </div>
        </div>
        <div className="people-overview-orbit absolute -right-16 -top-20 hidden h-72 w-72 rounded-full border border-teal-200/20 md:block" />
        <div className="people-overview-orbit people-overview-orbit--small absolute -bottom-24 right-24 hidden h-52 w-52 rounded-full border border-white/10 md:block" />
        <div className="absolute bottom-6 right-8 hidden max-w-[220px] rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md lg:block">
          <ShieldCheck size={18} className="text-teal-200" />
          <p className="mt-2 text-sm font-bold">One connected view</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">From first application to everyday contribution.</p>
        </div>
      </section>

      <div className="flex items-end justify-between gap-3">
        <div><h2 className="text-xl font-black tracking-tight text-slate-900">Choose a people team</h2><p className="mt-1 text-sm text-slate-500">Jump into the workspace that needs your attention.</p></div>
        <span className="hidden text-xs font-bold uppercase tracking-[0.14em] text-teal-700 sm:block">Mission, people, impact</span>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {MODULES.map(({ to, title, desc, color, Icon, tabs }) => (
          <Link key={to} to={to} className="people-overview-module-card card group flex min-h-[250px] flex-col gap-4 overflow-hidden p-5 transition duration-200 hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" style={{ borderTop: `4px solid ${color}` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-2xl p-3.5 shadow-sm" style={{ background: `${color}1A`, color }}><Icon size={24} /></div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{tabs.length} work areas</span>
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-800" style={{ fontFamily: 'Nunito, sans-serif' }}>{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tabs.slice(0, 2).map(t => <span key={t} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500">{t}</span>)}
              {tabs.length > 2 && <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500">+{tabs.length - 2} more</span>}
            </div>
            <span className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-bold text-teal-800">
              Open workspace <ArrowRight className="transition-transform group-hover:translate-x-1" size={17} />
            </span>
          </Link>))}
      </div>
      <section>
        <div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="text-xl font-black tracking-tight text-slate-900">Shared workforce tools</h2><p className="mt-1 text-sm text-slate-500">See schedules and responsibilities across all People teams.</p></div><ClipboardList size={22} className="text-teal-700" /></div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            { to: '/people-management/calendar', title: 'People calendar', detail: 'Tasks, deadlines, attendance, interviews, and events.', Icon: CalendarDays },
            { to: '/people-management/tasks', title: 'Task tracking', detail: 'Assign and follow work across the organization.', Icon: ClipboardList },
            { to: '/people-management/attendance', title: 'Attendance overview', detail: 'Review records and identify missing entries.', Icon: UserCheck },
          ].map(({ to, title, detail, Icon }) => (
            <Link key={to} to={to} className="people-overview-tool-card card group flex items-start gap-3 p-4 transition hover:-translate-y-0.5">
              <span className="rounded-xl bg-teal-50 p-2.5 text-teal-800 shadow-sm"><Icon size={18} /></span>
              <span className="min-w-0 flex-1"><span className="block font-bold text-slate-800">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{detail}</span></span>
              <ArrowRight size={15} className="mt-1 text-slate-400 transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
