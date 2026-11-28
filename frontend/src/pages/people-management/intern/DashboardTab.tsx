import { useEffect, useState } from 'react';
import { GraduationCap, UserCheck, Inbox, Search, Award, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { StatCard, ACCENT } from '../../../components/people';
import { peopleApi, type InternDashboardData } from '../../../services/peopleApi';

const COLORS = ['#94A3B8', '#3B82F6', '#8B5CF6', '#1AACB8', '#EF4444', '#10B981'];
const TOOLTIP_STYLE = { borderRadius: 8, border: '1px solid #DCE7E4', boxShadow: '0 8px 24px rgb(35 61 57 / 10%)', fontSize: 12 };

interface Props {
  onNavigateTab?: (tab: string) => void;
}

export default function DashboardTab({ onNavigateTab }: Props) {
  const [data, setData] = useState<InternDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const stats = await peopleApi.getInternDashboard();
      setData(stats);
    } catch (err: any) {
      setError(err?.message || 'Failed to load intern dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStats();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <RefreshCw className="animate-spin text-teal-600" size={18} />
          <span>Loading live Intern dashboard data...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
        <button onClick={() => void fetchStats()} className="underline font-semibold text-xs">
          Retry
        </button>
      </div>
    );
  }

  const stageData = [
    { stage: 'New', count: data?.newApplications || 0, fill: COLORS[0] },
    { stage: 'Under Review', count: data?.applicationsUnderReview || 0, fill: COLORS[1] },
    { stage: 'Shortlisted', count: data?.shortlisted || 0, fill: COLORS[2] },
    { stage: 'Selected', count: data?.selected || 0, fill: COLORS[3] },
  ];

  const deptData = data?.departmentDistribution?.length
    ? data.departmentDistribution
    : [{ name: 'Unassigned', count: data?.totalInterns || 0 }];

  return (
    <div className="people-dashboard flex flex-col gap-5">
      <section className="people-dashboard-hero people-dashboard-hero--intern relative overflow-hidden rounded-[22px] px-6 py-6 text-white md:px-8">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-100"><Sparkles size={15} /> Intern journey</div>
          <h2 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">Turn potential into meaningful impact.</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-emerald-50/90">See every application, placement, and learning milestone in one encouraging view.</p>
        </div>
        <div className="absolute -right-12 -top-20 h-56 w-56 rounded-full border border-white/15" />
        <div className="absolute -bottom-24 right-24 h-44 w-44 rounded-full border border-emerald-100/20" />
      </section>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">
          Real-time figures aggregated directly from PostgreSQL database.
        </span>
        <button
          onClick={() => void fetchStats()}
          className="btn-secondary !p-1.5 text-xs flex items-center gap-1"
          title="Refresh statistics"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="people-stats-grid people-stagger grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Total Interns"
          value={data?.totalInterns ?? 0}
          icon={<GraduationCap size={18} />}
          color={ACCENT.intern}
        />
        <StatCard
          label="Active Interns"
          value={data?.activeInterns ?? 0}
          icon={<UserCheck size={18} />}
          color="#1AACB8"
        />
        <StatCard
          label="New Applications"
          value={data?.newApplications ?? 0}
          icon={<Inbox size={18} />}
          color="#F59E0B"
        />
        <StatCard
          label="Under Review"
          value={data?.applicationsUnderReview ?? 0}
          icon={<Search size={18} />}
          color="#3B82F6"
        />
        <StatCard
          label="Completed Internships"
          value={`${data?.completedInternships ?? 0} / ${data?.totalInterns ?? 0}`}
          icon={<Award size={18} />}
          color={ACCENT.intern}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="people-dashboard-panel card min-w-0">
          <div className="card-header items-start">
            <div>
              <h2 className="card-title">Applications by Selection Stage</h2>
              <p className="mt-1 text-xs text-slate-500">Applicant volume progressing through internship review stages</p>
            </div>
            <span className="badge badge-teal">{data?.totalApplications ?? 0} Total Applications</span>
          </div>
          <div className="card-body" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 16 }} barCategoryGap={14}>
                <CartesianGrid strokeDasharray="3 5" stroke="#E8EEF4" horizontal={false} />
                <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis type="category" dataKey="stage" width={110} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#475569' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${value} applicants`, 'Volume']} cursor={{ fill: '#F2F7F5' }} />
                <Bar dataKey="count" name="Applicants" radius={[0, 8, 8, 0]} maxBarSize={26}>
                  {stageData.map((stage, i) => (
                    <Cell key={stage.stage} fill={stage.fill || COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="people-dashboard-panel card min-w-0">
          <div className="card-header items-start">
            <div>
              <h2 className="card-title">Interns by Department</h2>
              <p className="mt-1 text-xs text-slate-500">Active intern allocation across organizational departments</p>
            </div>
            <span className="badge badge-gray">{data?.totalInterns ?? 0} Interns</span>
          </div>
          <div className="card-body" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptData} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 24 }} barCategoryGap={14}>
                <CartesianGrid strokeDasharray="3 5" stroke="#E8EEF4" horizontal={false} />
                <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis type="category" dataKey="name" width={120} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#475569' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${value} interns`, 'Count']} cursor={{ fill: '#F2F7F5' }} />
                <Bar dataKey="count" name="Interns" fill={ACCENT.intern} radius={[0, 8, 8, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
