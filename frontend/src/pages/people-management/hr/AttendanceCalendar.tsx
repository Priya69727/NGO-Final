import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, UserMinus, UserCheck, UserX, BriefcaseBusiness } from 'lucide-react';
import { getIndianNationalHolidays } from '../../../data/nationalHolidays';
import { listEvents, type EventRecord } from '../../../services/eventApi';
import { peopleApi, type HrApplicant, type StaffAttendanceRecord, type StaffLeaveApplication, type StaffProfile } from '../../../services/peopleApi';

interface Props {
  employees: StaffProfile[];
  attendanceRecords: StaffAttendanceRecord[];
  leaves: StaffLeaveApplication[];
}

type ActivityKind = 'holiday' | 'event' | 'interview' | 'attendance' | 'leave';
interface CalendarActivity {
  id: string;
  title: string;
  kind: ActivityKind;
  detail?: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseCalendarDate(value: string) {
  const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatEventDate(value: string) {
  const date = parseCalendarDate(value);
  return date
    ? `${date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · ${date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`
    : value;
}

const ACTIVITY_STYLE: Record<ActivityKind, string> = {
  holiday: 'border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200',
  event: 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200',
  interview: 'border-violet-500 bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200',
  attendance: 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  leave: 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
};

function SummaryCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: string }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}>{icon}</span>
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-0.5 text-xl font-black text-slate-900 dark:text-slate-100">{value}</p>
      </div>
    </div>
  );
}

export default function AttendanceCalendar({ employees, attendanceRecords, leaves }: Props) {
  const today = new Date();
  const [monthDate, setMonthDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [monthEvents, setMonthEvents] = useState<EventRecord[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventRecord[]>([]);
  const [applicants, setApplicants] = useState<HrApplicant[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarError, setCalendarError] = useState('');
  const [upcomingError, setUpcomingError] = useState('');
  const [interviewError, setInterviewError] = useState('');

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  useEffect(() => {
    let active = true;
    setCalendarLoading(true);
    setCalendarError('');
    const from = new Date(year, month, 1).toISOString();
    const to = new Date(year, month + 1, 1).toISOString();
    void listEvents({ from, to, limit: 200 })
      .then(result => {
        if (active) setMonthEvents(result.items);
      })
      .catch(error => {
        if (active) setCalendarError(error instanceof Error ? error.message : 'Unable to load calendar events.');
      })
      .finally(() => {
        if (active) setCalendarLoading(false);
      });
    return () => { active = false; };
  }, [year, month]);

  useEffect(() => {
    let active = true;
    void listEvents({ from: new Date().toISOString(), limit: 100 })
      .then(result => {
        if (active) {
          setUpcomingEvents(result.items.filter(event => event.status !== 'Cancelled' && new Date(event.startsAt) >= new Date()).slice(0, 5));
        }
      })
      .catch(error => {
        if (active) setUpcomingError(error instanceof Error ? error.message : 'Unable to load upcoming events.');
      });
    void peopleApi.getApplicants({ limit: 200 })
      .then(result => {
        if (active) setApplicants(result.items);
      })
      .catch(error => {
        if (active) setInterviewError(error instanceof Error ? error.message : 'Unable to load interview records.');
      });
    return () => { active = false; };
  }, []);

  const activitiesByDay = useMemo(() => {
    const activities = new Map<number, CalendarActivity[]>();
    const addActivity = (date: Date | null, activity: CalendarActivity) => {
      if (!date || date.getFullYear() !== year || date.getMonth() !== month) return;
      activities.set(date.getDate(), [...(activities.get(date.getDate()) ?? []), activity]);
    };

    for (const holiday of getIndianNationalHolidays(year)) {
      const [holidayYear, holidayMonth, holidayDay] = holiday.date.split('-').map(Number);
      if (holidayYear === year && holidayMonth === month + 1) {
        addActivity(new Date(year, month, holidayDay), {
          id: `holiday-${holiday.date}`,
          title: holiday.name,
          kind: 'holiday',
          detail: 'India national holiday',
        });
      }
    }

    for (const event of monthEvents) {
      addActivity(parseCalendarDate(event.startsAt), {
        id: `event-${event.id}`,
        title: event.title,
        kind: 'event',
        detail: `${event.eventType}${event.status === 'Cancelled' ? ' · Cancelled' : ''}`,
      });
    }

    for (const applicant of applicants) {
      if (!applicant.interviewDate) continue;
      addActivity(parseCalendarDate(applicant.interviewDate), {
        id: `interview-${applicant.id}`,
        title: applicant.fullName,
        kind: 'interview',
        detail: 'Interview',
      });
    }

    const employeeNames = new Map(employees.map(employee => [employee.id, employee.fullName]));
    for (const record of attendanceRecords) {
      addActivity(parseCalendarDate(record.attendanceDate), {
        id: `attendance-${record.id}`,
        title: `${employeeNames.get(record.staffId) ?? 'Employee'} · ${record.status}`,
        kind: 'attendance',
        detail: 'Attendance',
      });
    }

    for (const leave of leaves) {
      if (leave.status !== 'Approved' && leave.status !== 'Pending') continue;
      for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day += 1) {
        const key = dateKey(year, month, day);
        if (key >= leave.startsOn.slice(0, 10) && key <= leave.endsOn.slice(0, 10)) {
          addActivity(new Date(year, month, day), {
            id: `leave-${leave.id}-${key}`,
            title: `${employeeNames.get(leave.staffId) ?? 'Employee'} · Leave`,
            kind: 'leave',
            detail: leave.status,
          });
        }
      }
    }
    return activities;
  }, [applicants, attendanceRecords, employees, leaves, month, monthEvents, year]);

  const monthlyAttendance = attendanceRecords.filter(record => {
    const date = parseCalendarDate(record.attendanceDate);
    return date?.getFullYear() === year && date.getMonth() === month;
  });
  const leaveIds = new Set(monthlyAttendance.filter(record => record.status === 'Leave').map(record => record.staffId));
  for (const leave of leaves) {
    if (leave.status === 'Approved' && leave.startsOn.slice(0, 7) <= `${year}-${String(month + 1).padStart(2, '0')}` && leave.endsOn.slice(0, 7) >= `${year}-${String(month + 1).padStart(2, '0')}`) {
      leaveIds.add(leave.staffId);
    }
  }
  const lateMarks = monthlyAttendance.filter(record => record.status === 'Late').length;
  const presentEmployees = new Set(monthlyAttendance.filter(record => record.status === 'Present' || record.status === 'Half Day').map(record => record.staffId)).size;
  const absentEmployees = new Set(monthlyAttendance.filter(record => record.status === 'Absent').map(record => record.staffId)).size;
  const interviewsConducted = applicants.filter(applicant => {
    if (!applicant.interviewDate) return false;
    const date = parseCalendarDate(applicant.interviewDate);
    return date && date.getFullYear() === year && date.getMonth() === month && date <= today;
  }).length;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const changeMonth = (amount: number) => {
    setMonthDate(current => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="card overflow-hidden" aria-labelledby="upcoming-events-heading">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <CalendarDays size={17} className="text-blue-600" />
            <h2 id="upcoming-events-heading" className="card-title">Upcoming Events</h2>
          </div>
        </div>
        <div className="card-body">
          {upcomingError && <p role="alert" className="mb-3 text-sm text-rose-700">{upcomingError}</p>}
          {upcomingEvents.length ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {upcomingEvents.map(event => (
                <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{event.title}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><Clock3 size={13} />{formatEventDate(event.startsAt)}</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">{event.eventType}</span>
                </div>
              ))}
            </div>
          ) : !upcomingError ? (
            <p className="text-sm text-slate-500">No upcoming events are scheduled.</p>
          ) : null}
        </div>
      </section>

      <section className="card overflow-hidden" aria-labelledby="attendance-calendar-heading">
        <div className="card-header flex-wrap gap-3">
          <div>
            <h2 id="attendance-calendar-heading" className="card-title">Attendance Calendar</h2>
            <p className="mt-1 text-xs text-slate-500">National holidays, events, interviews, attendance and leave</p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-blue-700 dark:hover:bg-slate-800"><ChevronLeft size={18} /></button>
            <h3 className="min-w-32 text-center text-sm font-extrabold text-slate-800 dark:text-slate-100">{MONTHS[month]} {year}</h3>
            <button type="button" aria-label="Next month" onClick={() => changeMonth(1)} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-blue-700 dark:hover:bg-slate-800"><ChevronRight size={18} /></button>
          </div>
        </div>
        <div className="card-body">
          <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2">
            {([
              ['holiday', 'National holiday'],
              ['event', 'Event'],
              ['interview', 'Interview'],
              ['attendance', 'Attendance'],
              ['leave', 'Leave'],
            ] as [ActivityKind, string][]).map(([kind, label]) => (
              <span key={kind} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span className={`h-2.5 w-2.5 rounded-sm border-l-2 ${ACTIVITY_STYLE[kind]}`} />
                {label}
              </span>
            ))}
          </div>
          {calendarError && <p role="alert" className="mb-3 text-sm text-rose-700">{calendarError}</p>}
          <div className="grid grid-cols-7 border-l border-t border-slate-200 dark:border-slate-700">
            {WEEKDAYS.map(day => <div key={day} className="border-b border-r border-slate-200 bg-slate-50 px-1 py-2 text-center text-[10px] font-bold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 sm:text-xs">{day}</div>)}
            {cells.map((day, index) => {
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const activities = day ? activitiesByDay.get(day) ?? [] : [];
              return (
                <div key={`${year}-${month}-${index}`} className={`min-h-24 border-b border-r border-slate-200 p-1.5 dark:border-slate-700 sm:min-h-28 sm:p-2 ${isToday ? 'bg-blue-50/60 dark:bg-blue-950/20' : 'bg-white dark:bg-slate-900'}`}>
                  {day && (
                    <>
                      <span className={`mb-1 grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${isToday ? 'bg-blue-600 text-white' : 'text-slate-700 dark:text-slate-200'}`}>{day}</span>
                      <div className="flex flex-col gap-1">
                        {activities.slice(0, 3).map(activity => (
                          <div key={activity.id} title={`${activity.detail ? `${activity.detail}: ` : ''}${activity.title}`} className={`truncate border-l-2 px-1 py-0.5 text-[9px] font-semibold leading-4 sm:text-[10px] ${ACTIVITY_STYLE[activity.kind]}`}>
                            {activity.kind === 'holiday' ? activity.title : `${activity.kind === 'interview' ? 'Interview' : activity.kind === 'attendance' ? 'Attendance' : activity.kind === 'leave' ? 'Leave' : 'Event'} · ${activity.title}`}
                          </div>
                        ))}
                        {activities.length > 3 && <span className="px-1 text-[9px] font-bold text-slate-500">+{activities.length - 3} more</span>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {calendarLoading && <p role="status" className="mt-3 text-xs text-slate-500">Loading events…</p>}
        </div>
      </section>

      <section aria-label={`Attendance statistics for ${MONTHS[month]} ${year}`} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Employees on leave" value={leaveIds.size} icon={<UserMinus size={18} />} tone="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" />
        <SummaryCard label="Late arrivals (marks)" value={lateMarks} icon={<Clock3 size={18} />} tone="bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300" />
        <SummaryCard label="Employees present" value={presentEmployees} icon={<UserCheck size={18} />} tone="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" />
        <SummaryCard label="Employees absent" value={absentEmployees} icon={<UserX size={18} />} tone="bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" />
      </section>

      <section className="card flex flex-wrap items-center gap-4 p-4" aria-label={`Interview statistics for ${MONTHS[month]} ${year}`}>
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"><BriefcaseBusiness size={19} /></span>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Monthly Interview Statistics</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Interviews conducted during {MONTHS[month]} {year}</p>
          {interviewError && <p role="alert" className="mt-1 text-xs text-rose-700">{interviewError}</p>}
        </div>
        <div className="text-2xl font-black text-violet-700 dark:text-violet-300">{interviewError ? '—' : interviewsConducted}</div>
      </section>
    </div>
  );
}
