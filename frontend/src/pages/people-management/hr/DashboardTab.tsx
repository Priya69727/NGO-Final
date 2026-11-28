import { useEffect, useState } from 'react';
import { Users, UserCheck, UserX, Building2, ClipboardList, Clock, CalendarCheck, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BAR_RADIUS, ChartGradients, gradientUrl } from '../../../lib/chartTheme';
import { StatCard, ACCENT } from '../../../components/people';
import { peopleApi, type HrDashboardData } from '../../../services/peopleApi';

interface Props {
  onNavigateTab?: (tab: string) => void;
}

export default function DashboardTab({ onNavigateTab }: Props) {
  const [data, setData] = useState<HrDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const stats = await peopleApi.getHrDashboard();
      setData(stats);
    } catch (err: any) {
      setError(err?.message || 'Failed to load HR dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboard();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <RefreshCw className="animate-spin text-teal-600" size={18} />
          <span>Loading live HR dashboard data...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="card card-body flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="text-red-500 mb-2" size={32} />
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Unable to load dashboard</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-md">{error}</p>
        <button className="btn-primary mt-4" onClick={fetchDashboard}>
          <RefreshCw size={14} /> Try Again
        </button>
      </div>
    );
  }

  const chartData = data?.departmentDistribution.map(d => ({
    name: d.name.length > 12 ? d.name.split(' ')[0] : d.name,
    full: d.name,
    count: d.count,
  })) || [];

  return (
    <div className="people-dashboard flex flex-col gap-5">
      <section className="people-dashboard-hero people-dashboard-hero--hr relative overflow-hidden rounded-[22px] px-6 py-6 text-white md:px-8">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-teal-200"><Sparkles size={15} /> People intelligence</div>
          <h2 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">Keep the team moving with clarity.</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-200">A live pulse of staffing, hiring, attendance, and the people moments that need your attention.</p>
        </div>
        <div className="absolute -right-12 -top-20 h-56 w-56 rounded-full border border-white/15" />
        <div className="absolute -bottom-24 right-24 h-44 w-44 rounded-full border border-teal-200/20" />
      </section>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 font-medium">
          Figures aggregated live from database
        </span>
        <button
          className="btn-secondary text-xs flex items-center gap-1.5 py-1 px-2.5"
          onClick={fetchDashboard}
          disabled={loading}
          title="Refresh dashboard metrics"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="people-stats-grid people-stagger grid grid-cols-2 gap-3.5 md:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Total Employees"
          value={data?.totalEmployees ?? 0}
          icon={<Users size={18} />}
          color="#2A8C82"
        />
        <StatCard
          label="Active Staff"
          value={data?.activeEmployees ?? 0}
          icon={<UserCheck size={18} />}
          color="#21865B"
        />
        <StatCard
          label="On Leave / Inactive"
          value={data?.inactiveEmployees ?? 0}
          icon={<UserX size={18} />}
          color="#718096"
        />
        <StatCard
          label="Open Requirements"
          value={data?.openRequirements ?? 0}
          icon={<ClipboardList size={18} />}
          color="#D69A32"
        />
        <StatCard
          label="Pending Leaves"
          value={data?.pendingLeaves ?? 0}
          icon={<Clock size={18} />}
          color="#C94C4C"
        />
        <StatCard
          label="Job Applicants"
          value={data?.totalApplicants ?? 0}
          icon={<Users size={18} />}
          color="#4779B8"
        />
      </div>

      {/* Attendance Today Card */}
      <div className="people-dashboard-panel card p-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <CalendarCheck size={17} className="text-teal-600" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Nunito, sans-serif' }}>
              Today's Attendance Overview
            </h3>
          </div>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('attendance')}
              className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline"
            >
              Manage Attendance &rarr;
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
            <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400">
              {data?.attendanceSummary.present ?? 0}
            </div>
            <div className="text-xs font-semibold text-emerald-800/80 dark:text-emerald-300 mt-0.5">Present</div>
          </div>
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
            <div className="text-xl font-extrabold text-amber-700 dark:text-amber-400">
              {data?.attendanceSummary.late ?? 0}
            </div>
            <div className="text-xs font-semibold text-amber-800/80 dark:text-amber-300 mt-0.5">Late / Half Day</div>
          </div>
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40">
            <div className="text-xl font-extrabold text-rose-700 dark:text-rose-400">
              {data?.attendanceSummary.absent ?? 0}
            </div>
            <div className="text-xs font-semibold text-rose-800/80 dark:text-rose-300 mt-0.5">Absent</div>
          </div>
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
            <div className="text-xl font-extrabold text-blue-700 dark:text-blue-400">
              {data?.attendanceSummary.leave ?? 0}
            </div>
            <div className="text-xs font-semibold text-blue-800/80 dark:text-blue-300 mt-0.5">On Leave</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="people-dashboard-panel card lg:col-span-2">
          <div className="card-header">
            <h2 className="card-title">Department-wise Employee Distribution</h2>
          </div>
          <div className="card-body" style={{ height: 280 }}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <ChartGradients keys={['teal']} />
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#718096' }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#718096' }} />
                  <Tooltip labelFormatter={(_, p) => p?.[0]?.payload.full ?? ''} />
                  <Bar dataKey="count" name="Staff Members" fill={gradientUrl('teal')} radius={BAR_RADIUS} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No department distribution data available.
              </div>
            )}
          </div>
        </div>

        <div className="people-dashboard-panel card">
          <div className="card-header">
            <h2 className="card-title">Department Summary</h2>
          </div>
          <div className="card-body max-h-[280px] overflow-y-auto">
            <ul className="flex flex-col gap-2.5">
              {data?.departmentDistribution.map(dept => (
                <li key={dept.departmentId} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-b-0 text-sm">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <Building2 size={14} className="text-slate-400" />
                    <span className="font-medium text-xs">{dept.name}</span>
                  </div>
                  <span className="badge badge-teal font-bold">{dept.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
