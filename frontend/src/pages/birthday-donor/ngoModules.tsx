import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import usePersistentState from '../../hooks/usePersistentState';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import {
  CalendarDays, Cake, CheckCircle2, CircleDollarSign, FileText,
  Gift, HeartHandshake, MessageSquare, Sparkles, Target, TrendingUp,
  UserRoundCheck, Users, BriefcaseBusiness, ArrowRight, Eye,
  BellRing, Download, Search, ClipboardList, TimerReset, ShieldCheck,
  Wand2, Send, Building2, BarChart3, Plus, X, Mail, Phone, Edit, Trash2, Check,
} from 'lucide-react';
import {
  activityLog,
  birthdayProfiles,
  birthdayTasks,
  campaignData,
  causeData,
  cityDistribution,
  communicationTimeline,
  contributionData,
  departmentMetrics,
  deptWorkspaces,
  donorPipeline,
  donorProfiles,
  donorSegments,
  greetingTemplates,
  initialDepartmentTasks,
  initialOccasionsList,
  monthlyTrend,
  revenueByCategory,
  rolePermissions,
  type BirthdayProfileItem,
  type BirthdayTaskItem,
  type CampaignItem,
  type CommunicationLogItem,
  type ContributionItem,
  type DepartmentWorkspaceTask,
  type DonorProfileItem,
  type OccasionItem,
  type PipelineLaneItem,
} from './sharedData';

export function notifyModule(message: string) {
  window.dispatchEvent(new CustomEvent('ngo:notify', { detail: message }));
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function parseCsvRow(line: string) {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
      <section className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, sub, tone = 'teal' }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone?: 'teal' | 'blue' | 'green' | 'amber' | 'purple';
}) {
  const toneMap = {
    teal: { bg: '#E6F7F9', color: '#0F766E' },
    blue: { bg: '#E0F2FE', color: '#0369A1' },
    green: { bg: '#DCFCE7', color: '#15803D' },
    amber: { bg: '#FEF3C7', color: '#B45309' },
    purple: { bg: '#F3E8FF', color: '#7C3AED' },
  };
  const theme = toneMap[tone];

  return (
    <div className="stat-card flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="p-2.5 rounded-xl" style={{ background: theme.bg, color: theme.color }}>
          {icon}
        </div>
        <div className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">{sub}</div>
      </div>
      <div>
        <div className="text-2xl font-extrabold text-slate-800" style={{ fontFamily: 'Nunito, sans-serif' }}>{value}</div>
        <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function StatusBadge({ label, tone = 'teal' }: { label: string; tone?: 'teal' | 'blue' | 'amber' | 'green' | 'red' | 'gray' | 'purple' }) {
  const toneMap = {
    teal: 'badge badge-teal',
    blue: 'badge badge-blue',
    amber: 'badge badge-yellow',
    green: 'badge badge-green',
    red: 'badge badge-red',
    gray: 'badge badge-gray',
    purple: 'badge badge-purple',
  };
  return <span className={toneMap[tone] ?? 'badge badge-teal'}>{label}</span>;
}

function SectionHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="card-header">
      <div>
        <div className="card-title">{title}</div>
        {subtitle && <div className="text-[11px] text-slate-400 mt-1">{subtitle}</div>}
      </div>
      {actions}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   1. BIRTHDAY PROJECT DASHBOARD
   ═══════════════════════════════════════════════════════════════════════ */
export function BirthdayProjectDashboard() {
  const navigate = useNavigate();
  const [profiles] = usePersistentState<BirthdayProfileItem[]>('birthday-project.profiles', birthdayProfiles);
  const [occasions] = usePersistentState<OccasionItem[]>('birthday-project.occasions', initialOccasionsList);
  const [tasks] = usePersistentState<BirthdayTaskItem[]>('birthday-project.tasks', birthdayTasks);
  const [contributions] = usePersistentState<ContributionItem[]>('donor-management.contributions', [
    { donor: 'Asha Nair', category: 'Online Donations', amount: 25000, date: '09 Oct 2026', group: 'Public & Small' },
    { donor: 'Sparsh Foods Pvt Ltd', category: 'CSR Funds', amount: 450000, date: '04 Oct 2026', group: 'Corporate & Large' },
    { donor: 'Nitin Mehta', category: 'Crowdfunding', amount: 12500, date: '01 Oct 2026', group: 'Public & Small' },
  ]);

  const totalRaised = useMemo(() => contributions.reduce((sum, item) => sum + item.amount, 0), [contributions]);
  const pendingTasks = useMemo(() => tasks.filter((t) => t.status !== 'Completed').length, [tasks]);

  const quickActions = [
    { label: 'Create greeting template', path: '/birthday-project/occasions' },
    { label: 'Schedule occasion reminder', path: '/birthday-project/occasions' },
    { label: 'Start guided donor outreach', path: '/birthday-project/action-workspace' },
    { label: 'Review engagement task board', path: '/birthday-project/engagement' },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="page-title">Birthday Project Dashboard</h1>
          <p className="page-subtitle">Personalised donor outreach, occasion tracking, celebration milestones, and team performance</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary text-sm" onClick={() => navigate('/birthday-project/occasions')}><CalendarDays size={15} /> Occasions calendar</button>
          <button className="btn-primary text-sm" onClick={() => navigate('/birthday-project/action-workspace')}><Sparkles size={15} /> Start Action</button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={<HeartHandshake size={18} />} label="Celebration contacts" value={String(profiles.length)} sub="Active in outreach" tone="teal" />
        <StatCard icon={<Cake size={18} />} label="Upcoming occasions" value={String(occasions.length)} sub="Next 30 days" tone="blue" />
        <StatCard icon={<ClipboardList size={18} />} label="Active tasks" value={String(tasks.length)} sub={`${pendingTasks} pending`} tone="amber" />
        <StatCard icon={<CircleDollarSign size={18} />} label="Celebration gifts & pledges" value={`₹${(totalRaised / 100000).toFixed(1)}L`} sub="Recorded to date" tone="green" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card xl:col-span-2">
          <SectionHeader title="Expected vs Actual Celebration Giving" subtitle="Reviewed across key months" actions={<StatusBadge label="Live Synchronised" tone="green" />} />
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={contributionData}>
                <defs>
                  <linearGradient id="birthdayTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1AACB8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1AACB8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} />
                <Tooltip formatter={(value) => [`₹${(Number(value ?? 0) / 1000).toFixed(0)}k`, 'Donation']} contentStyle={{ borderRadius: 12 }} />
                <Area type="monotone" dataKey="amount" stroke="#1AACB8" strokeWidth={3} fill="url(#birthdayTrend)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <SectionHeader title="Outreach staff quality" subtitle="Completion & response index" />
          <div className="card-body space-y-4">
            {[
              { name: 'Priya Sharma', score: 94, role: 'Field Officer' },
              { name: 'Nisha Pillai', score: 88, role: 'Donor Relations' },
              { name: 'Vivek Joshi', score: 84, role: 'CSR Liaison' },
              { name: 'Ritu Sen', score: 79, role: 'Volunteer Coordinator' },
            ].map((staff) => (
              <div key={staff.name}>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">{staff.name} <span className="text-slate-400 font-normal">({staff.role})</span></span>
                  <span className="font-bold text-teal-700">{staff.score}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-teal-500" style={{ width: `${staff.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card xl:col-span-2">
          <SectionHeader title="Immediate occasions schedule" subtitle="Upcoming celebrations needing outreach" actions={<button className="btn-secondary text-sm" onClick={() => navigate('/birthday-project/occasions')}><Target size={15} /> View all</button>} />
          <div className="card-body space-y-3">
            {occasions.slice(0, 4).map((occ) => (
              <div key={occ.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                <div>
                  <div className="font-semibold text-slate-800">{occ.title}</div>
                  <div className="text-xs text-slate-500">{occ.donorName} • Due: {occ.date} • {occ.notes}</div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <StatusBadge label={occ.tag} tone={occ.tag === 'Priority' ? 'amber' : occ.tag === 'Corporate' ? 'blue' : 'teal'} />
                  <button className="btn-secondary text-xs !py-1" onClick={() => {
                    notifyModule(`Opening action for ${occ.donorName}`);
                    navigate('/birthday-project/action-workspace');
                  }}>Engage <ArrowRight size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <SectionHeader title="Quick actions" subtitle="Jump straight into operations" />
          <div className="card-body space-y-2">
            {quickActions.map((action) => (
              <button key={action.label} onClick={() => navigate(action.path)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:border-teal-300 hover:bg-teal-50">
                {action.label}
                <ArrowRight size={14} className="text-teal-600" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   2. BIRTHDAY PROJECT PROFILES
   ═══════════════════════════════════════════════════════════════════════ */
export function BirthdayProjectProfiles() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [relationship, setRelationship] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [profiles, setProfiles] = usePersistentState<BirthdayProfileItem[]>('birthday-project.profiles', birthdayProfiles);
  const [showAdd, setShowAdd] = useState(false);
  const [editingProfile, setEditingProfile] = useState<BirthdayProfileItem | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<BirthdayProfileItem | null>(null);

  const filtered = useMemo(() => {
    return profiles.filter((person) => {
      const matchQuery = `${person.name} ${person.city} ${person.interest}`.toLowerCase().includes(query.toLowerCase());
      const matchRelation = !relationship || person.relation === relationship;
      const matchStatus = !statusFilter || person.status === statusFilter;
      return matchQuery && matchRelation && matchStatus;
    });
  }, [profiles, query, relationship, statusFilter]);

  const handleExport = () => {
    const headers = ['Name', 'Relation', 'Interest', 'City', 'Status', 'Next Action', 'Birth Date', 'Email', 'Phone', 'Notes'];
    const rows = filtered.map((p) => [p.name, p.relation, p.interest, p.city, p.status, p.nextAction, p.birthDate ?? '', p.email ?? '', p.phone ?? '', p.notes ?? '']);
    downloadCsv('birthday-project-profiles.csv', [headers, ...rows]);
    notifyModule(`Exported ${filtered.length} profiles to CSV`);
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    const csv = await file.text();
    const [headerLine, ...lines] = csv.split(/\r?\n/).filter(Boolean);
    if (!headerLine) {
      notifyModule('CSV file is empty');
      return;
    }
    const headers = parseCsvRow(headerLine).map((h) => h.toLowerCase());
    const nameIdx = headers.findIndex((h) => ['name', 'full name', 'profile name'].includes(h));
    const cityIdx = headers.findIndex((h) => h === 'city');
    if (nameIdx < 0 || cityIdx < 0) {
      notifyModule('CSV needs at least "name" and "city" headers');
      return;
    }
    const imported: BirthdayProfileItem[] = lines.map(parseCsvRow).filter((r) => r[nameIdx]?.trim() && r[cityIdx]?.trim()).map((r) => {
      const relIdx = headers.findIndex((h) => ['relation', 'relationship', 'relationship type'].includes(h));
      const intIdx = headers.findIndex((h) => ['interest', 'cause', 'cause interest'].includes(h));
      return {
        id: Date.now() + Math.random(),
        name: r[nameIdx].trim(),
        city: r[cityIdx].trim(),
        relation: relIdx >= 0 && r[relIdx] ? (r[relIdx] as any) : 'Individual',
        interest: intIdx >= 0 && r[intIdx] ? r[intIdx] : 'Education and community support',
        status: 'Warm',
        nextAction: 'Initial welcome greeting',
        birthDate: '1990-10-15',
      };
    });
    setProfiles((prev) => [...prev, ...imported]);
    notifyModule(`Imported ${imported.length} new celebration profiles`);
  };

  const deleteProfile = (id: string | number) => {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    notifyModule('Profile deleted');
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="page-title">Profile Database</h1>
          <p className="page-subtitle">Search, maintain, and segment contacts for birthdays and special occasion greetings</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm" onClick={handleExport}><Download size={15} /> Export CSV</button>
          <label className="btn-secondary text-sm cursor-pointer">
            <Download size={15} /> Bulk import
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void handleImport(e.target.files?.[0])} />
          </label>
          <button className="btn-primary text-sm" onClick={() => setShowAdd(true)}><UserRoundCheck size={15} /> Add profile</button>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-col xl:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} className="form-input pl-9" placeholder="Search by name, city, or cause interest" />
            </div>
            <select value={relationship} onChange={(e) => setRelationship(e.target.value)} className="form-input !w-auto min-w-[150px]">
              <option value="">All relationships</option>
              {['Individual', 'Corporate', 'Volunteer', 'Partner', 'Advisor'].map((type) => <option key={type}>{type}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="form-input !w-auto min-w-[140px]">
              <option value="">All statuses</option>
              {['Warm', 'Engaged', 'Conversion', 'Active', 'Retention'].map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Celebration Profiles ({filtered.length})</div>
        </div>
        <div className="card-body overflow-x-auto">
          <table className="data-table min-w-[850px] w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Relation</th>
                <th>Cause Interests</th>
                <th>City</th>
                <th>Birth / Milestone</th>
                <th>Status</th>
                <th>Next Action</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((profile) => (
                <tr key={profile.id}>
                  <td className="font-semibold text-slate-800">
                    <button className="text-teal-700 hover:underline text-left font-bold" onClick={() => setSelectedProfile(profile)}>
                      {profile.name}
                    </button>
                  </td>
                  <td>{profile.relation}</td>
                  <td>{profile.interest}</td>
                  <td>{profile.city}</td>
                  <td>{profile.birthDate ?? '12 Oct'}</td>
                  <td><StatusBadge label={profile.status} tone={profile.status === 'Warm' ? 'green' : profile.status === 'Conversion' ? 'purple' : 'teal'} /></td>
                  <td>{profile.nextAction}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button className="btn-secondary !py-1 text-xs" title="Action Workspace" onClick={() => {
                        localStorage.setItem('birthday-project.active-profile-id', String(profile.id));
                        navigate('/birthday-project/action-workspace');
                      }}><Sparkles size={12} /> Engage</button>
                      <button className="p-1 text-slate-400 hover:text-teal-600" title="Edit" onClick={() => setEditingProfile(profile)}><Edit size={14} /></button>
                      <button className="p-1 text-slate-400 hover:text-rose-600" title="Delete" onClick={() => deleteProfile(profile.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="py-8 text-center text-sm text-slate-500">No celebration profiles found.</div>}
        </div>
      </div>

      {/* Add Profile Dialog */}
      {showAdd && (
        <Dialog title="Add Celebration Profile" onClose={() => setShowAdd(false)}>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const name = String(form.get('name') ?? '').trim();
            const city = String(form.get('city') ?? '').trim();
            const relation = String(form.get('relation') ?? 'Individual') as any;
            const interest = String(form.get('interest') ?? '').trim();
            const birthDate = String(form.get('birthDate') ?? '');
            const email = String(form.get('email') ?? '');
            const phone = String(form.get('phone') ?? '');
            if (!name || !city || !interest) return;
            const newP: BirthdayProfileItem = {
              id: Date.now(),
              name,
              city,
              relation,
              interest,
              birthDate: birthDate || '1990-10-15',
              email,
              phone,
              status: 'Warm',
              nextAction: 'Schedule birthday greeting',
            };
            setProfiles((cur) => [newP, ...cur]);
            setShowAdd(false);
            notifyModule(`${name} added to celebration profiles`);
          }}>
            <label className="form-label">Full Name or Organisation<input required name="name" className="form-input mt-1" placeholder="e.g. Ramesh Chandra" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="form-label">Relationship<select name="relation" className="form-input mt-1">{['Individual', 'Corporate', 'Volunteer', 'Partner', 'Advisor'].map((t) => <option key={t}>{t}</option>)}</select></label>
              <label className="form-label">City<input required name="city" className="form-input mt-1" placeholder="City" /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="form-label">Birthday / Occasion Date<input type="date" name="birthDate" className="form-input mt-1" defaultValue="1990-10-15" /></label>
              <label className="form-label">Phone<input name="phone" className="form-input mt-1" placeholder="+91 98765 00000" /></label>
            </div>
            <label className="form-label">Email<input type="email" name="email" className="form-input mt-1" placeholder="supporter@example.com" /></label>
            <label className="form-label">Cause Interests<input required name="interest" className="form-input mt-1" placeholder="e.g. Education, Child nutrition, Health" /></label>
            <button type="submit" className="btn-primary w-full justify-center mt-3"><Plus size={15} /> Save Profile</button>
          </form>
        </Dialog>
      )}

      {/* Edit Profile Dialog */}
      {editingProfile && (
        <Dialog title={`Edit: ${editingProfile.name}`} onClose={() => setEditingProfile(null)}>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setProfiles((cur) => cur.map((p) => p.id === editingProfile.id ? {
              ...p,
              name: String(form.get('name') ?? p.name),
              relation: String(form.get('relation') ?? p.relation) as any,
              city: String(form.get('city') ?? p.city),
              interest: String(form.get('interest') ?? p.interest),
              status: String(form.get('status') ?? p.status) as any,
              nextAction: String(form.get('nextAction') ?? p.nextAction),
            } : p));
            setEditingProfile(null);
            notifyModule('Profile updated successfully');
          }}>
            <label className="form-label">Name<input required name="name" className="form-input mt-1" defaultValue={editingProfile.name} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="form-label">Relationship<select name="relation" className="form-input mt-1" defaultValue={editingProfile.relation}>{['Individual', 'Corporate', 'Volunteer', 'Partner', 'Advisor'].map((t) => <option key={t}>{t}</option>)}</select></label>
              <label className="form-label">Status<select name="status" className="form-input mt-1" defaultValue={editingProfile.status}>{['Warm', 'Engaged', 'Conversion', 'Active', 'Retention'].map((t) => <option key={t}>{t}</option>)}</select></label>
            </div>
            <label className="form-label">City<input required name="city" className="form-input mt-1" defaultValue={editingProfile.city} /></label>
            <label className="form-label">Cause Interests<input required name="interest" className="form-input mt-1" defaultValue={editingProfile.interest} /></label>
            <label className="form-label">Next Action<input name="nextAction" className="form-input mt-1" defaultValue={editingProfile.nextAction} /></label>
            <button type="submit" className="btn-primary w-full justify-center"><Check size={15} /> Update Profile</button>
          </form>
        </Dialog>
      )}

      {/* View Detail Dialog */}
      {selectedProfile && (
        <Dialog title={selectedProfile.name} onClose={() => setSelectedProfile(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
              <span className="text-slate-500">Relationship:</span><span className="font-semibold text-slate-800">{selectedProfile.relation}</span>
              <span className="text-slate-500">City / Location:</span><span>{selectedProfile.city}</span>
              <span className="text-slate-500">Birthday / Milestone:</span><span>{selectedProfile.birthDate ?? '12 Oct'}</span>
              <span className="text-slate-500">Engagement Status:</span><StatusBadge label={selectedProfile.status} tone="green" />
              <span className="text-slate-500">Cause Interests:</span><span>{selectedProfile.interest}</span>
              <span className="text-slate-500">Next Scheduled Action:</span><span>{selectedProfile.nextAction}</span>
              <span className="text-slate-500">Phone:</span><span>{selectedProfile.phone ?? '+91 98765 00000'}</span>
              <span className="text-slate-500">Email:</span><span>{selectedProfile.email ?? 'contact@supporter.org'}</span>
            </div>
            <button className="btn-primary w-full justify-center" onClick={() => {
              localStorage.setItem('birthday-project.active-profile-id', String(selectedProfile.id));
              setSelectedProfile(null);
              navigate('/birthday-project/action-workspace');
            }}><Sparkles size={15} /> Launch Action Workspace for this profile</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   3. BIRTHDAY PROJECT OCCASIONS & CALENDAR
   ═══════════════════════════════════════════════════════════════════════ */
export function BirthdayProjectOccasions() {
  const [view, setView] = useState<'Month' | 'Week' | 'List'>('Week');
  const [days, setDays] = useState('7');
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [occasions, setOccasions] = usePersistentState<OccasionItem[]>('birthday-project.occasions', initialOccasionsList);
  const [templates, setTemplates] = usePersistentState('birthday-project.templates', greetingTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? 'tpl-bday-ind');
  const [showAddOccasion, setShowAddOccasion] = useState(false);

  const activeTemplate = templates.find((t) => t.id === selectedTemplateId) ?? templates[0];
  const [templateText, setTemplateText] = useState(activeTemplate?.template ?? '');

  useEffect(() => {
    if (activeTemplate) setTemplateText(activeTemplate.template);
  }, [selectedTemplateId, activeTemplate]);

  const visibleOccasions = useMemo(() => {
    return priorityOnly ? occasions.filter((item) => item.tag === 'Priority') : occasions;
  }, [occasions, priorityOnly]);

  const saveCurrentTemplate = () => {
    setTemplates((prev) => prev.map((t) => t.id === selectedTemplateId ? { ...t, template: templateText } : t));
    notifyModule(`Template "${activeTemplate?.name}" saved successfully`);
  };

  const deleteOccasion = (id: string) => {
    setOccasions((prev) => prev.filter((o) => o.id !== id));
    notifyModule('Occasion reminder removed');
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="page-title">Occasions & Calendar</h1>
          <p className="page-subtitle">Birthdays, anniversaries, greeting templates, and multi-channel celebration reminders</p>
        </div>
        <button className="btn-primary text-sm" onClick={() => setShowAddOccasion(true)}><Plus size={15} /> Add Occasion</button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card">
          <SectionHeader title="Upcoming Occasions" subtitle={`Showing ${visibleOccasions.length} events · ${view} view`} actions={
            <div className="flex gap-1">
              {(['Month', 'Week', 'List'] as const).map((mode) => (
                <button key={mode} onClick={() => setView(mode)} className={`rounded-md px-2.5 py-1 text-xs font-semibold ${view === mode ? 'bg-teal-100 text-teal-800' : 'text-slate-500 hover:bg-slate-100'}`}>{mode}</button>
              ))}
            </div>
          } />
          <div className="card-body">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input type="checkbox" checked={priorityOnly} onChange={(e) => setPriorityOnly(e.target.checked)} className="rounded text-teal-600" />
                Show Priority only
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                Reminder lead time:
                <select value={days} onChange={(e) => setDays(e.target.value)} className="form-input !w-auto !py-1 text-xs">
                  {['1', '3', '7', '14', '30'].map((val) => <option key={val} value={val}>{val} days before</option>)}
                </select>
              </label>
            </div>

            {view === 'Month' && (
              <div className="mb-4">
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-500 mb-1">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="p-1">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                    const isOcc = [12, 18, 22, 25].includes(day);
                    return (
                      <div key={day} className={`rounded-lg p-2.5 ${isOcc ? 'bg-teal-500 text-white font-bold shadow-sm' : 'bg-slate-50 text-slate-700'}`}>
                        {day}
                        {isOcc && <div className="text-[9px] font-normal truncate">🎉 Event</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {visibleOccasions.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                  <div>
                    <div className="font-semibold text-slate-800">{item.title}</div>
                    <div className="text-xs text-slate-500">Date: {item.date} • Lead: {item.reminderDays ?? days} days • {item.notes}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge label={item.tag} tone={item.tag === 'Priority' ? 'amber' : 'teal'} />
                    <button className="text-slate-400 hover:text-rose-600 p-1" onClick={() => deleteOccasion(item.id)}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Greeting Template Editor */}
        <div className="card">
          <SectionHeader title="Greeting Template Editor" subtitle="Personalise templates with dynamic merge variables" />
          <div className="card-body space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600">Select Template Category</label>
              <select className="form-input mt-1 text-sm" value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                {templates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-600">Template Content</span>
                <span className="text-[11px] text-teal-600 font-medium">Variables: &#123;name&#125;, &#123;occasion&#125;, &#123;city&#125;</span>
              </div>
              <textarea className="form-input min-h-[160px] text-sm leading-relaxed" value={templateText} onChange={(e) => setTemplateText(e.target.value)} />
            </div>

            <div className="rounded-xl bg-teal-50/60 border border-teal-200/60 p-3 text-xs text-teal-900">
              <span className="font-bold">Live Preview: </span>
              {templateText.replace(/\{name\}/g, 'Asha Nair').replace(/\{occasion\}/g, 'Birthday').replace(/\{city\}/g, 'Bengaluru')}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">Trigger rule: Scheduled {days} days before occasion</span>
              <button className="btn-primary text-sm" onClick={saveCurrentTemplate}><Wand2 size={15} /> Save Template</button>
            </div>
          </div>
        </div>
      </div>

      {showAddOccasion && (
        <Dialog title="Add Occasion Reminder" onClose={() => setShowAddOccasion(false)}>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const title = String(form.get('title') ?? '').trim();
            const donorName = String(form.get('donorName') ?? '').trim();
            const date = String(form.get('date') ?? '');
            const tag = String(form.get('tag') ?? 'Priority') as any;
            const notes = String(form.get('notes') ?? '');
            if (!title || !date) return;
            const newOcc: OccasionItem = {
              id: `OCC-${Date.now()}`,
              title,
              donorName,
              date,
              tag,
              notes,
              reminderDays: Number(days),
            };
            setOccasions((cur) => [newOcc, ...cur]);
            setShowAddOccasion(false);
            notifyModule(`Occasion reminder "${title}" added`);
          }}>
            <label className="form-label">Occasion Title<input required name="title" className="form-input mt-1" placeholder="e.g. Meera Raman 50th Birthday Celebration" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="form-label">Donor / Contact Name<input required name="donorName" className="form-input mt-1" placeholder="e.g. Meera Raman" /></label>
              <label className="form-label">Occasion Date<input required name="date" className="form-input mt-1" placeholder="e.g. 28 Oct" /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="form-label">Category / Priority<select name="tag" className="form-input mt-1">{['Priority', 'Campaign', 'Corporate', 'Individual'].map((t) => <option key={t}>{t}</option>)}</select></label>
              <label className="form-label">Notes<input name="notes" className="form-input mt-1" placeholder="e.g. Arrange personalized card & call" /></label>
            </div>
            <button type="submit" className="btn-primary w-full justify-center"><Plus size={15} /> Save Occasion</button>
          </form>
        </Dialog>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   4. BIRTHDAY PROJECT ENGAGEMENT & ACTIONS
   ═══════════════════════════════════════════════════════════════════════ */
export function BirthdayProjectEngagement() {
  const navigate = useNavigate();
  const [tasks, setTasks] = usePersistentState<BirthdayTaskItem[]>('birthday-project.tasks', birthdayTasks);
  const [queued, setQueued] = useState(0);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [showAddTask, setShowAddTask] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    const markOnline = () => {
      setIsOnline(true);
      if (queued > 0) notifyModule(`Reconnected: ${queued} actions synchronised successfully`);
      setQueued(0);
    };
    const markOffline = () => setIsOnline(false);
    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);
    return () => {
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
    };
  }, [queued]);

  const filteredTasks = useMemo(() => {
    return statusFilter === 'All' ? tasks : tasks.filter((t) => t.status === statusFilter);
  }, [tasks, statusFilter]);

  const markTaskCompleted = (idx: number) => {
    setTasks((cur) => cur.map((t, i) => i === idx ? { ...t, status: 'Completed' } : t));
    if (isOnline) {
      notifyModule('Task marked Completed and synced with CRM');
    } else {
      setQueued((c) => c + 1);
      notifyModule('Offline: Task marked Completed and queued for auto-sync');
    }
  };

  const deleteTask = (idx: number) => {
    setTasks((cur) => cur.filter((_, i) => i !== idx));
    notifyModule('Task removed');
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="page-title">Engagement & Actions</h1>
          <p className="page-subtitle">Volunteer & staff task cards, outreach assignments, action workspaces, and offline field tracking</p>
        </div>
        <button className="btn-primary text-sm" onClick={() => setShowAddTask(true)}><Plus size={15} /> Add Task Card</button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {['All', 'Pending', 'Scheduled', 'In progress', 'Completed'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${statusFilter === s ? 'bg-teal-600 text-white' : 'bg-white border text-slate-600 hover:bg-slate-50'}`}>{s}</button>
          ))}
        </div>
        <StatusBadge label={isOnline ? 'Online · Live Sync Active' : `Offline · ${queued} queued`} tone={isOnline ? 'green' : 'amber'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {filteredTasks.map((task, index) => (
          <div key={`${task.title}-${index}`} className="card hover:shadow-md transition">
            <div className="card-body">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-800 text-base">{task.title}</div>
                  <div className="mt-1 text-xs text-slate-500">Contact: <span className="font-semibold text-slate-700">{task.donorName ?? 'Asha Nair'}</span> • Due: {task.dueDate ?? 'Today'}</div>
                </div>
                <StatusBadge label={task.status} tone={task.status === 'Completed' ? 'green' : task.status === 'In progress' ? 'blue' : 'amber'} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-600 border-t pt-2.5">
                <span>Channel: <span className="font-semibold">{task.type}</span></span>
                <span>Assigned: <span className="font-semibold text-teal-700">{task.assignee}</span></span>
                <span>Priority: <span className="font-semibold">{task.priority ?? 'High'}</span></span>
              </div>
              {task.remarks && <p className="mt-2 text-xs italic text-slate-500 bg-slate-50 p-2 rounded-lg">{task.remarks}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-primary text-xs" onClick={() => navigate('/birthday-project/action-workspace')}><MessageSquare size={13} /> Start Action</button>
                <button className="btn-secondary text-xs" onClick={() => notifyModule(`Direct composer opened for ${task.donorName ?? task.assignee}`)}><Send size={13} /> Message</button>
                {task.status !== 'Completed' && (
                  <button className="btn-secondary text-xs !border-emerald-300 hover:!bg-emerald-50 text-emerald-800" onClick={() => markTaskCompleted(index)}><CheckCircle2 size={13} /> Mark Done</button>
                )}
                <button className="text-slate-400 hover:text-rose-600 p-1.5 ml-auto" title="Delete" onClick={() => deleteTask(index)}><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Field Sync Card */}
      <div className="card">
        <SectionHeader title="Field Teams Offline Queue & Sync" subtitle="Ensures outreach volunteers can log visits in low-connectivity areas" actions={
          <button className="btn-secondary text-xs" onClick={() => {
            if (queued > 0) {
              setQueued(0);
              notifyModule('Queued field actions successfully synced with the server');
            } else {
              notifyModule('All field logs are up-to-date');
            }
          }}>Force Sync Now</button>
        } />
        <div className="card-body grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs text-slate-500">Connection Mode</div>
            <div className="mt-1 font-bold text-slate-800">{isOnline ? 'Online (Realtime API)' : 'Offline (Local IndexedDB)'}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs text-slate-500">Queued Offline Submissions</div>
            <div className="mt-1 font-bold text-teal-700">{queued} actions pending upload</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs text-slate-500">Auto-Sync Status</div>
            <div className="mt-1 font-bold text-emerald-700">Active & Watching Network</div>
          </div>
        </div>
      </div>

      {showAddTask && (
        <Dialog title="Create Outreach Task Card" onClose={() => setShowAddTask(false)}>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const title = String(form.get('title') ?? '').trim();
            const donorName = String(form.get('donorName') ?? '').trim();
            const type = String(form.get('type') ?? 'Call') as any;
            const assignee = String(form.get('assignee') ?? 'Priya');
            const priority = String(form.get('priority') ?? 'High') as any;
            const dueDate = String(form.get('dueDate') ?? 'Tomorrow');
            const remarks = String(form.get('remarks') ?? '');
            if (!title) return;
            const newTask: BirthdayTaskItem = {
              id: `BT-${Date.now()}`,
              title,
              donorName,
              type,
              assignee,
              status: 'Pending',
              priority,
              dueDate,
              remarks,
            };
            setTasks((cur) => [newTask, ...cur]);
            setShowAddTask(false);
            notifyModule(`Task card "${title}" created`);
          }}>
            <label className="form-label">Task Title<input required name="title" className="form-input mt-1" placeholder="e.g. Birthday gift package hand delivery" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="form-label">Donor Name<input required name="donorName" className="form-input mt-1" placeholder="e.g. Rajesh Kumar" /></label>
              <label className="form-label">Channel<select name="type" className="form-input mt-1">{['Call', 'Gift', 'Visit', 'Email', 'WhatsApp'].map((t) => <option key={t}>{t}</option>)}</select></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="form-label">Assignee<select name="assignee" className="form-input mt-1">{['Priya', 'Vivek', 'Nisha', 'Ritu', 'Arun', 'Field Team'].map((a) => <option key={a}>{a}</option>)}</select></label>
              <label className="form-label">Priority<select name="priority" className="form-input mt-1"><option>High</option><option>Medium</option><option>Low</option></select></label>
            </div>
            <label className="form-label">Due Date<input name="dueDate" className="form-input mt-1" placeholder="e.g. 24 Oct 2026" /></label>
            <label className="form-label">Instructions / Remarks<textarea name="remarks" className="form-input mt-1" placeholder="Add specific donor preference or gift notes" /></label>
            <button type="submit" className="btn-primary w-full justify-center"><Plus size={15} /> Save Task Card</button>
          </form>
        </Dialog>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   5. BIRTHDAY PROJECT OUTCOMES & CONVERSION
   ═══════════════════════════════════════════════════════════════════════ */
export function BirthdayProjectOutcomes() {
  const [pledges, setPledges] = usePersistentState('birthday-project.pledges', [
    { donor: 'Asha Nair', occasion: 'Birthday 2026', pledged: 25000, cause: 'Education Access', status: 'Converted' },
    { donor: 'Lakshmi & Co.', occasion: 'Foundation Day', pledged: 150000, cause: 'Healthcare', status: 'Confirmed' },
    { donor: 'Rajesh Kumar', occasion: 'Birthday 2026', pledged: 10000, cause: 'Nutrition', status: 'Verbal' },
  ]);
  const [showAddPledge, setShowAddPledge] = useState(false);

  const funnel = [
    { name: 'Identified', value: 120 },
    { name: 'Connected', value: 88 },
    { name: 'Interested', value: 58 },
    { name: 'Pledged', value: 36 },
    { name: 'Converted', value: 24 },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="page-title">Outcomes & Conversion</h1>
          <p className="page-subtitle">Tracking celebration touchpoint conversions, donor response, pledged funds, and impact reports</p>
        </div>
        <button className="btn-primary text-sm" onClick={() => setShowAddPledge(true)}><Plus size={15} /> Record Pledge</button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card">
          <SectionHeader title="Celebration Conversion Funnel" subtitle="From identification to active contribution" />
          <div className="card-body">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={funnel}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#1AACB8" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <SectionHeader title="Celebration Revenue Streams" subtitle="Distribution across funding channels" />
          <div className="card-body">
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={revenueByCategory} dataKey="value" innerRadius={42} outerRadius={85} paddingAngle={4}>
                  {revenueByCategory.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <SectionHeader title="Active Celebration Pledges & Conversions" subtitle="Log of recent pledges committed during occasion outreach" />
        <div className="card-body overflow-x-auto">
          <table className="data-table min-w-[700px] w-full">
            <thead>
              <tr>
                <th>Donor</th>
                <th>Occasion</th>
                <th>Pledged Amount</th>
                <th>Target Cause</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pledges.map((p, idx) => (
                <tr key={`${p.donor}-${idx}`}>
                  <td className="font-semibold text-slate-800">{p.donor}</td>
                  <td>{p.occasion}</td>
                  <td className="font-bold text-teal-700">₹{p.pledged.toLocaleString('en-IN')}</td>
                  <td>{p.cause}</td>
                  <td><StatusBadge label={p.status} tone={p.status === 'Converted' ? 'green' : p.status === 'Confirmed' ? 'teal' : 'amber'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddPledge && (
        <Dialog title="Record Celebration Pledge" onClose={() => setShowAddPledge(false)}>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const donor = String(form.get('donor') ?? '').trim();
            const occasion = String(form.get('occasion') ?? 'Birthday 2026');
            const pledged = Number(form.get('pledged'));
            const cause = String(form.get('cause') ?? 'Education Access');
            const status = String(form.get('status') ?? 'Confirmed');
            if (!donor || !pledged) return;
            setPledges((cur) => [{ donor, occasion, pledged, cause, status }, ...cur]);
            setShowAddPledge(false);
            notifyModule(`Pledge of ₹${pledged.toLocaleString('en-IN')} logged for ${donor}`);
          }}>
            <label className="form-label">Donor Name<input required name="donor" className="form-input mt-1" placeholder="e.g. Asha Nair" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="form-label">Occasion<input required name="occasion" className="form-input mt-1" defaultValue="Birthday Celebration" /></label>
              <label className="form-label">Amount (₹)<input required type="number" min="100" name="pledged" className="form-input mt-1" placeholder="25000" /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="form-label">Target Cause<select name="cause" className="form-input mt-1">{['Education Access', 'Women Empowerment', 'Healthcare Outreach', 'Nutrition'].map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="form-label">Status<select name="status" className="form-input mt-1"><option>Confirmed</option><option>Verbal</option><option>Converted</option></select></label>
            </div>
            <button type="submit" className="btn-primary w-full justify-center"><Plus size={15} /> Save Pledge</button>
          </form>
        </Dialog>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   6. BIRTHDAY PROJECT DEPARTMENTS & RBAC
   ═══════════════════════════════════════════════════════════════════════ */
export function BirthdayProjectDepartments() {
  const [tasks, setTasks] = usePersistentState<DepartmentWorkspaceTask[]>('birthday-project.department-tasks', initialDepartmentTasks);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState('All');

  const openBoard = (dept: string) => {
    setSelectedDept(dept);
  };

  const deptTasks = useMemo(() => {
    if (!selectedDept) return [];
    return tasks.filter((t) => t.dept === selectedDept);
  }, [tasks, selectedDept]);

  const addTaskToDept = (stage: 'To do' | 'Doing' | 'Done') => {
    if (!selectedDept) return;
    const title = window.prompt(`New task title for ${selectedDept} (${stage}):`);
    if (!title?.trim()) return;
    const newTask: DepartmentWorkspaceTask = {
      id: `DT-${Date.now()}`,
      dept: selectedDept,
      title: title.trim(),
      stage,
      priority: 'Medium',
      assignee: 'Staff Officer',
      dueDate: '2026-11-15',
    };
    setTasks((cur) => [...cur, newTask]);
    notifyModule(`Task created for ${selectedDept}`);
  };

  const moveTaskStage = (taskId: string, newStage: 'To do' | 'Doing' | 'Done') => {
    setTasks((cur) => cur.map((t) => t.id === taskId ? { ...t, stage: newStage } : t));
    notifyModule('Task moved');
  };

  const filteredRoles = useMemo(() => {
    return selectedRole === 'All' ? rolePermissions : rolePermissions.filter((r) => r.role === selectedRole);
  }, [selectedRole]);

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header">
        <h1 className="page-title">Department Workflows & RBAC</h1>
        <p className="page-subtitle">Nine departmental operational boards with access-control governance and staff execution lanes</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {deptWorkspaces.map((dept, index) => {
          const metrics = departmentMetrics.find((entry) => entry.dept === dept);
          const deptTaskList = tasks.filter((t) => t.dept === dept);
          const openTasks = deptTaskList.length > 0 ? deptTaskList.length : (metrics?.tasks ?? 8 + index * 2);
          const completion = metrics?.completion ?? `${72 + index * 2}%`;

          return (
            <div key={dept} className="card hover:border-teal-300 transition">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-800 text-base">{dept}</div>
                  <Building2 size={16} className="text-teal-600" />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                  <span>{openTasks} active tasks</span>
                  <span className="font-semibold text-teal-700">{completion} complete</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { label: 'To do', count: deptTaskList.filter((t) => t.stage === 'To do').length || Math.max(1, Math.round(openTasks * 0.3)), style: 'bg-amber-50 text-amber-800' },
                    { label: 'Doing', count: deptTaskList.filter((t) => t.stage === 'Doing').length || Math.max(1, Math.round(openTasks * 0.3)), style: 'bg-blue-50 text-blue-800' },
                    { label: 'Done', count: deptTaskList.filter((t) => t.stage === 'Done').length || Math.max(2, Math.round(openTasks * 0.4)), style: 'bg-emerald-50 text-emerald-800' },
                  ].map((col) => (
                    <div key={col.label} className={`rounded-lg p-2 text-center ${col.style}`}>
                      <div className="text-sm font-bold">{col.count}</div>
                      <div className="text-[10px]">{col.label}</div>
                    </div>
                  ))}
                </div>
                <button className="btn-secondary mt-3.5 w-full justify-center text-xs" onClick={() => openBoard(dept)}>
                  Open {dept} Task Board <ArrowRight size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* RBAC Matrix Card */}
      <div className="card">
        <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="card-title">Role-Based Access Control (RBAC) Governance Matrix</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Strict multi-tier permissions safeguarding donor contact info and financial records</div>
          </div>
          <div className="flex items-center gap-2">
            <select className="form-input !w-auto text-xs" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
              <option value="All">All Roles</option>
              {rolePermissions.map((r) => <option key={r.role} value={r.role}>{r.role}</option>)}
            </select>
            <ShieldCheck className="text-teal-600" size={18} />
          </div>
        </div>
        <div className="card-body overflow-x-auto">
          <table className="data-table min-w-[700px] w-full">
            <thead>
              <tr>
                <th>Role Identity</th>
                <th>Authorised Routes</th>
                <th>Operational Permissions</th>
                <th>Data Scope</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoles.map((row) => (
                <tr key={row.role}>
                  <td className="font-bold text-slate-800">{row.role}</td>
                  <td>{row.routes}</td>
                  <td>{row.actions}</td>
                  <td>{row.data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Department Task Board Dialog */}
      {selectedDept && (
        <Dialog title={`${selectedDept} — Live Task Board`} onClose={() => setSelectedDept(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(['To do', 'Doing', 'Done'] as const).map((stage) => {
                const stageTasks = deptTasks.filter((t) => t.stage === stage);
                return (
                  <div key={stage} className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col justify-between min-h-[220px]">
                    <div>
                      <div className="flex items-center justify-between pb-2 mb-2 border-b">
                        <span className="font-bold text-xs text-slate-700 uppercase tracking-wider">{stage}</span>
                        <span className="badge badge-gray text-[10px]">{stageTasks.length}</span>
                      </div>
                      <div className="space-y-2">
                        {stageTasks.map((t) => (
                          <div key={t.id} className="rounded-lg bg-white p-2.5 shadow-xs border border-slate-200 text-xs">
                            <div className="font-semibold text-slate-800">{t.title}</div>
                            <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                              <span>{t.assignee}</span>
                              <span className="text-teal-700">{t.priority}</span>
                            </div>
                            <div className="mt-2 flex gap-1 justify-end border-t pt-1.5">
                              {stage !== 'To do' && (
                                <button className="text-[10px] text-slate-500 hover:text-slate-800" onClick={() => moveTaskStage(t.id, stage === 'Done' ? 'Doing' : 'To do')}>← Move</button>
                              )}
                              {stage !== 'Done' && (
                                <button className="text-[10px] font-semibold text-teal-700 hover:text-teal-900 ml-1" onClick={() => moveTaskStage(t.id, stage === 'To do' ? 'Doing' : 'Done')}>Advance →</button>
                              )}
                            </div>
                          </div>
                        ))}
                        {stageTasks.length === 0 && <div className="text-center text-xs text-slate-400 py-6 italic">No tasks in {stage}</div>}
                      </div>
                    </div>
                    <button className="btn-secondary !py-1 text-xs w-full justify-center mt-3" onClick={() => addTaskToDept(stage)}>
                      <Plus size={12} /> Add {stage} Task
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   7. BIRTHDAY PROJECT REPORTS & GOVERNANCE
   ═══════════════════════════════════════════════════════════════════════ */
export function BirthdayProjectReports() {
  const [period, setPeriod] = useState('Quarterly');
  const [logs, setLogs] = usePersistentState('birthday-project.audit-logs', [
    { event: 'Role access & staff permissions reviewed', detail: 'Admin · Today, 10:42 AM', status: 'Compliant' },
    { event: 'Celebration contribution record reconciled with bank receipt', detail: 'Finance · Today, 09:18 AM', status: 'Reconciled' },
    { event: 'Personal data access export generated for donor consent verification', detail: 'System · Yesterday', status: 'Logged' },
    { event: 'Quarterly statutory compliance checklist finalized', detail: 'Operations · 07 Oct', status: 'Compliant' },
  ]);
  const [showAddLog, setShowAddLog] = useState(false);

  const reportSections = [
    { title: 'Executive Summary', value: '78%', caption: 'Annual celebration goal reached' },
    { title: 'Task Completion', value: '89%', caption: 'Tasks closed on schedule' },
    { title: 'Interactions Logged', value: '1,420', caption: 'Occasion calls & deliveries' },
    { title: 'Contributions Recorded', value: '₹34.6L', caption: 'Celebration-linked giving' },
    { title: 'Campaign Sync', value: '5 / 5', caption: 'All campaigns connected' },
    { title: 'Impact Receipts Sent', value: '98%', caption: '80G & utilization receipts' },
    { title: 'Occasion Budget Utilized', value: '₹7.2L', caption: 'Within ₹10L ceiling' },
    { title: 'Retention Growth', value: '+14.2%', caption: 'Year-on-year donor retention' },
  ];

  const handleExport = () => {
    downloadCsv('birthday-project-report.csv', [
      ['Metric', 'Value', 'Status', 'Period'],
      ...reportSections.map((r) => [r.title, r.value, r.caption, period]),
    ]);
    notifyModule(`${period} report exported to CSV`);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="page-title">Reports & Governance</h1>
          <p className="page-subtitle">Board executive summaries, campaign metrics, statutory compliance, and audit trails</p>
        </div>
        <div className="flex gap-2">
          <select className="form-input !w-auto text-sm" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {['Monthly', 'Quarterly', 'Annual'].map((p) => <option key={p}>{p}</option>)}
          </select>
          <button className="btn-primary text-sm" onClick={handleExport}><Download size={15} /> Export Reports</button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {reportSections.map((item, index) => (
          <StatCard key={item.title} icon={index % 2 ? <TrendingUp size={18} /> : <BarChart3 size={18} />} label={item.title} value={item.value} sub={item.caption} tone={(['teal', 'blue', 'green', 'purple'] as const)[index % 4]} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card">
          <SectionHeader title="Contribution & Engagement Trends" subtitle="Monthly progress across giving and calls" />
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyTrend}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip />
                <Area dataKey="donors" name="Engagements" stroke="#1AACB8" fill="#CCFBF1" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <SectionHeader title="Audit & Compliance Logs" subtitle="Continuous statutory audit checkpoints" actions={<button className="btn-secondary text-xs" onClick={() => setShowAddLog(true)}><Plus size={12} /> Add Entry</button>} />
          <div className="card-body space-y-3">
            {logs.map((log, index) => (
              <div key={`${log.event}-${index}`} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                <div className="flex items-center gap-3">
                  <ShieldCheck size={16} className="text-teal-600 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{log.event}</div>
                    <div className="text-xs text-slate-500">{log.detail}</div>
                  </div>
                </div>
                <StatusBadge label={log.status} tone="green" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {showAddLog && (
        <Dialog title="Add Governance Audit Entry" onClose={() => setShowAddLog(false)}>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const event = String(form.get('event') ?? '').trim();
            const department = String(form.get('department') ?? 'Operations');
            if (!event) return;
            const newLog = {
              event,
              detail: `${department} · Just now`,
              status: 'Verified',
            };
            setLogs((cur) => [newLog, ...cur]);
            setShowAddLog(false);
            notifyModule('Audit entry recorded');
          }}>
            <label className="form-label">Audit / Review Description<input required name="event" className="form-input mt-1" placeholder="e.g. 80G tax receipt registry quarterly inspection" /></label>
            <label className="form-label">Department<select name="department" className="form-input mt-1">{deptWorkspaces.map((d) => <option key={d}>{d}</option>)}</select></label>
            <button type="submit" className="btn-primary w-full justify-center"><Check size={15} /> Save Audit Log</button>
          </form>
        </Dialog>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   8. BIRTHDAY PROJECT ACTION WORKSPACE (GUIDED 6-STEP WORKFLOW)
   ═══════════════════════════════════════════════════════════════════════ */
export function BirthdayProjectActionWorkspace() {
  const [profiles] = usePersistentState<BirthdayProfileItem[]>('birthday-project.profiles', birthdayProfiles);
  const [contributions, setContributions] = usePersistentState<ContributionItem[]>('donor-management.contributions', [
    { donor: 'Asha Nair', category: 'Online Donations', amount: 25000, date: '09 Oct 2026', group: 'Public & Small' },
    { donor: 'Sparsh Foods Pvt Ltd', category: 'CSR Funds', amount: 450000, date: '04 Oct 2026', group: 'Corporate & Large' },
  ]);
  const [, setComms] = usePersistentState<CommunicationLogItem[]>('donor-management.communications', communicationTimeline);

  const initialProfileId = localStorage.getItem('birthday-project.active-profile-id');
  const [selectedDonorId, setSelectedDonorId] = useState<string>(() => {
    return initialProfileId ? String(initialProfileId) : String(profiles[0]?.id ?? '1');
  });

  const selectedProfile = useMemo(() => {
    return profiles.find((p) => String(p.id) === String(selectedDonorId)) ?? profiles[0] ?? {
      id: 1, name: 'Asha Nair', relation: 'Individual', interest: 'Education', status: 'Warm', nextAction: 'Call donor', city: 'Bengaluru',
    };
  }, [profiles, selectedDonorId]);

  const [activeStep, setActiveStep] = useState(1);
  const [checklist, setChecklist] = useState(activityLog);
  const [chosenChannel, setChosenChannel] = useState('Call');
  const [conversationSummary, setConversationSummary] = useState('Called donor for birthday greetings. Expressed interest in supporting classroom smart learning kits.');
  const [sentiment, setSentiment] = useState('Warm & Interested');
  const [proofAttached, setProofAttached] = useState<string | null>(null);
  const [pledgeAmount, setPledgeAmount] = useState('15000');
  const [pledgeCause, setPledgeCause] = useState('Education Access');
  const [pledgeFollowUp, setPledgeFollowUp] = useState('2026-11-15');
  const [completedSuccess, setCompletedSuccess] = useState(false);

  const steps = [
    'Profile Context',
    'Pre-Check (7 Days)',
    'Occasion Action',
    'Log Response',
    'Outcome & Pledge',
    'Impact Feedback',
  ];

  const handleFinishJourney = () => {
    const amt = Number(pledgeAmount) || 0;
    if (amt > 0) {
      const newContrib: ContributionItem = {
        id: `CNTR-${Date.now()}`,
        donor: selectedProfile.name,
        category: 'Online Donations',
        amount: amt,
        date: new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date()),
        group: 'Public & Small',
        paymentMethod: 'UPI / Direct Bank',
        reference: `BPLY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        notes: `Pledge from Birthday Project outreach. Cause: ${pledgeCause}`,
      };
      setContributions((cur) => [newContrib, ...cur]);
    }

    const newComm: CommunicationLogItem = {
      id: `COM-${Date.now()}`,
      date: new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date()),
      donorName: selectedProfile.name,
      action: `Occasion outreach completed via ${chosenChannel}`,
      type: (['Call', 'Email', 'Meeting', 'Visit', 'Gift', 'WhatsApp'].includes(chosenChannel) ? chosenChannel : 'Call') as any,
      staff: 'Current User',
      summary: conversationSummary,
    };
    setComms((cur) => [newComm, ...cur]);

    setCompletedSuccess(true);
    notifyModule(`Engagement journey completed for ${selectedProfile.name}! Recorded ₹${amt.toLocaleString('en-IN')} pledge.`);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="page-title">Guided Action Workspace</h1>
          <p className="page-subtitle">End-to-end 6-step donor journey: preparation, outreach, recording pledge, and impact loop</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Active Supporter:</label>
          <select className="form-input !w-auto text-sm font-bold text-teal-800" value={selectedDonorId} onChange={(e) => {
            setSelectedDonorId(e.target.value);
            localStorage.setItem('birthday-project.active-profile-id', e.target.value);
            setCompletedSuccess(false);
          }}>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.city})</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {/* Stepper pills */}
          <div className="flex flex-wrap gap-2 mb-6 border-b pb-4">
            {steps.map((step, index) => {
              const isCurrent = activeStep === index + 1;
              const isPast = activeStep > index + 1;
              return (
                <button
                  key={step}
                  onClick={() => setActiveStep(index + 1)}
                  className={`rounded-full px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
                    isCurrent
                      ? 'bg-teal-600 text-white shadow-sm'
                      : isPast
                      ? 'bg-teal-100 text-teal-800'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {isPast ? <Check size={13} /> : <span>{index + 1}.</span>}
                  {step}
                </button>
              );
            })}
          </div>

          {/* STEP 1: Profile Context */}
          {activeStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border bg-slate-50 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-base">{selectedProfile.name}</span>
                    <StatusBadge label={selectedProfile.status} tone="green" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t">
                    <span className="text-slate-400">Relationship:</span><span className="font-semibold text-slate-800">{selectedProfile.relation}</span>
                    <span className="text-slate-400">City:</span><span>{selectedProfile.city}</span>
                    <span className="text-slate-400">Cause Interests:</span><span className="font-semibold text-teal-700">{selectedProfile.interest}</span>
                    <span className="text-slate-400">Phone:</span><span>{selectedProfile.phone ?? '+91 98765 43210'}</span>
                    <span className="text-slate-400">Email:</span><span>{selectedProfile.email ?? 'supporter@example.com'}</span>
                  </div>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-5 space-y-3">
                  <div className="font-bold text-slate-800 text-base">Interaction & Contribution History</div>
                  <div className="space-y-2 text-xs text-slate-600 pt-2 border-t">
                    <div className="flex justify-between"><span>Historical Contributions:</span><span className="font-bold text-slate-800">₹2,40,000</span></div>
                    <div className="flex justify-between"><span>Last Direct Contact:</span><span>10 days ago (Appreciation note)</span></div>
                    <div className="flex justify-between"><span>Response Quality:</span><span className="font-semibold text-teal-700">Warm and Supportive</span></div>
                    <div className="flex justify-between"><span>Preferred Channel:</span><span>Phone Call & WhatsApp</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Pre-Check */}
          {activeStep === 2 && (
            <div className="space-y-4">
              <div className="text-sm text-slate-600">Review mandatory pre-engagement checklist before initiating contact:</div>
              <div className="space-y-2.5">
                {checklist.map((item, index) => (
                  <button
                    key={item.label}
                    onClick={() => setChecklist((cur) => cur.map((c, i) => i === index ? { ...c, done: !c.done } : c))}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3.5 text-left hover:bg-slate-50 transition"
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${item.done ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {item.done ? <Check size={14} /> : <TimerReset size={14} />}
                    </div>
                    <span className={`text-sm ${item.done ? 'font-medium text-slate-800 line-through opacity-80' : 'font-medium text-slate-700'}`}>{item.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex justify-end">
                <button className="btn-secondary text-xs" onClick={() => setChecklist((cur) => cur.map((c) => ({ ...c, done: true })))}>Mark All Checked</button>
              </div>
            </div>
          )}

          {/* STEP 3: Occasion Action Channel */}
          {activeStep === 3 && (
            <div className="space-y-4">
              <div className="text-sm font-semibold text-slate-700">Select Outreach Mode for {selectedProfile.name}:</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { channel: 'Call', desc: 'Direct personalized phone call' },
                  { channel: 'WhatsApp', desc: 'Greeting card + photo message' },
                  { channel: 'Visit', desc: 'In-person meeting & token delivery' },
                  { channel: 'Gift delivery', desc: 'Handcrafted NGO gift bouquet' },
                  { channel: 'Letter or email', desc: 'Formal thank-you letter' },
                  { channel: 'Use template', desc: 'Automated merge greeting' },
                ].map((item) => (
                  <button
                    key={item.channel}
                    onClick={() => {
                      setChosenChannel(item.channel);
                      notifyModule(`${item.channel} channel selected`);
                    }}
                    className={`rounded-xl border p-4 text-left transition ${
                      chosenChannel === item.channel
                        ? 'border-teal-500 bg-teal-50/70 shadow-sm'
                        : 'border-slate-200 hover:border-teal-200 bg-white'
                    }`}
                  >
                    <div className="font-bold text-slate-800">{item.channel}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.desc}</div>
                  </button>
                ))}
              </div>
              <div className="rounded-xl bg-slate-50 p-4 border text-xs text-slate-600">
                <span className="font-bold">Active Channel: </span>{chosenChannel} selected. You can now execute the outreach and proceed to log the conversation details.
              </div>
            </div>
          )}

          {/* STEP 4: Log Response */}
          {activeStep === 4 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Conversation Summary & Donor Feedback</label>
                <textarea
                  className="form-input min-h-[110px] text-sm"
                  value={conversationSummary}
                  onChange={(e) => setConversationSummary(e.target.value)}
                  placeholder="Record summary of call, points discussed, and donor interest..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Donor Sentiment Rating</label>
                  <select className="form-input mt-1" value={sentiment} onChange={(e) => setSentiment(e.target.value)}>
                    <option>Warm & Interested</option>
                    <option>Delighted & Committed</option>
                    <option>Neutral / Follow-up later</option>
                    <option>Needs detailed project proposal</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Attach Visit / Outreach Proof (Photo/Letter)</label>
                  <div className="mt-1 flex items-center gap-2">
                    <label className="btn-secondary text-sm cursor-pointer">
                      <FileText size={15} /> {proofAttached ? 'Change file' : 'Upload proof file'}
                      <input type="file" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setProofAttached(file.name);
                          notifyModule(`${file.name} uploaded`);
                        }
                      }} />
                    </label>
                    {proofAttached && <span className="text-xs text-teal-700 font-semibold">{proofAttached}</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Outcome & Pledge */}
          {activeStep === 5 && (
            <div className="space-y-4">
              <div className="text-sm font-semibold text-slate-800">Record Contribution or Future Commitment:</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Pledge / Donation Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    className="form-input mt-1 font-bold text-teal-800"
                    value={pledgeAmount}
                    onChange={(e) => setPledgeAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Target Cause</label>
                  <select className="form-input mt-1" value={pledgeCause} onChange={(e) => setPledgeCause(e.target.value)}>
                    <option>Education Access</option>
                    <option>Women Empowerment</option>
                    <option>Healthcare Outreach</option>
                    <option>Child Nutrition</option>
                    <option>General Corpus</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Follow-Up Date</label>
                  <input
                    type="date"
                    className="form-input mt-1"
                    value={pledgeFollowUp}
                    onChange={(e) => setPledgeFollowUp(e.target.value)}
                  />
                </div>
              </div>
              <div className="rounded-xl bg-teal-50/70 p-4 border border-teal-200 text-xs text-teal-900">
                Pledging ₹{Number(pledgeAmount).toLocaleString('en-IN')} towards <span className="font-bold">{pledgeCause}</span>. Next reminder set for {pledgeFollowUp}.
              </div>
            </div>
          )}

          {/* STEP 6: Impact Feedback */}
          {activeStep === 6 && (
            <div className="space-y-4">
              <div className="rounded-2xl border bg-slate-50 p-5 space-y-4">
                <div className="font-bold text-slate-800">Finalise Engagement & Impact Loop</div>
                <div className="space-y-2 text-xs text-slate-600">
                  <div>✓ Outreach channel: <span className="font-semibold">{chosenChannel}</span></div>
                  <div>✓ Donor feedback recorded: <span className="font-semibold">{conversationSummary.substring(0, 60)}...</span></div>
                  <div>✓ Pledged amount: <span className="font-bold text-teal-700">₹{Number(pledgeAmount).toLocaleString('en-IN')}</span></div>
                  <div>✓ Linked cause: <span className="font-semibold">{pledgeCause}</span></div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <button className="btn-secondary text-sm" onClick={() => notifyModule('Thank-you note queued for dispatch')}><Gift size={15} /> Send Thank-You Note</button>
                  <button className="btn-secondary text-sm" onClick={() => notifyModule('Impact story packet shared via email')}><Eye size={15} /> Share Impact Report</button>
                </div>
              </div>

              {completedSuccess ? (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-center">
                  <CheckCircle2 size={36} className="text-emerald-600 mx-auto mb-2" />
                  <div className="font-bold text-emerald-900 text-base">Outreach Journey Completed & Reconciled!</div>
                  <p className="text-xs text-emerald-700 mt-1">The pledge, interaction log, and CRM profile have been synchronised with Donor Management.</p>
                </div>
              ) : (
                <button className="btn-primary w-full justify-center text-sm !py-3" onClick={handleFinishJourney}>
                  <CheckCircle2 size={16} /> Complete & Save Engagement to CRM
                </button>
              )}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="mt-8 flex justify-between border-t pt-4">
            <button
              className="btn-secondary text-sm"
              disabled={activeStep === 1}
              onClick={() => setActiveStep((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </button>
            {activeStep < steps.length && (
              <button
                className="btn-primary text-sm"
                onClick={() => setActiveStep((prev) => Math.min(steps.length, prev + 1))}
              >
                Next Step: {steps[activeStep]} <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   9. DONOR MANAGEMENT ADMIN DASHBOARD
   ═══════════════════════════════════════════════════════════════════════ */
export function DonorManagementAdminDashboard() {
  const [range, setRange] = useState('Last 6 months');
  const [donors] = usePersistentState<DonorProfileItem[]>('donor-management.directory', donorProfiles);
  const [contributions] = usePersistentState<ContributionItem[]>('donor-management.contributions', [
    { donor: 'Asha Nair', category: 'Online Donations', amount: 25000, date: '09 Oct 2026', group: 'Public & Small' },
    { donor: 'Sparsh Foods Pvt Ltd', category: 'CSR Funds', amount: 450000, date: '04 Oct 2026', group: 'Corporate & Large' },
    { donor: 'Nitin Mehta', category: 'Crowdfunding', amount: 12500, date: '01 Oct 2026', group: 'Public & Small' },
  ]);

  const individualCount = useMemo(() => donors.filter((d) => d.type === 'Individual').length, [donors]);
  const corporateCount = useMemo(() => donors.filter((d) => d.type === 'Corporate').length, [donors]);
  const totalRaised = useMemo(() => contributions.reduce((s, c) => s + c.amount, 0), [contributions]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="page-title">Donor Management Dashboard</h1>
          <p className="page-subtitle">Comprehensive donor analytics, funding streams, retention rates, and regional impact distribution</p>
        </div>
        <div className="flex gap-2">
          <select className="form-input !w-auto text-sm" value={range} onChange={(e) => setRange(e.target.value)}>
            {['Last 30 days', 'Last 6 months', 'Year to date', 'All time'].map((opt) => <option key={opt}>{opt}</option>)}
          </select>
          <button className="btn-primary text-sm" onClick={() => {
            downloadCsv('donor-management-summary.csv', [
              ['Metric', 'Value'],
              ['Total registered donors', donors.length],
              ['Individual donors', individualCount],
              ['Corporate partners', corporateCount],
              ['Funds recorded', totalRaised],
              ['Filter Range', range],
            ]);
            notifyModule('Dashboard summary exported');
          }}><Download size={15} /> Export</button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={<Users size={18} />} label="Total Donors" value={String(donors.length)} sub="+12% YoY" tone="teal" />
        <StatCard icon={<HeartHandshake size={18} />} label="Individual Donors" value={String(individualCount)} sub="Recurring" tone="blue" />
        <StatCard icon={<BriefcaseBusiness size={18} />} label="Corporate / CSR" value={String(corporateCount)} sub="High Value" tone="green" />
        <StatCard icon={<CircleDollarSign size={18} />} label="Recorded Giving" value={`₹${(totalRaised / 100000).toFixed(1)}L`} sub="Reconciled" tone="amber" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card xl:col-span-2">
          <SectionHeader title="Giving & Contribution Velocity" subtitle={`Monthly flow · ${range}`} />
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyTrend}>
                <defs>
                  <linearGradient id="donorTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(val) => `₹${Math.round(val / 1000)}k`} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => [`₹${(Number(value ?? 0) / 1000).toFixed(0)}k`, 'Contribution']} contentStyle={{ borderRadius: 12 }} />
                <Area type="monotone" dataKey="contributions" stroke="#3B82F6" fill="url(#donorTrend)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <SectionHeader title="Donor Retention Segments" subtitle="Segment breakdown" />
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={donorSegments} dataKey="value" innerRadius={36} outerRadius={86} paddingAngle={4}>
                  {donorSegments.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card">
          <SectionHeader title="Geographic Supporter Distribution" subtitle="Donors by state and city" />
          <div className="card-body">
            {cityDistribution.map((city) => (
              <div key={city.place} className="mb-3">
                <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                  <span className="font-semibold">{city.place}</span>
                  <span>{city.count} supporters</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-teal-500" style={{ width: `${(city.count / 42) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <SectionHeader title="Active Impact Campaigns" subtitle="Fundraising progress against target" />
          <div className="card-body space-y-3">
            {campaignData.map((campaign) => (
              <div key={campaign.name}>
                <div className="mb-1 flex items-center justify-between text-sm text-slate-700">
                  <span className="font-semibold">{campaign.name}</span>
                  <span className="font-bold text-teal-700">{campaign.amount}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-blue-500" style={{ width: `${campaign.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   10. DONOR MANAGEMENT DIRECTORY
   ═══════════════════════════════════════════════════════════════════════ */
export function DonorManagementDirectory() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [donors, setDonors] = usePersistentState<DonorProfileItem[]>('donor-management.directory', donorProfiles);
  const [showAdd, setShowAdd] = useState(false);
  const [editingDonor, setEditingDonor] = useState<DonorProfileItem | null>(null);
  const [selectedDonor, setSelectedDonor] = useState<DonorProfileItem | null>(null);
  const [profileTab, setProfileTab] = useState('Basic Info');

  const profileTabs = [
    'Basic Info', 'Contact Info', 'Address/Location', 'Relationship Type',
    'Connection Source', 'Cause Interests', 'Contribution History',
    'Communication History', 'Follow-Up History', 'Impact Reports',
  ];

  const filtered = useMemo(() => {
    return donors.filter((d) => {
      const matchQuery = `${d.name} ${d.city} ${d.cause} ${d.code ?? ''}`.toLowerCase().includes(query.toLowerCase());
      const matchType = !type || d.type === type;
      const matchStatus = !status || d.status === status;
      return matchQuery && matchType && matchStatus;
    });
  }, [donors, query, type, status]);

  const handleExport = () => {
    const headers = ['Code', 'Name', 'Type', 'City', 'State', 'Email', 'Phone', 'Cause', 'Status', 'Total Given', 'Last Contact'];
    const rows = filtered.map((d) => [d.code ?? '', d.name, d.type, d.city, d.state ?? '', d.email ?? '', d.phone ?? '', d.cause, d.status, d.amount, d.lastContact]);
    downloadCsv('donors-directory.csv', [headers, ...rows]);
    notifyModule(`Exported ${filtered.length} donors to CSV`);
  };

  const deleteDonor = (id: string | number) => {
    setDonors((cur) => cur.filter((d) => d.id !== id));
    notifyModule('Donor profile removed');
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="page-title">Donor Directory</h1>
          <p className="page-subtitle">Search, filter, edit, and track lifetime engagement and giving records</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm" onClick={handleExport}><Download size={15} /> Export CSV</button>
          <button className="btn-primary text-sm" onClick={() => setShowAdd(true)}><Plus size={15} /> Add Donor</button>
        </div>
      </div>

      <div className="card">
        <div className="card-body flex flex-col xl:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="form-input pl-9" placeholder="Search by name, donor ID, city, or cause" />
          </div>
          <select value={type} onChange={(e) => setType(e.target.value)} className="form-input !w-auto min-w-[150px]">
            <option value="">All donor types</option>
            <option>Individual</option>
            <option>Corporate</option>
            <option>Foundation</option>
            <option>Government</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-input !w-auto min-w-[140px]">
            <option value="">All statuses</option>
            {['Active', 'Engaged', 'Retention', 'Lapsed', 'New'].map((val) => <option key={val}>{val}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Registered Donors ({filtered.length})</div>
        </div>
        <div className="card-body overflow-x-auto">
          <table className="data-table min-w-[860px] w-full">
            <thead>
              <tr>
                <th>Code</th>
                <th>Donor Name</th>
                <th>Type</th>
                <th>City</th>
                <th>Cause Focus</th>
                <th>Lifetime Giving</th>
                <th>Status</th>
                <th>Last Contact</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((donor) => (
                <tr key={donor.id}>
                  <td className="text-xs font-mono text-slate-500">{donor.code ?? 'DON-00'}</td>
                  <td>
                    <button className="font-bold text-teal-700 hover:underline text-left" onClick={() => { setSelectedDonor(donor); setProfileTab('Basic Info'); }}>
                      {donor.name}
                    </button>
                  </td>
                  <td>{donor.type}</td>
                  <td>{donor.city}</td>
                  <td>{donor.cause}</td>
                  <td className="font-semibold text-slate-800">{donor.amount}</td>
                  <td><StatusBadge label={donor.status} tone={donor.status === 'Active' ? 'green' : donor.status === 'Engaged' ? 'teal' : 'blue'} /></td>
                  <td>{donor.lastContact}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button className="p-1 text-slate-400 hover:text-teal-600" title="Edit" onClick={() => setEditingDonor(donor)}><Edit size={14} /></button>
                      <button className="p-1 text-slate-400 hover:text-rose-600" title="Delete" onClick={() => deleteDonor(donor.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="py-8 text-center text-sm text-slate-500">No donors match your search criteria.</div>}
        </div>
      </div>

      {/* Add Donor Dialog */}
      {showAdd && (
        <Dialog title="Add New Donor" onClose={() => setShowAdd(false)}>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const name = String(form.get('name') ?? '').trim();
            const donorType = String(form.get('type') ?? 'Individual') as any;
            const city = String(form.get('city') ?? '').trim();
            const state = String(form.get('state') ?? '').trim();
            const cause = String(form.get('cause') ?? '').trim();
            const email = String(form.get('email') ?? '').trim();
            const phone = String(form.get('phone') ?? '').trim();
            const initialAmount = Number(form.get('amount') ?? 0);
            if (!name || !city || !cause) return;

            const newDonor: DonorProfileItem = {
              id: Date.now(),
              code: `DON-${Math.floor(100 + Math.random() * 900)}`,
              name,
              type: donorType,
              city,
              state: state || 'India',
              email,
              phone,
              cause,
              status: 'New',
              relation: 'New Supporter',
              amount: initialAmount > 0 ? `₹${initialAmount.toLocaleString('en-IN')}` : '₹0',
              amountNumeric: initialAmount,
              lastContact: 'Just now',
              connectionSource: 'Direct Intake',
            };
            setDonors((cur) => [newDonor, ...cur]);
            setShowAdd(false);
            notifyModule(`${name} added to donor directory`);
          }}>
            <label className="form-label">Donor or Organisation Name<input required name="name" className="form-input mt-1" placeholder="e.g. Dr. Sunita Rao or Zenith Corp" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="form-label">Type<select name="type" className="form-input mt-1"><option>Individual</option><option>Corporate</option><option>Foundation</option><option>Government</option></select></label>
              <label className="form-label">City<input required name="city" className="form-input mt-1" placeholder="e.g. Mumbai" /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="form-label">Email<input type="email" name="email" className="form-input mt-1" placeholder="donor@domain.org" /></label>
              <label className="form-label">Phone<input name="phone" className="form-input mt-1" placeholder="+91 98000 00000" /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="form-label">Primary Cause Interest<input required name="cause" className="form-input mt-1" placeholder="e.g. Education Access" /></label>
              <label className="form-label">Initial Donation (₹)<input type="number" min="0" name="amount" className="form-input mt-1" placeholder="0" /></label>
            </div>
            <button type="submit" className="btn-primary w-full justify-center mt-3"><Plus size={15} /> Save Donor</button>
          </form>
        </Dialog>
      )}

      {/* Edit Donor Dialog */}
      {editingDonor && (
        <Dialog title={`Edit: ${editingDonor.name}`} onClose={() => setEditingDonor(null)}>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setDonors((cur) => cur.map((d) => d.id === editingDonor.id ? {
              ...d,
              name: String(form.get('name') ?? d.name),
              type: String(form.get('type') ?? d.type) as any,
              city: String(form.get('city') ?? d.city),
              cause: String(form.get('cause') ?? d.cause),
              status: String(form.get('status') ?? d.status) as any,
              email: String(form.get('email') ?? d.email),
              phone: String(form.get('phone') ?? d.phone),
            } : d));
            setEditingDonor(null);
            notifyModule('Donor details updated');
          }}>
            <label className="form-label">Name<input required name="name" className="form-input mt-1" defaultValue={editingDonor.name} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="form-label">Type<select name="type" className="form-input mt-1" defaultValue={editingDonor.type}><option>Individual</option><option>Corporate</option><option>Foundation</option><option>Government</option></select></label>
              <label className="form-label">Status<select name="status" className="form-input mt-1" defaultValue={editingDonor.status}>{['Active', 'Engaged', 'Retention', 'Lapsed', 'New'].map((s) => <option key={s}>{s}</option>)}</select></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="form-label">City<input required name="city" className="form-input mt-1" defaultValue={editingDonor.city} /></label>
              <label className="form-label">Cause<input required name="cause" className="form-input mt-1" defaultValue={editingDonor.cause} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="form-label">Email<input name="email" className="form-input mt-1" defaultValue={editingDonor.email ?? ''} /></label>
              <label className="form-label">Phone<input name="phone" className="form-input mt-1" defaultValue={editingDonor.phone ?? ''} /></label>
            </div>
            <button type="submit" className="btn-primary w-full justify-center"><Check size={15} /> Save Changes</button>
          </form>
        </Dialog>
      )}

      {/* View Detailed Profile Modal with 10 Tabs */}
      {selectedDonor && (
        <Dialog title={`${selectedDonor.name} (${selectedDonor.code ?? 'DON-01'})`} onClose={() => setSelectedDonor(null)}>
          <div className="mb-4 flex flex-wrap gap-1.5 border-b pb-3">
            {profileTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setProfileTab(tab)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  profileTab === tab ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm leading-relaxed">
            {profileTab === 'Basic Info' && (
              <>
                <span className="text-slate-500">Full Name:</span><span className="font-semibold text-slate-800">{selectedDonor.name}</span>
                <span className="text-slate-500">Donor Type:</span><span>{selectedDonor.type}</span>
                <span className="text-slate-500">Status:</span><StatusBadge label={selectedDonor.status} tone="green" />
                <span className="text-slate-500">System Code:</span><span className="font-mono">{selectedDonor.code}</span>
              </>
            )}
            {profileTab === 'Contact Info' && (
              <>
                <span className="text-slate-500">Email:</span><span>{selectedDonor.email ?? 'contact@domain.com'}</span>
                <span className="text-slate-500">Phone:</span><span>{selectedDonor.phone ?? '+91 98765 43210'}</span>
                <span className="text-slate-500">Preferred Channel:</span><span>Email & WhatsApp Updates</span>
              </>
            )}
            {profileTab === 'Address/Location' && (
              <>
                <span className="text-slate-500">City:</span><span>{selectedDonor.city}</span>
                <span className="text-slate-500">State / Region:</span><span>{selectedDonor.state ?? 'Maharashtra'}</span>
                <span className="text-slate-500">Country:</span><span>India</span>
              </>
            )}
            {profileTab === 'Relationship Type' && (
              <>
                <span className="text-slate-500">Relationship:</span><span>{selectedDonor.relation}</span>
                <span className="text-slate-500">Engagement Stage:</span><span>Active Supporter Circle</span>
              </>
            )}
            {profileTab === 'Connection Source' && (
              <>
                <span className="text-slate-500">Acquisition Source:</span><span>{selectedDonor.connectionSource ?? 'Community Referrals'}</span>
                <span className="text-slate-500">First Connected:</span><span>2024 Annual Impact Drive</span>
              </>
            )}
            {profileTab === 'Cause Interests' && (
              <>
                <span className="text-slate-500">Primary Cause:</span><span className="font-semibold text-teal-700">{selectedDonor.cause}</span>
                <span className="text-slate-500">Linked Projects:</span><span>School Mid-Day Meals & Classroom Supplies</span>
              </>
            )}
            {profileTab === 'Contribution History' && (
              <>
                <span className="text-slate-500">Lifetime Giving:</span><span className="font-bold text-slate-800">{selectedDonor.amount}</span>
                <span className="text-slate-500">Last Recorded:</span><span>{selectedDonor.lastContact}</span>
              </>
            )}
            {profileTab === 'Communication History' && (
              <>
                <span className="text-slate-500">Last Outreach:</span><span>{selectedDonor.lastContact}</span>
                <span className="text-slate-500">Interaction Log:</span><span>Quarterly progress call & festive greeting card</span>
              </>
            )}
            {profileTab === 'Follow-Up History' && (
              <>
                <span className="text-slate-500">Follow-up Status:</span><span className="text-emerald-700 font-semibold">Scheduled</span>
                <span className="text-slate-500">Next Planned Action:</span><span>Birthday celebration bouquet & impact update</span>
              </>
            )}
            {profileTab === 'Impact Reports' && (
              <>
                <span className="text-slate-500">Latest Impact Pack:</span><span>Q2 2026 Child Nutrition Outcomes Report</span>
                <span className="text-slate-500">80G Tax Receipt:</span><span>Issued and mailed</span>
              </>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              className="btn-primary w-full justify-center text-sm"
              onClick={() => {
                localStorage.setItem('birthday-project.active-profile-id', String(selectedDonor.id));
                notifyModule(`Switching to Birthday Project outreach for ${selectedDonor.name}`);
                navigate('/birthday-project/action-workspace');
              }}
            >
              <Sparkles size={15} /> Start Outreach in Birthday Project
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   11. DONOR MANAGEMENT CONTRIBUTIONS (24 CATEGORIES)
   ═══════════════════════════════════════════════════════════════════════ */
export function DonorManagementContributions() {
  const [group, setGroup] = useState('Public & Small');
  const [showAdd, setShowAdd] = useState(false);
  const [records, setRecords] = usePersistentState<ContributionItem[]>('donor-management.contributions', [
    { donor: 'Asha Nair', category: 'Online Donations', amount: 25000, date: '09 Oct 2026', group: 'Public & Small' },
    { donor: 'Sparsh Foods Pvt Ltd', category: 'CSR Funds', amount: 450000, date: '04 Oct 2026', group: 'Corporate & Large' },
    { donor: 'Nitin Mehta', category: 'Crowdfunding', amount: 12500, date: '01 Oct 2026', group: 'Public & Small' },
    { donor: 'Kirana Foundation', category: 'NGO/Government Grants', amount: 800000, date: '28 Sep 2026', group: 'Corporate & Large' },
    { donor: 'Youth Vocational Alumni', category: 'Social Businesses', amount: 35000, date: '24 Sep 2026', group: 'Self-Funding' },
  ]);

  const categories: Record<string, string[]> = {
    'Public & Small': ['Crowdfunding', 'Donation Boxes', 'Fundraising Events', 'Online Donations', 'Material Donations', 'Time/Volunteer Donations'],
    'Corporate & Large': ['CSR Funds', 'International CSR', 'Employee Giving', 'Matching Funds', 'Brand Sponsorships', 'NGO/Government Grants', 'Foreign Grants', 'Auctions', 'Bequests', 'Family Philanthropy'],
    'Self-Funding': ['Social Businesses', 'Mission-Linked Services', 'Session/Training Fees', 'Course Fees', 'Memberships', 'Corpus/Endowment', 'Awards', 'Social Media Income'],
  };

  const visibleRecords = useMemo(() => {
    return records.filter((r) => categories[group]?.includes(r.category));
  }, [records, group]);

  const groupTotal = useMemo(() => visibleRecords.reduce((sum, r) => sum + r.amount, 0), [visibleRecords]);
  const largest = useMemo(() => Math.max(0, ...visibleRecords.map((r) => r.amount)), [visibleRecords]);

  const categoryTotals = useMemo(() => {
    return (categories[group] ?? []).map((name) => ({
      name,
      total: visibleRecords.filter((r) => r.category === name).reduce((sum, r) => sum + r.amount, 0),
    }));
  }, [categories, group, visibleRecords]);

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="page-title">Contributions & Donations</h1>
          <p className="page-subtitle">Track public micro-donations, corporate CSR allocations, and self-funding income streams</p>
        </div>
        <button className="btn-primary text-sm" onClick={() => setShowAdd(true)}><Plus size={15} /> Add Contribution</button>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.keys(categories).map((name) => (
          <button key={name} onClick={() => setGroup(name)} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${group === name ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-teal-50'}`}>
            {name} ({categories[name].length} categories)
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={<CircleDollarSign size={18} />} label={`${group} Total`} value={`₹${groupTotal.toLocaleString('en-IN')}`} sub="Reconciled" tone="teal" />
        <StatCard icon={<Users size={18} />} label="Logged Records" value={String(visibleRecords.length)} sub="In this stream" tone="blue" />
        <StatCard icon={<TrendingUp size={18} />} label="Largest Gift" value={`₹${largest.toLocaleString('en-IN')}`} sub="Top contribution" tone="amber" />
        <StatCard icon={<CheckCircle2 size={18} />} label="Category Portfolios" value={String(categories[group]?.length ?? 0)} sub="Tax Compliant" tone="green" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {categoryTotals.map(({ name, total }) => (
          <div key={name} className="card hover:border-teal-300 transition">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-800">{name}</div>
                <StatusBadge label="Reconciled" tone="teal" />
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div className="text-sm font-bold text-teal-800">Total: ₹{total.toLocaleString('en-IN')}</div>
                <div className="flex h-8 items-end gap-1">
                  {[40, 65, 45, 80, 60, 95].map((h, i) => (
                    <span key={i} className="w-1.5 rounded-t bg-teal-400" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <SectionHeader title={`${group} Contribution Ledger`} subtitle="Recent verified contributions in this stream" actions={
          <button className="btn-secondary text-sm" onClick={() => {
            downloadCsv('contributions.csv', [
              ['Donor', 'Category', 'Amount', 'Date', 'Method'],
              ...visibleRecords.map((r) => [r.donor, r.category, r.amount, r.date, r.paymentMethod ?? 'Direct Transfer']),
            ]);
            notifyModule('Contributions ledger exported');
          }}><Download size={14} /> Export CSV</button>
        } />
        <div className="card-body overflow-x-auto">
          <table className="data-table min-w-[700px] w-full">
            <thead>
              <tr>
                <th>Donor / Benefactor</th>
                <th>Category</th>
                <th>Amount (₹)</th>
                <th>Payment Mode</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((r, i) => (
                <tr key={`${r.donor}-${i}`}>
                  <td className="font-semibold text-slate-800">{r.donor}</td>
                  <td>{r.category}</td>
                  <td className="font-bold text-teal-700">₹{r.amount.toLocaleString('en-IN')}</td>
                  <td>{r.paymentMethod ?? 'Online UPI'}</td>
                  <td>{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleRecords.length === 0 && <div className="py-8 text-center text-sm text-slate-500">No contribution records in this group yet.</div>}
        </div>
      </div>

      {showAdd && (
        <Dialog title="Record Contribution" onClose={() => setShowAdd(false)}>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const donor = String(form.get('donor') ?? '').trim();
            const category = String(form.get('category') ?? categories[group][0]);
            const amount = Number(form.get('amount'));
            const paymentMethod = String(form.get('paymentMethod') ?? 'UPI');
            if (!donor || !amount) return;
            const newRecord: ContributionItem = {
              donor,
              category,
              amount,
              date: new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date()),
              group: group as any,
              paymentMethod,
            };
            setRecords((cur) => [newRecord, ...cur]);
            setShowAdd(false);
            notifyModule(`Contribution of ₹${amount.toLocaleString('en-IN')} saved for ${donor}`);
          }}>
            <label className="form-label">Donor Name<input required name="donor" className="form-input mt-1" placeholder="e.g. Asha Nair" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="form-label">Category<select name="category" className="form-input mt-1">{categories[group].map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="form-label">Amount (₹)<input required type="number" min="1" name="amount" className="form-input mt-1" placeholder="25000" /></label>
            </div>
            <label className="form-label">Payment Method<select name="paymentMethod" className="form-input mt-1"><option>UPI</option><option>Bank Transfer / NEFT</option><option>Cheque</option><option>Credit / Debit Card</option><option>Cash</option></select></label>
            <button type="submit" className="btn-primary w-full justify-center mt-3"><Plus size={15} /> Save Contribution</button>
          </form>
        </Dialog>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   12. DONOR MANAGEMENT CAMPAIGNS & CAUSES
   ═══════════════════════════════════════════════════════════════════════ */
export function DonorManagementCampaigns() {
  const [status, setStatus] = useState('All');
  const [campaigns, setCampaigns] = usePersistentState<CampaignItem[]>('donor-management.campaigns', campaignData);
  const [causes, setCauses] = usePersistentState('donor-management.causes', causeData);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignItem | null>(null);
  const [showAddCampaign, setShowAddCampaign] = useState(false);
  const [showAddCause, setShowAddCause] = useState(false);

  const visibleCampaigns = useMemo(() => {
    return status === 'All' ? campaigns : campaigns.filter((c) => c.status === status);
  }, [campaigns, status]);

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="page-title">Campaigns & Causes</h1>
          <p className="page-subtitle">Align fundraising drives with mission causes, projects, and target donor circles</p>
        </div>
        <div className="flex gap-2">
          <select className="form-input !w-auto text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            {['All', 'Active', 'Upcoming', 'Completed'].map((s) => <option key={s}>{s}</option>)}
          </select>
          <button className="btn-secondary text-sm" onClick={() => setShowAddCause(true)}><Plus size={14} /> Add Cause</button>
          <button className="btn-primary text-sm" onClick={() => setShowAddCampaign(true)}><Plus size={14} /> Add Campaign</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {visibleCampaigns.map((camp) => (
          <button key={camp.name} onClick={() => setSelectedCampaign(camp)} className="card text-left transition hover:-translate-y-0.5 hover:shadow-md cursor-pointer">
            <div className="card-header">
              <div className="card-title">{camp.name}</div>
              <StatusBadge label={camp.status} tone={camp.status === 'Active' ? 'green' : 'blue'} />
            </div>
            <div className="card-body">
              <div className="mb-2 flex justify-between text-sm text-slate-600">
                <span>Goal progress</span>
                <span className="font-bold text-slate-800">{camp.progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-teal-500" style={{ width: `${camp.progress}%` }} />
              </div>
              <div className="mt-3 flex justify-between text-xs text-slate-500">
                <span>Raised: <span className="font-bold text-slate-800">{camp.amount}</span></span>
                <span>Cause: <span className="font-semibold text-teal-700">{camp.cause ?? 'Education'}</span></span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Cause Portfolio Table */}
      <div className="card">
        <SectionHeader title="Mission Cause Portfolio" subtitle="Thematic program allocations and registered donors" />
        <div className="card-body overflow-x-auto">
          <table className="data-table min-w-[600px] w-full">
            <thead>
              <tr>
                <th>Cause Program</th>
                <th>Supporters Linked</th>
                <th>Annual Target Budget</th>
              </tr>
            </thead>
            <tbody>
              {causes.map((c) => (
                <tr key={c.name}>
                  <td className="font-semibold text-slate-800">{c.name}</td>
                  <td>{c.donors} donors</td>
                  <td className="font-bold text-teal-700">{c.budget}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCampaign && (
        <Dialog title={selectedCampaign.name} onClose={() => setSelectedCampaign(null)}>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Target Progress:</span>
              <span className="font-bold text-teal-700">{selectedCampaign.progress}%</span>
            </div>
            <div className="h-3 rounded-full bg-slate-200">
              <div className="h-3 rounded-full bg-teal-500" style={{ width: `${selectedCampaign.progress}%` }} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
              <div>Funds Raised: <span className="font-bold text-slate-800">{selectedCampaign.amount}</span></div>
              <div>Target: <span className="font-bold text-slate-800">{selectedCampaign.target ?? '₹25L'}</span></div>
              <div>Status: <span className="font-semibold">{selectedCampaign.status}</span></div>
              <div>Cause: <span className="font-semibold text-teal-700">{selectedCampaign.cause ?? 'Education'}</span></div>
            </div>
            <button className="btn-secondary w-full justify-center" onClick={() => {
              notifyModule(`Campaign report generated for ${selectedCampaign.name}`);
              setSelectedCampaign(null);
            }}><Eye size={15} /> Download Campaign Performance Summary</button>
          </div>
        </Dialog>
      )}

      {showAddCampaign && (
        <Dialog title="Add Fundraising Campaign" onClose={() => setShowAddCampaign(false)}>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const name = String(form.get('name') ?? '').trim();
            const amount = String(form.get('amount') ?? '₹10L');
            const cause = String(form.get('cause') ?? 'Education Access');
            if (!name) return;
            const newCamp: CampaignItem = {
              name,
              amount,
              progress: 10,
              status: 'Active',
              cause,
            };
            setCampaigns((cur) => [newCamp, ...cur]);
            setShowAddCampaign(false);
            notifyModule(`Campaign "${name}" created`);
          }}>
            <label className="form-label">Campaign Name<input required name="name" className="form-input mt-1" placeholder="e.g. Winter Warmth Drive 2026" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="form-label">Target Goal<input required name="amount" className="form-input mt-1" placeholder="e.g. ₹15L" /></label>
              <label className="form-label">Cause<select name="cause" className="form-input mt-1">{causes.map((c) => <option key={c.name}>{c.name}</option>)}</select></label>
            </div>
            <button type="submit" className="btn-primary w-full justify-center"><Plus size={15} /> Save Campaign</button>
          </form>
        </Dialog>
      )}

      {showAddCause && (
        <Dialog title="Add Cause Program" onClose={() => setShowAddCause(false)}>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const name = String(form.get('name') ?? '').trim();
            const budget = String(form.get('budget') ?? '₹30L');
            if (!name) return;
            setCauses((cur) => [...cur, { name, donors: 0, budget }]);
            setShowAddCause(false);
            notifyModule(`Cause program "${name}" created`);
          }}>
            <label className="form-label">Cause Program Name<input required name="name" className="form-input mt-1" placeholder="e.g. Clean Drinking Water" /></label>
            <label className="form-label">Annual Budget Goal<input required name="budget" className="form-input mt-1" placeholder="e.g. ₹35L" /></label>
            <button type="submit" className="btn-primary w-full justify-center"><Plus size={15} /> Save Cause</button>
          </form>
        </Dialog>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   13. DONOR MANAGEMENT COMMUNICATION & RELATIONSHIPS
   ═══════════════════════════════════════════════════════════════════════ */
export function DonorManagementCommunication() {
  const [logs, setLogs] = usePersistentState<CommunicationLogItem[]>('donor-management.communications', communicationTimeline);
  const [showLogModal, setShowLogModal] = useState<null | 'Call' | 'Email' | 'Meeting'>(null);

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="page-title">Communication & Relationships</h1>
          <p className="page-subtitle">Touchpoint records, call notes, milestone emails, and donor journey relationship logs</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm" onClick={() => setShowLogModal('Call')}><Phone size={14} /> Log Call</button>
          <button className="btn-secondary text-sm" onClick={() => setShowLogModal('Email')}><Mail size={14} /> Log Email</button>
          <button className="btn-primary text-sm" onClick={() => setShowLogModal('Meeting')}><Users size={14} /> Log Meeting</button>
        </div>
      </div>

      <div className="card">
        <SectionHeader title="Unified Communication Timeline" subtitle="Chronological interactions logged by staff and field volunteers" />
        <div className="card-body space-y-3">
          {logs.map((item, index) => (
            <div key={`${item.date}-${index}`} className="flex gap-3 rounded-xl border border-slate-200 p-4 hover:bg-slate-50 transition">
              <div className={`w-2 rounded-full shrink-0 ${item.type === 'Call' ? 'bg-amber-400' : item.type === 'Meeting' ? 'bg-blue-500' : item.type === 'Email' ? 'bg-teal-500' : 'bg-purple-500'}`} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-800">{item.action}</div>
                  <div className="text-xs text-slate-400">{item.date}</div>
                </div>
                <div className="mt-1 text-xs text-slate-600">Supporter: <span className="font-semibold text-slate-700">{item.donorName ?? 'Asha Nair'}</span> • Staff: {item.staff ?? 'Priya'}</div>
                {item.summary && <div className="mt-2 text-xs text-slate-500 bg-white border rounded-lg p-2.5">{item.summary}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showLogModal && (
        <Dialog title={`Log ${showLogModal}`} onClose={() => setShowLogModal(null)}>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const donorName = String(form.get('donorName') ?? '').trim();
            const action = String(form.get('action') ?? '').trim();
            const summary = String(form.get('summary') ?? '').trim();
            if (!donorName || !action) return;

            const newLog: CommunicationLogItem = {
              id: `COM-${Date.now()}`,
              date: 'Today',
              donorName,
              action,
              type: showLogModal,
              staff: 'Current User',
              summary,
            };
            setLogs((cur) => [newLog, ...cur]);
            setShowLogModal(null);
            notifyModule(`${showLogModal} logged for ${donorName}`);
          }}>
            <label className="form-label">Donor Name<input required name="donorName" className="form-input mt-1" placeholder="e.g. Sparsh Foods or Asha Nair" /></label>
            <label className="form-label">Action / Subject<input required name="action" className="form-input mt-1" placeholder="e.g. Quarterly CSR milestone discussion call" /></label>
            <label className="form-label">Summary Notes<textarea name="summary" className="form-input mt-1 min-h-[90px]" placeholder="Summary of points agreed, action items, next date" /></label>
            <button type="submit" className="btn-primary w-full justify-center"><Check size={15} /> Save Communication Log</button>
          </form>
        </Dialog>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   14. DONOR MANAGEMENT FOLLOW-UP PIPELINE (KANBAN)
   ═══════════════════════════════════════════════════════════════════════ */
export function DonorManagementFollowUp() {
  const [pipeline, setPipeline] = usePersistentState<PipelineLaneItem[]>('donor-management.pipeline', donorPipeline);
  const lanes = useMemo(() => pipeline.map((l) => l.lane), [pipeline]);
  const [showAddLead, setShowAddLead] = useState(false);

  const moveDonor = (donor: string, nextLane: string) => {
    setPipeline((current) => current.map((lane) => ({
      ...lane,
      items: lane.lane === nextLane
        ? lane.items.includes(donor) ? lane.items : [...lane.items, donor]
        : lane.items.filter((item) => item !== donor),
    })));
    notifyModule(`${donor} moved to ${nextLane}`);
  };

  const removeDonor = (donor: string, fromLane: string) => {
    setPipeline((current) => current.map((lane) => ({
      ...lane,
      items: lane.lane === fromLane ? lane.items.filter((i) => i !== donor) : lane.items,
    })));
    notifyModule(`${donor} removed from pipeline`);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="page-title">Follow-Up & Action Planning</h1>
          <p className="page-subtitle">Kanban donor stewardship pipeline: stewardship stages from identification to sustained relationship</p>
        </div>
        <button className="btn-primary text-sm" onClick={() => setShowAddLead(true)}><Plus size={15} /> Add Supporter to Pipeline</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {pipeline.map((lane) => (
          <div key={lane.lane} className="card flex flex-col justify-between">
            <div>
              <div className="card-header pb-2 mb-2 border-b">
                <div className="font-bold text-xs text-slate-700 uppercase tracking-wider">{lane.lane}</div>
                <span className="badge badge-gray text-[10px]">{lane.items.length}</span>
              </div>
              <div className="card-body min-h-[160px] space-y-2 p-3">
                {lane.items.map((item) => (
                  <div key={item} className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-xs hover:border-teal-300 transition">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-slate-800">{item}</span>
                      <button className="text-slate-300 hover:text-rose-500" onClick={() => removeDonor(item, lane.lane)}><X size={12} /></button>
                    </div>
                    <select
                      value={lane.lane}
                      onChange={(e) => moveDonor(item, e.target.value)}
                      className="form-input !py-1 text-[11px] text-teal-800 font-semibold"
                    >
                      {lanes.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                    </select>
                  </div>
                ))}
                {lane.items.length === 0 && <div className="text-xs text-slate-400 italic text-center py-6">Empty stage</div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: 'Follow-up Reminders', count: '18 due this week', icon: <BellRing size={17} /> },
          { label: 'Pledge Check-ins', count: '7 active pledges awaiting bank credit', icon: <CircleDollarSign size={17} /> },
          { label: 'Occasion Milestones', count: '12 personalized greetings ready', icon: <MessageSquare size={17} /> },
        ].map((item) => (
          <div key={item.label} className="card">
            <div className="card-body flex items-center gap-3">
              <div className="rounded-xl bg-teal-50 p-3 text-teal-700">{item.icon}</div>
              <div>
                <div className="font-semibold text-slate-800">{item.label}</div>
                <div className="text-xs text-slate-500">{item.count}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAddLead && (
        <Dialog title="Add Supporter to Follow-Up Pipeline" onClose={() => setShowAddLead(false)}>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const name = String(form.get('name') ?? '').trim();
            const lane = String(form.get('lane') ?? 'Identify');
            if (!name) return;
            setPipeline((cur) => cur.map((l) => l.lane === lane ? { ...l, items: [...l.items, name] } : l));
            setShowAddLead(false);
            notifyModule(`${name} added to "${lane}" lane`);
          }}>
            <label className="form-label">Supporter Name<input required name="name" className="form-input mt-1" placeholder="e.g. Dr. Homi Bhabha Trust" /></label>
            <label className="form-label">Initial Stage<select name="lane" className="form-input mt-1">{lanes.map((l) => <option key={l}>{l}</option>)}</select></label>
            <button type="submit" className="btn-primary w-full justify-center"><Plus size={15} /> Add to Pipeline</button>
          </form>
        </Dialog>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   15. DONOR MANAGEMENT REPORTS & EXPORT
   ═══════════════════════════════════════════════════════════════════════ */
export function DonorManagementReports() {
  const [period, setPeriod] = useState('Quarterly');
  const reports = [
    { name: 'Comprehensive Donor Master Report', period: 'Q3 2026', owner: 'Operations', status: 'Final' },
    { name: 'Donation Reconciliation & 80G Registry', period: 'Q3 2026', owner: 'Finance', status: 'Final' },
    { name: 'Campaign Fundraising Performance', period: 'Q2 2026', owner: 'Marketing', status: 'Final' },
    { name: 'Statutory Board Summary Pack', period: 'Q3 2026', owner: 'Executive Director', status: 'Final' },
  ];

  const handleExportAll = () => {
    downloadCsv('donor-management-full-report.csv', [
      ['Report Name', 'Period', 'Owner', 'Status'],
      ...reports.map((r) => [r.name, period, r.owner, r.status]),
    ]);
    notifyModule(`${period} audit reports downloaded as CSV`);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="page-title">Reports & Export</h1>
          <p className="page-subtitle">Donor growth, retention audits, statutory filing summaries, and export-ready compliance packets</p>
        </div>
        <div className="flex gap-2">
          <select className="form-input !w-auto text-sm" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {['Monthly', 'Quarterly', 'Yearly'].map((p) => <option key={p}>{p}</option>)}
          </select>
          <button className="btn-primary text-sm" onClick={handleExportAll}><Download size={15} /> Export Reports</button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={<TrendingUp size={18} />} label="Donor Growth" value="18.4%" sub="Year-on-year" tone="teal" />
        <StatCard icon={<Users size={18} />} label="Retention Rate" value="76%" sub="Active recurring" tone="blue" />
        <StatCard icon={<CircleDollarSign size={18} />} label="Donation Trend" value="₹34.8L" sub="This quarter" tone="green" />
        <StatCard icon={<Download size={18} />} label="Export Ready" value="4 Packets" sub="Audit certified" tone="purple" />
      </div>

      <div className="card">
        <SectionHeader title="Statutory & Board Audit Registry" subtitle="Historical report filings and contribution logs" />
        <div className="card-body overflow-x-auto">
          <table className="data-table min-w-[650px] w-full">
            <thead>
              <tr>
                <th>Report Packet</th>
                <th>Filing Period</th>
                <th>Responsible Team</th>
                <th>Compliance Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((item) => (
                <tr key={item.name}>
                  <td className="font-semibold text-slate-800">{item.name}</td>
                  <td>{item.period}</td>
                  <td>{item.owner}</td>
                  <td><StatusBadge label={item.status} tone="green" /></td>
                  <td>
                    <button className="btn-secondary !py-1 text-xs" onClick={() => {
                      downloadCsv(`${item.name.toLowerCase().replace(/\s+/g, '-')}.csv`, [
                        ['Report', item.name],
                        ['Period', item.period],
                        ['Authorised By', item.owner],
                        ['Status', 'Approved & Reconciled'],
                      ]);
                      notifyModule(`Downloaded ${item.name}`);
                    }}><Download size={12} /> Download</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
