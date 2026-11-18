import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Filter, Plus, Search, Users, X } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getProjects } from '../../services/projectApi';
import { useAuth } from '../../context/AuthContext';
import {
  peopleApi,
  type Department,
  type InternProfile,
  type PeopleAssigneeType,
  type PeopleCalendarEvent,
  type PeopleTask,
  type PeopleTaskPriority,
  type PeopleTaskStatus,
  type StaffAttendanceRecord,
  type StaffProfile,
  type InternAttendanceRecord,
  type VolunteerAttendanceRecord,
  type VolunteerProfile,
} from '../../services/peopleApi';
import { Modal, PageHeader, PageTabs, SelectField, TextAreaField, TextField, ACCENT } from '../../components/people';
import type { Project } from '../../types/project';

type ViewMode = 'month' | 'week' | 'day';
type PersonOption = { id: string; type: PeopleAssigneeType; name: string; departmentId?: string | null };
type AttendanceEntry = {
  id: string;
  personId: string;
  personType: PeopleAssigneeType;
  personName: string;
  attendanceDate: string;
  status: string;
  departmentId?: string | null;
  hours?: number;
  record: StaffAttendanceRecord | InternAttendanceRecord | VolunteerAttendanceRecord;
};

const today = () => localDateKey(new Date());
const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};
const shiftDate = (date: Date, amount: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount, 12);
const startOfWeek = (date: Date) => shiftDate(date, -date.getDay());
const days = (start: Date, count: number) => Array.from({ length: count }, (_, index) => shiftDate(start, index));
const dateLabel = (value: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) =>
  parseDate(value).toLocaleDateString(undefined, options);
const peopleLabel = (person: PersonOption) => `${person.name} · ${person.type}`;
const dateBetween = (date: string, from: string, to: string) => date.slice(0, 10) >= from && date.slice(0, 10) <= to;

function getPersonName(personId: string, type: PeopleAssigneeType, people: PersonOption[]) {
  return people.find(person => person.id === personId && person.type === type)?.name ?? 'Unknown person';
}

function FieldError({ children }: { children?: string }) {
  return children ? <p className="mt-1 text-xs text-rose-600" role="alert">{children}</p> : null;
}

function TaskForm({
  open,
  onClose,
  onSave,
  task,
  people,
  departments,
  projects,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string; description: string; assigneeType: PeopleAssigneeType; assigneeId: string;
    startDate: string; dueDate: string; priority: PeopleTaskPriority; status: Exclude<PeopleTaskStatus, 'Overdue'>;
    departmentId?: string; projectId?: string;
  }, id?: string) => Promise<void>;
  task: PeopleTask | null;
  people: PersonOption[];
  departments: Department[];
  projects: Project[];
}) {
  const initialAssignee = task
    ? task.staffId ? `Employee:${task.staffId}` : task.internId ? `Intern:${task.internId}` : `Volunteer:${task.volunteerId}`
    : '';
  const [form, setForm] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    assignee: initialAssignee,
    startDate: task?.startsOn ?? today(),
    dueDate: task?.dueDate ?? localDateKey(shiftDate(new Date(), 7)),
    priority: (task?.priority ?? 'Medium') as PeopleTaskPriority,
    status: (task?.status === 'Overdue' ? 'Not Started' : task?.status ?? 'Not Started') as Exclude<PeopleTaskStatus, 'Overdue'>,
    departmentId: task?.departmentId ?? '',
    projectId: task?.projectId ?? '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const assignee = task
      ? task.staffId ? `Employee:${task.staffId}` : task.internId ? `Intern:${task.internId}` : `Volunteer:${task.volunteerId}`
      : '';
    setForm({
      title: task?.title ?? '',
      description: task?.description ?? '',
      assignee,
      startDate: task?.startsOn ?? today(),
      dueDate: task?.dueDate ?? localDateKey(shiftDate(new Date(), 7)),
      priority: task?.priority ?? 'Medium',
      status: task?.status === 'Overdue' ? 'Not Started' : task?.status ?? 'Not Started',
      departmentId: task?.departmentId ?? '',
      projectId: task?.projectId ?? '',
    });
    setError('');
  }, [task, open]);

  const save = async () => {
    setError('');
    if (!form.title.trim()) { setError('Task title is required.'); return; }
    if (!form.description.trim()) { setError('Task description is required.'); return; }
    if (!form.assignee) { setError('Select the person responsible for this task.'); return; }
    if (form.dueDate < form.startDate) { setError('Due date cannot be earlier than the start date.'); return; }
    const [assigneeType, assigneeId] = form.assignee.split(':') as [PeopleAssigneeType, string];
    setSaving(true);
    try {
      await onSave({
        title: form.title.trim(),
        description: form.description.trim(),
        assigneeType,
        assigneeId,
        startDate: form.startDate,
        dueDate: form.dueDate,
        priority: form.priority,
        status: form.status,
        departmentId: form.departmentId || undefined,
        projectId: form.projectId || undefined,
      }, task?.id);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save task. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={task ? 'Edit task' : 'Assign a task'} submitLabel={saving ? 'Saving…' : task ? 'Save changes' : 'Create task'} onSubmit={save} wide>
      {error && <div className="col-span-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</div>}
      <TextField label="Task title" value={form.title} required onChange={title => setForm(current => ({ ...current, title }))} placeholder="e.g. Prepare monthly field report" />
      <SelectField
        label="Assigned person"
        required
        value={form.assignee}
        onChange={assignee => setForm(current => ({ ...current, assignee }))}
        options={[{ label: 'Choose a person…', value: '' }, ...people.map(person => ({ label: peopleLabel(person), value: `${person.type}:${person.id}` }))]}
      />
      <TextAreaField label="Task description" value={form.description} required onChange={description => setForm(current => ({ ...current, description }))} placeholder="Describe the expected outcome and any context." />
      <TextField label="Start date" type="date" value={form.startDate} required onChange={startDate => setForm(current => ({ ...current, startDate }))} />
      <TextField label="Due date" type="date" value={form.dueDate} required onChange={dueDate => setForm(current => ({ ...current, dueDate }))} />
      <SelectField label="Priority" value={form.priority} required onChange={priority => setForm(current => ({ ...current, priority: priority as PeopleTaskPriority }))} options={['Low', 'Medium', 'High', 'Critical']} />
      <SelectField label="Status" value={form.status} required onChange={status => setForm(current => ({ ...current, status: status as Exclude<PeopleTaskStatus, 'Overdue'> }))} options={['Not Started', 'In Progress', 'On Hold', 'Completed']} />
      <SelectField label="Department (optional)" value={form.departmentId} onChange={departmentId => setForm(current => ({ ...current, departmentId }))} options={[{ label: 'No department', value: '' }, ...departments.map(department => ({ label: department.name, value: department.id }))]} />
      <SelectField label="Related project (optional)" value={form.projectId} onChange={projectId => setForm(current => ({ ...current, projectId }))} options={[{ label: 'No project', value: '' }, ...projects.map(project => ({ label: project.name, value: project.id }))]} />
    </Modal>
  );
}

function CalendarView() {
  const [view, setView] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [events, setEvents] = useState<PeopleCalendarEvent[]>([]);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [personFilter, setPersonFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState<PeopleCalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const range = useMemo(() => {
    if (view === 'day') {
      const key = localDateKey(anchor);
      return { from: key, to: key, dates: [anchor] };
    }
    if (view === 'week') {
      const start = startOfWeek(anchor);
      const dates = days(start, 7);
      return { from: localDateKey(dates[0]), to: localDateKey(dates[6]), dates };
    }
    const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
    const first = startOfWeek(monthStart);
    const dates = days(first, 42);
    return { from: localDateKey(dates[0]), to: localDateKey(dates[41]), dates };
  }, [anchor, view]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [calendar, departmentResponse, employeeResponse, internResponse, volunteerResponse] = await Promise.all([
        peopleApi.getPeopleCalendar({
          dateFrom: range.from,
          dateTo: range.to,
          ...(personFilter ? { personId: personFilter.split(':')[1], personType: personFilter.split(':')[0] } : {}),
          ...(departmentFilter ? { departmentId: departmentFilter } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(typeFilter ? { eventType: typeFilter } : {}),
        }),
        peopleApi.getDepartments(),
        peopleApi.getEmployees({ limit: 200 }),
        peopleApi.getInternProfiles({ limit: 200 }),
        peopleApi.getVolunteers({ limit: 200 }),
      ]);
      setEvents(calendar.items);
      setDepartments(departmentResponse.items);
      setPeople([
        ...employeeResponse.items.map(person => ({ id: person.id, type: 'Employee' as const, name: person.fullName, departmentId: person.departmentId })),
        ...internResponse.items.map(person => ({ id: person.id, type: 'Intern' as const, name: person.fullName ?? person.internCode ?? 'Intern', departmentId: person.departmentId })),
        ...volunteerResponse.items.map(person => ({ id: person.id, type: 'Volunteer' as const, name: person.fullName, departmentId: null })),
      ]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load calendar data.');
    } finally {
      setLoading(false);
    }
  }, [departmentFilter, personFilter, range.from, range.to, statusFilter, typeFilter]);

  useEffect(() => { void load(); }, [load]);

  const move = (direction: number) => {
    const increment = view === 'month' ? 1 : view === 'week' ? 7 : 1;
    setAnchor(current => view === 'month'
      ? new Date(current.getFullYear(), current.getMonth() + direction, 1, 12)
      : shiftDate(current, increment * direction));
    setSelected(null);
  };
  const heading = view === 'month'
    ? anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : view === 'week'
      ? `${dateLabel(range.from)} – ${dateLabel(range.to, { month: 'short', day: 'numeric', year: 'numeric' })}`
      : anchor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const eventsForDate = (date: Date) => {
    const key = localDateKey(date);
    return events.filter(event => {
      const start = event.startDate.slice(0, 10);
      const finish = (event.dueDate ?? event.startDate).slice(0, 10);
      return event.eventType === 'Task' ? key >= start && key <= finish : key === start;
    });
  };
  const eventTypes = [...new Set(events.map(event => event.eventType))].sort();
  const statusOptions = [...new Set(events.map(event => event.status))].sort();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500"><CalendarDays size={16} /> People schedule</div>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{heading}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-secondary !px-3" onClick={() => setAnchor(new Date())}>Today</button>
          <button type="button" className="btn-secondary !p-2" aria-label="Previous period" onClick={() => move(-1)}><ChevronLeft size={18} /></button>
          <button type="button" className="btn-secondary !p-2" aria-label="Next period" onClick={() => move(1)}><ChevronRight size={18} /></button>
          <PageTabs
            tabs={[{ id: 'month', label: 'Month' }, { id: 'week', label: 'Week' }, { id: 'day', label: 'Day' }]}
            active={view}
            onChange={value => setView(value as ViewMode)}
            accent={ACCENT.hr}
          />
        </div>
      </div>

      <div className="card grid grid-cols-1 gap-3 p-3 md:grid-cols-4">
        <label className="text-xs font-semibold text-slate-600">Person
          <select className="form-input mt-1" value={personFilter} onChange={event => setPersonFilter(event.target.value)}>
            <option value="">All people</option>
            {people.map(person => <option key={`${person.type}:${person.id}`} value={`${person.type}:${person.id}`}>{peopleLabel(person)}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">Department
          <select className="form-input mt-1" value={departmentFilter} onChange={event => setDepartmentFilter(event.target.value)}>
            <option value="">All departments</option>
            {departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">Event type
          <select className="form-input mt-1" value={typeFilter} onChange={event => setTypeFilter(event.target.value)}>
            <option value="">All event types</option>
            {eventTypes.map(type => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">Status
          <select className="form-input mt-1" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            {statusOptions.map(status => <option key={status}>{status}</option>)}
          </select>
        </label>
      </div>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}<button className="ml-3 underline" onClick={() => void load()}>Retry</button></div>}
      {loading ? <div role="status" className="card p-8 text-center text-sm text-slate-500">Loading live People calendar…</div> : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="card overflow-hidden">
            {view === 'month' && (
              <>
                <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="py-2">{day}</div>)}
                </div>
                <div className="grid grid-cols-7">
                  {range.dates.map(date => {
                    const key = localDateKey(date);
                    const dayEvents = eventsForDate(date);
                    const outside = date.getMonth() !== anchor.getMonth();
                    return (
                      <div key={key} className={`min-h-[128px] border-b border-r border-slate-100 p-1.5 ${outside ? 'bg-slate-50/70' : ''}`}>
                        <button className={`mb-1 grid h-7 w-7 place-items-center rounded-full text-xs ${key === today() ? 'bg-teal-700 font-bold text-white' : outside ? 'text-slate-400' : 'text-slate-700'}`} onClick={() => { setAnchor(date); setView('day'); }} aria-label={`View ${key}`}>
                          {date.getDate()}
                        </button>
                        <div className="flex flex-col gap-1">
                          {dayEvents.slice(0, 3).map(event => (
                            <button key={event.id} onClick={() => setSelected(event)} className={`truncate rounded px-1.5 py-1 text-left text-[10px] font-semibold ${event.status === 'Overdue' ? 'bg-rose-100 text-rose-800' : event.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : event.eventType === 'Task' ? 'bg-sky-100 text-sky-800' : event.eventType === 'Attendance' ? 'bg-amber-100 text-amber-900' : 'bg-teal-100 text-teal-900'}`}>
                              {event.title}
                            </button>
                          ))}
                          {dayEvents.length > 3 && <button className="px-1 text-left text-[10px] text-slate-500 hover:text-teal-700" onClick={() => { setAnchor(date); setView('day'); }}>+{dayEvents.length - 3} more</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {view !== 'month' && (
              <div className="divide-y divide-slate-100">
                {range.dates.map(date => {
                  const key = localDateKey(date);
                  const dayEvents = eventsForDate(date);
                  return (
                    <div key={key} className="grid gap-3 p-4 md:grid-cols-[150px_minmax(0,1fr)]">
                      <div className="text-sm font-bold text-slate-700">{date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                      <div className="flex flex-col gap-2">
                        {dayEvents.map(event => (
                          <button key={event.id} onClick={() => setSelected(event)} className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 text-left hover:border-teal-300 hover:bg-teal-50/40">
                            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${event.status === 'Overdue' ? 'bg-rose-500' : event.status === 'Completed' ? 'bg-emerald-500' : 'bg-teal-600'}`} />
                            <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-800">{event.title}</span><span className="mt-1 block text-xs text-slate-500">{event.eventType} · {event.assignedPerson || event.status}</span></span>
                            <span className="text-xs text-slate-500">{event.priority || event.status}</span>
                          </button>
                        ))}
                        {dayEvents.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-400">No scheduled activity</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          <aside className="card h-fit p-4">
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-[11px] font-bold uppercase tracking-wide text-teal-700">{selected.eventType}</p><h3 className="mt-1 text-lg font-extrabold text-slate-900">{selected.title}</h3></div>
                  <button className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close event details" onClick={() => setSelected(null)}><X size={16} /></button>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div><dt className="text-slate-400">Responsible</dt><dd className="mt-1 font-semibold text-slate-700">{selected.assignedPerson || '—'}</dd></div>
                  <div><dt className="text-slate-400">Assigned by</dt><dd className="mt-1 font-semibold text-slate-700">{selected.assignedBy || '—'}</dd></div>
                  <div><dt className="text-slate-400">Start</dt><dd className="mt-1 font-semibold text-slate-700">{selected.startDate ? dateLabel(selected.startDate, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</dd></div>
                  <div><dt className="text-slate-400">Due</dt><dd className="mt-1 font-semibold text-slate-700">{selected.dueDate ? dateLabel(selected.dueDate, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</dd></div>
                  <div><dt className="text-slate-400">Status</dt><dd className="mt-1 font-semibold text-slate-700">{selected.status}</dd></div>
                  <div><dt className="text-slate-400">Priority</dt><dd className="mt-1 font-semibold text-slate-700">{selected.priority || '—'}</dd></div>
                </dl>
                {selected.description && <p className="mt-4 border-t border-slate-100 pt-3 text-sm leading-5 text-slate-600">{selected.description}</p>}
                {selected.link && <Link to={selected.link} className="mt-4 inline-flex text-sm font-bold text-teal-700 hover:underline">Open related record →</Link>}
              </>
            ) : (
              <div className="flex min-h-[180px] flex-col items-center justify-center text-center">
                <Clock3 size={22} className="text-slate-300" />
                <p className="mt-3 text-sm font-bold text-slate-700">Select an event</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Review its owner, dates, status, and related record here.</p>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3 text-[10px] font-semibold text-slate-500">
              <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-800">Overdue</span>
              <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-800">Upcoming</span>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">Completed</span>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function TaskManager({ participantView = false }: { participantView?: boolean }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<PeopleTask[]>([]);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PeopleTask | null>(null);
  const [history, setHistory] = useState<Array<Record<string, string | null>>>([]);
  const [historyTask, setHistoryTask] = useState<PeopleTask | null>(null);
  const linkedTaskId = searchParams.get('task');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (participantView) {
        const taskResponse = await peopleApi.getPeopleTasks({
          ...(search ? { search } : {}),
          ...(status ? { status } : {}),
          ...(priority ? { priority } : {}),
        });
        setTasks(taskResponse.items);
        return;
      }
      const [taskResponse, departmentResponse, employeeResponse, internResponse, volunteerResponse, projectResponse] = await Promise.all([
        peopleApi.getPeopleTasks({ ...(search ? { search } : {}), ...(status ? { status } : {}), ...(priority ? { priority } : {}), ...(departmentId ? { departmentId } : {}) }),
        peopleApi.getDepartments(),
        peopleApi.getEmployees({ limit: 200 }),
        peopleApi.getInternProfiles({ limit: 200 }),
        peopleApi.getVolunteers({ limit: 200 }),
        getProjects({ tab: 'all' }),
      ]);
      setTasks(taskResponse.items);
      setDepartments(departmentResponse.items);
      setPeople([
        ...employeeResponse.items.map(person => ({ id: person.id, type: 'Employee' as const, name: person.fullName, departmentId: person.departmentId })),
        ...internResponse.items.map(person => ({ id: person.id, type: 'Intern' as const, name: person.fullName ?? person.internCode ?? 'Intern', departmentId: person.departmentId })),
        ...volunteerResponse.items.map(person => ({ id: person.id, type: 'Volunteer' as const, name: person.fullName, departmentId: null })),
      ]);
      setProjects(projectResponse.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load task data.');
    } finally {
      setLoading(false);
    }
  }, [departmentId, participantView, priority, search, status]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (participantView || !linkedTaskId || loading) return;
    const task = tasks.find(item => item.id === linkedTaskId);
    if (task) {
      setEditing(task);
      setModalOpen(true);
      navigate('/people-management/tasks', { replace: true });
    }
  }, [linkedTaskId, loading, navigate, participantView, tasks]);

  const saveTask = async (data: Parameters<typeof peopleApi.createPeopleTask>[0], id?: string) => {
    if (id) await peopleApi.updatePeopleTask(id, data);
    else await peopleApi.createPeopleTask(data);
    await load();
  };
  const updateStatus = async (task: PeopleTask, nextStatus: Exclude<PeopleTaskStatus, 'Overdue'>) => {
    try {
      await peopleApi.updatePeopleTask(task.id, { status: nextStatus });
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update task status.');
    }
  };
  const showHistory = async (task: PeopleTask) => {
    try {
      const result = await peopleApi.getPeopleTaskHistory(task.id);
      setHistory(result.items);
      setHistoryTask(task);
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : 'Unable to load task history.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm text-slate-500">Responsibilities across employees, interns, and volunteers</p><h2 className="mt-1 text-xl font-black text-slate-900">{tasks.length} tasks</h2></div>
        {!participantView && <button className="btn-primary flex items-center gap-2" onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={16} /> Assign task</button>}
      </div>
      <div className={`card grid grid-cols-1 gap-3 p-3 ${participantView ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
        <label className="relative text-xs font-semibold text-slate-600"><span className="sr-only">Search tasks</span><Search className="absolute left-3 top-8 text-slate-400" size={15} /><input className="form-input mt-1 pl-9" placeholder="Search title or description" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <SelectField label="Status" value={status} onChange={setStatus} options={[{ label: 'All statuses', value: '' }, 'Not Started', 'In Progress', 'On Hold', 'Completed', 'Overdue']} />
        <SelectField label="Priority" value={priority} onChange={setPriority} options={[{ label: 'All priorities', value: '' }, 'Low', 'Medium', 'High', 'Critical']} />
        {!participantView && <SelectField label="Department" value={departmentId} onChange={setDepartmentId} options={[{ label: 'All departments', value: '' }, ...departments.map(department => ({ label: department.name, value: department.id }))]} />}
      </div>
      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}<button className="ml-3 underline" onClick={() => void load()}>Retry</button></div>}
      <div className="card overflow-x-auto">
        {loading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Loading tasks…</p> : tasks.length ? (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr>{['Task', 'Assigned to', 'Timeline', 'Priority', 'Status', ''].map(head => <th key={head} className="px-4 py-3 font-bold">{head}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map(task => (
                <tr key={task.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3"><p className="font-bold text-slate-800">{task.title}</p><p className="mt-1 max-w-xs truncate text-xs text-slate-500">{task.description}</p><p className="mt-1 text-[10px] text-slate-400">Assigned by {task.assignedByName || 'HR'}{task.departmentName ? ` · ${task.departmentName}` : ''}</p></td>
                  <td className="px-4 py-3 text-slate-700">{task.assigneeName || getPersonName(task.staffId ?? task.internId ?? task.volunteerId ?? '', task.staffId ? 'Employee' : task.internId ? 'Intern' : 'Volunteer', people)}<span className="block text-xs text-slate-400">{task.staffId ? 'Employee' : task.internId ? 'Intern' : 'Volunteer'}</span></td>
                  <td className="px-4 py-3 text-xs text-slate-600"><span className="block">Starts {dateLabel(task.startsOn, { month: 'short', day: 'numeric', year: 'numeric' })}</span><span className="mt-1 block">Due {dateLabel(task.dueDate, { month: 'short', day: 'numeric', year: 'numeric' })}</span></td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${task.priority === 'Critical' || task.priority === 'High' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}`}>{task.priority}</span></td>
                  <td className="px-4 py-3"><select className={`rounded-full border-0 px-2 py-1 text-xs font-bold ${task.status === 'Overdue' ? 'bg-rose-100 text-rose-800' : task.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`} value={task.status === 'Overdue' ? 'Not Started' : task.status} onChange={event => void updateStatus(task, event.target.value as Exclude<PeopleTaskStatus, 'Overdue'>)}><option>Not Started</option><option>In Progress</option><option>On Hold</option><option>Completed</option></select>{task.status === 'Overdue' && <span className="ml-1 text-[10px] font-bold text-rose-600">Overdue</span>}</td>
                  <td className="px-4 py-3">{!participantView && <div className="flex gap-2"><button className="text-xs font-bold text-teal-700 hover:underline" onClick={() => { setEditing(task); setModalOpen(true); }}>Edit</button><button className="text-xs font-bold text-slate-500 hover:underline" onClick={() => void showHistory(task)}>History</button></div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="p-10 text-center"><Users className="mx-auto text-slate-300" size={24} /><p className="mt-2 text-sm font-bold text-slate-700">No tasks match these filters</p><p className="mt-1 text-xs text-slate-500">Assign a task to start tracking work.</p></div>}
      </div>
      <TaskForm open={modalOpen} onClose={() => setModalOpen(false)} onSave={saveTask} task={editing} people={people} departments={departments} projects={projects} />
      {historyTask && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onClick={() => setHistoryTask(null)}><section role="dialog" aria-modal="true" aria-label="Task history" className="max-h-[80vh] w-full max-w-xl overflow-auto rounded-xl bg-white p-5 shadow-xl" onClick={event => event.stopPropagation()}><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase text-teal-700">Task history</p><h3 className="mt-1 font-extrabold text-slate-900">{historyTask.title}</h3></div><button onClick={() => setHistoryTask(null)} aria-label="Close history"><X size={18} /></button></div><div className="mt-4 divide-y divide-slate-100">{history.map((item, index) => <div key={`${item.id ?? index}`} className="py-3 text-xs"><p className="font-bold text-slate-700">{item.fieldName} changed by {item.actorName || 'System'}</p><p className="mt-1 text-slate-500">{item.oldValue || '—'} <span className="px-1 text-teal-600">→</span> {item.newValue || '—'}</p><p className="mt-1 text-[10px] text-slate-400">{item.createdAt}</p></div>)}</div>{history.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No changes recorded yet.</p>}</section></div>}
    </div>
  );
}

function AttendanceWorkspace() {
  const [searchParams] = useSearchParams();
  const linkedDate = searchParams.get('date');
  const linkedType = searchParams.get('personType');
  const linkedPersonId = searchParams.get('personId');
  const validLinkedDate = linkedDate && /^\d{4}-\d{2}-\d{2}$/.test(linkedDate) ? linkedDate : null;
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [from, setFrom] = useState(validLinkedDate ?? localDateKey(shiftDate(new Date(), -30)));
  const [to, setTo] = useState(validLinkedDate ?? today());
  const [personType, setPersonType] = useState(['Employee', 'Intern', 'Volunteer'].includes(linkedType ?? '') ? linkedType ?? '' : '');
  const [personId, setPersonId] = useState(linkedPersonId ?? '');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [date, setDate] = useState(validLinkedDate ?? today());
  const [newType, setNewType] = useState<PeopleAssigneeType>('Employee');
  const [newPersonId, setNewPersonId] = useState('');
  const [newStatus, setNewStatus] = useState('Present');
  const [hours, setHours] = useState('0');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [departmentResult, employeeResult, internResult, volunteerResult, staffAttendance, internAttendance, volunteerAttendance] = await Promise.all([
        peopleApi.getDepartments(),
        peopleApi.getEmployees({ limit: 200 }),
        peopleApi.getInternProfiles({ limit: 200 }),
        peopleApi.getVolunteers({ limit: 200 }),
        peopleApi.getStaffAttendance({ limit: 200 }),
        peopleApi.getInternAttendance({ limit: 200 }),
        peopleApi.getVolunteerAttendance({ limit: 200 }),
      ]);
      setDepartments(departmentResult.items);
      const peopleList: PersonOption[] = [
        ...employeeResult.items.map(person => ({ id: person.id, type: 'Employee' as const, name: person.fullName, departmentId: person.departmentId })),
        ...internResult.items.map(person => ({ id: person.id, type: 'Intern' as const, name: person.fullName ?? person.internCode ?? 'Intern', departmentId: person.departmentId })),
        ...volunteerResult.items.map(person => ({ id: person.id, type: 'Volunteer' as const, name: person.fullName, departmentId: null })),
      ];
      setPeople(peopleList);
      setEntries([
        ...staffAttendance.items.map(record => ({ id: record.id, personId: record.staffId, personType: 'Employee' as const, personName: getPersonName(record.staffId, 'Employee', peopleList), attendanceDate: record.attendanceDate, status: record.status, departmentId: peopleList.find(person => person.id === record.staffId && person.type === 'Employee')?.departmentId, record })),
        ...internAttendance.items.map(record => ({ id: record.id, personId: record.internId, personType: 'Intern' as const, personName: getPersonName(record.internId, 'Intern', peopleList), attendanceDate: record.attendanceDate, status: record.status, departmentId: peopleList.find(person => person.id === record.internId && person.type === 'Intern')?.departmentId, record })),
        ...volunteerAttendance.items.map(record => ({ id: record.id, personId: record.volunteerId, personType: 'Volunteer' as const, personName: getPersonName(record.volunteerId, 'Volunteer', peopleList), attendanceDate: record.attendanceDate, status: record.status, hours: record.hours, record })),
      ]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load attendance records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const filtered = entries.filter(entry =>
    dateBetween(entry.attendanceDate, from, to) &&
    (!personType || entry.personType === personType) &&
    (!personId || entry.personId === personId) &&
    (!departmentFilter || entry.departmentId === departmentFilter) &&
    (!statusFilter || entry.status === statusFilter)
  ).sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate));
  const activePeople = people.filter(person =>
    (!personType || person.type === personType) &&
    (!personId || person.id === personId) &&
    (!departmentFilter || person.departmentId === departmentFilter)
  );
  const dateEntries = entries.filter(entry =>
    entry.attendanceDate === date &&
    (!personType || entry.personType === personType) &&
    (!personId || entry.personId === personId) &&
    (!departmentFilter || entry.departmentId === departmentFilter)
  );
  const missing = activePeople.filter(person => !dateEntries.some(entry => entry.personId === person.id && entry.personType === person.type));
  const statuses = ['Present', 'Absent', 'Half Day', 'Leave', 'Holiday', 'Late'];
  const totals = statuses.map(status => ({ status, count: filtered.filter(entry => entry.status === status).length }));

  const recordAttendance = async () => {
    setError('');
    setNotice('');
    if (!newPersonId) { setError('Select a person before recording attendance.'); return; }
    if (!date) { setError('Attendance date is required.'); return; }
    if (date > today()) { setError('Attendance cannot be recorded for a future date.'); return; }
    const duplicate = entries.find(entry => entry.personId === newPersonId && entry.personType === newType && entry.attendanceDate === date);
    if (duplicate) { setError(`Attendance already exists for ${duplicate.personName} on ${date}.`); return; }
    setSaving(true);
    try {
      if (newType === 'Employee') await peopleApi.recordStaffAttendance({ staffId: newPersonId, attendanceDate: date, status: newStatus as StaffAttendanceRecord['status'] });
      else if (newType === 'Intern') await peopleApi.recordInternAttendance({ internId: newPersonId, attendanceDate: date, status: newStatus as InternAttendanceRecord['status'] });
      else await peopleApi.recordVolunteerAttendance({ volunteerId: newPersonId, attendanceDate: date, status: newStatus as VolunteerAttendanceRecord['status'], hours: Number(hours) || 0 });
      setNotice('Attendance saved to the database.');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to record attendance.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-slate-500">Attendance records for employees, interns, and volunteers</p><h2 className="mt-1 text-xl font-black text-slate-900">Attendance overview</h2></div><div className="text-xs text-slate-500">{filtered.length} records in selected period</div></div>
      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
      <section className="card p-4">
        <div className="mb-3 flex items-center gap-2 font-bold text-slate-800"><Filter size={16} className="text-teal-700" /> Record attendance</div>
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-3 lg:grid-cols-6">
          <SelectField label="Person type" value={newType} onChange={value => { setNewType(value as PeopleAssigneeType); setNewPersonId(''); }} options={['Employee', 'Intern', 'Volunteer']} />
          <SelectField label="Person" required value={newPersonId} onChange={setNewPersonId} options={[{ label: 'Choose person…', value: '' }, ...people.filter(person => person.type === newType).map(person => ({ label: person.name, value: person.id }))]} />
          <TextField label="Date" type="date" required value={date} onChange={setDate} />
          <SelectField label="Status" value={newStatus} onChange={setNewStatus} options={statuses} />
          {newType === 'Volunteer' ? <TextField label="Hours" type="number" step="0.5" value={hours} onChange={setHours} /> : <div />}
          <button className="btn-primary" onClick={() => void recordAttendance()} disabled={saving}>{saving ? 'Saving…' : 'Save attendance'}</button>
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {totals.map(({ status, count }) => <div key={status} className="card p-3"><p className="text-xs font-semibold text-slate-500">{status}</p><p className="mt-1 text-2xl font-black text-slate-900">{count}</p></div>)}
      </div>
      <section className="card grid grid-cols-1 gap-3 p-3 md:grid-cols-3 xl:grid-cols-6">
        <TextField label="From" type="date" value={from} onChange={setFrom} />
        <TextField label="To" type="date" value={to} onChange={setTo} />
        <SelectField label="Person type" value={personType} onChange={value => { setPersonType(value); setPersonId(''); }} options={[{ label: 'All roles', value: '' }, 'Employee', 'Intern', 'Volunteer']} />
        <SelectField label="Person" value={personId} onChange={setPersonId} options={[{ label: 'All people', value: '' }, ...activePeople.map(person => ({ label: person.name, value: person.id }))]} />
        <SelectField label="Department" value={departmentFilter} onChange={setDepartmentFilter} options={[{ label: 'All departments', value: '' }, ...departments.map(department => ({ label: department.name, value: department.id }))]} />
        <SelectField label="Status" value={statusFilter} onChange={setStatusFilter} options={[{ label: 'All statuses', value: '' }, ...statuses]} />
      </section>
      <section className="card overflow-hidden">
        <div className="card-header flex flex-wrap items-center justify-between gap-2"><div><h3 className="card-title">Missing attendance · {dateLabel(date, { month: 'long', day: 'numeric', year: 'numeric' })}</h3><p className="text-xs text-slate-500">{missing.length} people have no record for this date.</p></div><label className="text-xs font-semibold text-slate-600">Check date <input className="form-input ml-2 inline-block w-auto" type="date" value={date} onChange={event => setDate(event.target.value)} /></label></div>
        {missing.length ? <div className="flex flex-wrap gap-2 p-4">{missing.map(person => <span key={`${person.type}:${person.id}`} className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">{person.name} · {person.type}</span>)}</div> : <p className="p-4 text-sm text-slate-500">All listed people have attendance recorded for this date.</p>}
      </section>
      <section className="card overflow-x-auto">
        {loading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Loading attendance…</p> : filtered.length ? (
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr>{['Date', 'Person', 'Role', 'Department', 'Status', 'Hours'].map(header => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{filtered.map(entry => <tr key={`${entry.personType}:${entry.id}`} className="hover:bg-slate-50/70"><td className="px-4 py-3 font-medium text-slate-700">{dateLabel(entry.attendanceDate, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td className="px-4 py-3 font-bold text-slate-800">{entry.personName}</td><td className="px-4 py-3 text-slate-600">{entry.personType}</td><td className="px-4 py-3 text-slate-600">{departmentsLabel(entry.departmentId, departments)}</td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{entry.status}</span></td><td className="px-4 py-3 text-slate-600">{entry.hours ?? '—'}</td></tr>)}</tbody>
          </table>
        ) : <div className="p-10 text-center text-sm text-slate-500">No attendance records match this period and filter.</div>}
      </section>
    </div>
  );
}

function departmentsLabel(departmentId: string | null | undefined, departments: Department[]) {
  return departmentId ? departments.find(department => department.id === departmentId)?.name ?? '—' : '—';
}

export default function PeopleWorkspacePage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const participantView = user?.role === 'Volunteer';
  const mode = location.pathname.endsWith('/tasks') ? 'tasks' : location.pathname.endsWith('/attendance') ? 'attendance' : 'calendar';
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="People Workspace" subtitle="A live view of workforce schedules, task ownership, and attendance." />
      <PageTabs
        tabs={participantView ? [
          { id: 'tasks', label: 'My tasks' },
        ] : [
          { id: 'calendar', label: 'Calendar' },
          { id: 'tasks', label: 'Tasks' },
          { id: 'attendance', label: 'Attendance' },
        ]}
        active={mode}
        onChange={tab => navigate(`/people-management/${tab}`)}
        accent={ACCENT.hr}
      />
      {mode === 'calendar' ? <CalendarView /> : mode === 'tasks' ? <TaskManager participantView={participantView} /> : <AttendanceWorkspace />}
    </div>
  );
}
