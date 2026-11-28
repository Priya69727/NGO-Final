
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  AreaChart,
  Area,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { AXIS, BAR_RADIUS, ChartGradients, GRID, gradientUrl } from "../lib/chartTheme"
import {
  FolderKanban,
  Users,
  Heart,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUpRight,
  Calendar,
  Target,
  Zap,
  RefreshCw,
  BriefcaseBusiness,
  HandCoins,
  Package,
  ClipboardList,
  Activity,
  ArrowRight,
  MapPin,
  Sparkles,
} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { apiRequest } from "../services/apiClient"

interface DashboardProject {
  name: string
  status: string
  lead: string
  budget: number
  progress: number
  deadline: string | null
}

interface DashboardEvent {
  title: string
  date: string
  location: string
  type: string
}

interface DashboardTask {
  task: string
  priority: string
  due: string
}

interface DashboardData {
  generatedAt: string
  metrics: {
    activeProjects: number
    totalProjects: number
    activeVolunteers: number
    beneficiariesServed: number
    fundsRaisedThisMonth: number
    totalDonors: number
    activeCampaigns: number
    pendingProposals: number
    tasksCompletedToday: number
    newBeneficiariesThisMonth: number
    pendingTasks: number
    activeAssignments: number
    averageProjectProgress: number
  }
  projectStatus: { name: string; value: number; color: string }[]
  donationTrend: { month: string; label: string; amount: number }[]
  peakDonationMonth: { label: string; amount: number }
  volunteerActivity: { dept: string; assignments: number }[]
  recentProjects: DashboardProject[]
  upcomingEvents: DashboardEvent[]
  pendingTasks: DashboardTask[]
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return "—"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color = "#0D9488",
  gradient = "from-teal-50 to-cyan-50",
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  color?: string
  gradient?: string
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-50 transition-opacity group-hover:opacity-80`}
      />

      <div className="relative flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl shadow-sm"
            style={{ backgroundColor: `${color}18`, color }}
          >
            {icon}
          </div>

          <div
            className="rounded-full p-1.5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
            style={{ backgroundColor: `${color}12`, color }}
          >
            <ArrowUpRight size={16} />
          </div>
        </div>

        <div>
          <div
            className="text-2xl font-extrabold tracking-tight text-slate-800"
            style={{ fontFamily: "Nunito, sans-serif" }}
          >
            {value}
          </div>

          <div className="mt-1 text-sm font-semibold text-slate-700">
            {label}
          </div>

          <div className="mt-1 text-xs text-slate-500">{sub}</div>
        </div>

        <div
          className="h-1 w-12 rounded-full transition-all duration-300 group-hover:w-20"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function ImpactCard({
  title,
  value,
  description,
  percentage,
  color,
  icon,
}: {
  title: string
  value: string
  description: string
  percentage: number
  color: string
  icon: React.ReactNode
}) {
  const progress = Math.max(0, Math.min(100, percentage))

  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm transition-all hover:bg-white/15">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-white/75">{title}</div>
          <div className="mt-2 text-2xl font-extrabold text-white">
            {value}
          </div>
          <div className="mt-1 text-xs text-white/65">{description}</div>
        </div>

        <div
          className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(${color} ${progress * 3.6}deg, rgba(255,255,255,0.15) 0deg)`,
          }}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white">
            {icon}
          </div>
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${progress}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-bold text-slate-800">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  )
}

const statusClass: Record<string, string> = {
  Active: "badge badge-teal",
  Planning: "badge badge-blue",
  Completed: "badge badge-green",
  "On Hold": "badge badge-yellow",
  Archived: "badge badge-gray",
  Scheduled: "badge badge-blue",
}

const priorityClass: Record<string, string> = {
  Critical: "badge badge-red",
  High: "badge badge-red",
  Medium: "badge badge-yellow",
  Low: "badge badge-gray",
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview")
  const [showQuickActions, setShowQuickActions] = useState(false)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const navigate = useNavigate()
  const { user } = useAuth()

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      setDashboard(await apiRequest<DashboardData>("/dashboard"))
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load dashboard data."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()

    const refreshTimer = window.setInterval(
      () => void loadDashboard(),
      60_000
    )

    return () => window.clearInterval(refreshTimer)
  }, [loadDashboard])

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })

  const quickAccess = [
    {
      title: "Project Management",
      description: "Manage projects and proposals",
      icon: <FolderKanban size={22} />,
      color: "#0D9488",
      background: "bg-teal-50",
      path: "/projects",
    },
    {
      title: "Resource Management",
      description: "View resources and allocations",
      icon: <Package size={22} />,
      color: "#6366F1",
      background: "bg-indigo-50",
      path: "/resources",
    },
    {
      title: "Donor Management",
      description: "Manage donors and contributions",
      icon: <HandCoins size={22} />,
      color: "#E879A0",
      background: "bg-pink-50",
      path: "/donor-management/admin/dashboard",
    },
    {
      title: "People Management",
      description: "Manage volunteers and employees",
      icon: <Users size={22} />,
      color: "#D97706",
      background: "bg-amber-50",
      path: "/people-management",
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
              Hope Foundation Dashboard
            </span>
            <Sparkles size={15} className="text-amber-500" />
          </div>

          <h1 className="page-title">
            Welcome back, {user?.fullName ?? "there"} 👋
          </h1>

          <p className="page-subtitle">
            Here's what's happening at Hope Foundation today — {todayLabel}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="btn-secondary text-sm"
            onClick={() => void loadDashboard()}
            disabled={loading}
            aria-label="Refresh dashboard data"
          >
            <RefreshCw
              size={15}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <button
            className="btn-secondary text-sm"
            onClick={() => navigate("/events/calendar")}
          >
            <Calendar size={15} />
            View Calendar
          </button>

          <button
            className="btn-primary text-sm"
            onClick={() => setShowQuickActions((open) => !open)}
            aria-expanded={showQuickActions}
          >
            <Zap size={15} />
            Quick Action
          </button>
        </div>
      </div>

      {/* Quick action panel */}
      {showQuickActions && (
        <div className="rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50 to-cyan-50 p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Zap size={17} className="text-teal-700" />
            <span className="text-sm font-bold text-slate-800">
              Quick Create
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              ...(user?.role === "Admin"
                ? [["Activate Project", "/projects/activate"]]
                : user?.role === "Project Manager"
                  ? [["Proposal", "/projects/proposals"]]
                  : []),
              ["Event", "/events"],
              ["Beneficiary", "/beneficiaries"],
              ["Donor", "/donor-management/admin/directory"],
            ].map(([label, path]) => (
              <button
                key={path}
                type="button"
                className="btn-secondary text-sm"
                onClick={() => navigate(path)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dashboard tabs */}
      <div
        className="tab-bar w-fit"
        role="tablist"
        aria-label="Dashboard sections"
      >
        {(["overview", "projects", "donors", "people"] as const).map(
          (tab) => (
            <button
              key={tab}
              id={`dashboard-tab-${tab}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls="dashboard-tab-panel"
              className={`tab-item capitalize ${
                activeTab === tab ? "active" : ""
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          )
        )}
      </div>

      <section
        id="dashboard-tab-panel"
        role="tabpanel"
        aria-labelledby={`dashboard-tab-${activeTab}`}
        className="flex flex-col gap-6"
      >
        {error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
              <button
                className="btn-secondary text-sm"
                onClick={() => void loadDashboard()}
              >
                Try again
              </button>
            </div>
          </div>
        ) : !dashboard || loading ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
            <RefreshCw
              size={24}
              className="mx-auto mb-3 animate-spin text-teal-600"
            />
            <p className="text-sm font-medium text-slate-600">
              Loading dashboard data…
            </p>
          </div>
        ) : activeTab === "overview" ? (
          <>
            {/* Main KPI cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={<FolderKanban size={21} />}
                label="Active Projects"
                value={String(dashboard.metrics.activeProjects)}
                sub="Currently active"
                color="#0D9488"
                gradient="from-teal-50 to-cyan-50"
              />

              <StatCard
                icon={<Users size={21} />}
                label="Total Volunteers"
                value={dashboard.metrics.activeVolunteers.toLocaleString("en-IN")}
                sub="Currently active"
                color="#6366F1"
                gradient="from-indigo-50 to-blue-50"
              />

              <StatCard
                icon={<Heart size={21} />}
                label="Beneficiaries Served"
                value={dashboard.metrics.beneficiariesServed.toLocaleString("en-IN")}
                sub="Active project enrollments"
                color="#E879A0"
                gradient="from-pink-50 to-rose-50"
              />

              <StatCard
                icon={<DollarSign size={21} />}
                label="Funds Raised This Month"
                value={formatCurrency(dashboard.metrics.fundsRaisedThisMonth)}
                sub="Received INR contributions"
                color="#D97706"
                gradient="from-amber-50 to-yellow-50"
              />
            </div>

            {/* Impact section */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-teal-900 to-cyan-900 p-6 shadow-lg">
              <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-teal-400/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />

              <div className="relative">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <Activity size={18} className="text-teal-300" />
                      <span className="text-xs font-semibold uppercase tracking-widest text-teal-200">
                        Organisation overview
                      </span>
                    </div>
                    <h2 className="text-xl font-extrabold text-white">
                      Our Impact at a Glance
                    </h2>
                    <p className="mt-1 text-xs text-white/60">
                      A quick snapshot of current project and team activity
                    </p>
                  </div>

                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/80">
                    Live dashboard data
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <ImpactCard
                    title="Average Project Progress"
                    value={`${dashboard.metrics.averageProjectProgress}%`}
                    description="Across all projects"
                    percentage={dashboard.metrics.averageProjectProgress}
                    color="#5EEAD4"
                    icon={<Target size={20} />}
                  />

                  <ImpactCard
                    title="Active Projects"
                    value={`${dashboard.metrics.activeProjects}/${dashboard.metrics.totalProjects}`}
                    description="Active out of total projects"
                    percentage={
                      dashboard.metrics.totalProjects > 0
                        ? (dashboard.metrics.activeProjects /
                            dashboard.metrics.totalProjects) *
                          100
                        : 0
                    }
                    color="#93C5FD"
                    icon={<FolderKanban size={20} />}
                  />

                  <ImpactCard
                    title="Volunteer Assignments"
                    value={dashboard.metrics.activeAssignments.toLocaleString("en-IN")}
                    description="Currently active assignments"
                    percentage={
                      dashboard.metrics.activeVolunteers > 0
                        ? (dashboard.metrics.activeAssignments /
                            dashboard.metrics.activeVolunteers) *
                          100
                        : 0
                    }
                    color="#F9A8D4"
                    icon={<Users size={20} />}
                  />

                  <ImpactCard
                    title="Task Completion"
                    value={dashboard.metrics.tasksCompletedToday.toLocaleString("en-IN")}
                    description="Tasks completed today"
                    percentage={
                      dashboard.metrics.tasksCompletedToday +
                        dashboard.metrics.pendingTasks >
                      0
                        ? (dashboard.metrics.tasksCompletedToday /
                            (dashboard.metrics.tasksCompletedToday +
                              dashboard.metrics.pendingTasks)) *
                          100
                        : 0
                    }
                    color="#FCD34D"
                    icon={<CheckCircle2 size={20} />}
                  />
                </div>
              </div>
            </div>

            {/* Quick access cards */}
            <div>
              <SectionHeader
                title="Quick Access"
                subtitle="Navigate directly to important modules"
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {quickAccess.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-teal-200 hover:shadow-md"
                  >
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${item.background}`}
                      style={{ color: item.color }}
                    >
                      {item.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-800">
                        {item.title}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.description}
                      </div>
                    </div>

                    <ArrowRight
                      size={17}
                      className="shrink-0 text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-teal-600"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="card overflow-hidden lg:col-span-2">
                <div className="card-header">
                  <div>
                    <span className="card-title">Donation Trend</span>
                    <p className="mt-1 text-xs text-slate-400">
                      Monthly fundraising performance
                    </p>
                  </div>
                  <span className="badge badge-teal text-xs">
                    Last 7 Months
                  </span>
                </div>

                <div className="card-body">
                  {dashboard.donationTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={230}>
                      <AreaChart data={dashboard.donationTrend}>
                        <defs>
                          <linearGradient
                            id="tealGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#0D9488"
                              stopOpacity={0.25}
                            />
                            <stop
                              offset="95%"
                              stopColor="#0D9488"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>

                        <CartesianGrid {...GRID} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11 }}
                          {...AXIS}
                        />

                        <YAxis
                          tick={{ fontSize: 11 }}
                          {...AXIS}
                          tickFormatter={(value) =>
                            `₹${(value / 1000).toFixed(0)}k`
                          }
                        />

                        <Tooltip
                          formatter={(value: any) => [
                            formatCurrency(Number(value)),
                            "Donations",
                          ]}
                        />

                        <Area
                          type="monotone"
                          dataKey="amount"
                          stroke="#0D9488"
                          strokeWidth={3}
                          fill="url(#tealGrad)"
                          dot={false}
                          activeDot={{ r: 7, strokeWidth: 3 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[230px] items-center justify-center text-sm text-slate-400">
                      No donation trend data available.
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div>
                    <span className="card-title">Project Status</span>
                    <p className="mt-1 text-xs text-slate-400">
                      Project distribution
                    </p>
                  </div>
                </div>

                <div className="card-body flex flex-col items-center gap-3">
                  {dashboard.projectStatus.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={175}>
                        <PieChart>
                          <Pie
                            data={dashboard.projectStatus}
                            cx="50%"
                            cy="50%"
                            innerRadius={52}
                            outerRadius={78}
                            paddingAngle={5}
                            cornerRadius={6}
                            dataKey="value"
                          >
                            {dashboard.projectStatus.map((entry, index) => (
                              <Cell
                                key={`${entry.name}-${index}`}
                                fill={entry.color}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>

                      <div className="grid w-full grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        {dashboard.projectStatus.map((status) => (
                          <div
                            key={status.name}
                            className="flex items-center gap-2"
                          >
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ background: status.color }}
                            />
                            <span className="text-slate-500">
                              {status.name}
                            </span>
                            <span className="ml-auto font-bold text-slate-700">
                              {status.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">
                      No project status data available.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Volunteer activity and pending tasks */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="card lg:col-span-2">
                <div className="card-header">
                  <div>
                    <span className="card-title">
                      Volunteer Assignments by Project
                    </span>
                    <p className="mt-1 text-xs text-slate-400">
                      Active volunteer allocation
                    </p>
                  </div>
                  <span className="badge badge-teal text-xs">Active</span>
                </div>

                <div className="card-body">
                  {dashboard.volunteerActivity.length > 0 ? (
                    <ResponsiveContainer width="100%" height={210}>
                      <BarChart
                        data={dashboard.volunteerActivity}
                        barSize={30}
                      >
                        <ChartGradients keys={["teal"]} />
                        <CartesianGrid {...GRID} />
                        <XAxis
                          dataKey="dept"
                          tick={{ fontSize: 11 }}
                          {...AXIS}
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          {...AXIS}
                        />
                        <Tooltip />
                        <Bar
                          dataKey="assignments"
                          fill={gradientUrl("teal")}
                          radius={BAR_RADIUS}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[210px] items-center justify-center text-sm text-slate-400">
                      No volunteer activity data available.
                    </div>
                  )}
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="card-header">
                  <div>
                    <span className="card-title">Pending Actions</span>
                    <p className="mt-1 text-xs text-slate-400">
                      Tasks requiring attention
                    </p>
                  </div>
                  <span className="badge badge-red text-xs">
                    {dashboard.metrics.pendingTasks} tasks
                  </span>
                </div>

                <div className="flex flex-col divide-y divide-slate-100">
                  {dashboard.pendingTasks.length > 0 ? (
                    dashboard.pendingTasks.map((task, index) => (
                      <div
                        key={`${task.task}-${index}`}
                        className="flex flex-col gap-2 px-5 py-3 transition-colors hover:bg-slate-50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium leading-snug text-slate-700">
                            {task.task}
                          </span>
                          <span
                            className={
                              priorityClass[task.priority] ??
                              "badge badge-gray"
                            }
                          >
                            {task.priority}
                          </span>
                        </div>

                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock size={12} />
                          Due: {task.due}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-sm text-slate-400">
                      No pending tasks.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recent projects and upcoming events */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="card overflow-hidden lg:col-span-2">
                <div className="card-header">
                  <div>
                    <span className="card-title">Recent Projects</span>
                    <p className="mt-1 text-xs text-slate-400">
                      Latest project updates
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate("/projects")}
                    className="text-xs font-semibold text-teal-600 hover:text-teal-700"
                  >
                    View All →
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Lead</th>
                        <th>Status</th>
                        <th>Progress</th>
                        <th>Deadline</th>
                      </tr>
                    </thead>

                    <tbody>
                      {dashboard.recentProjects.length > 0 ? (
                        dashboard.recentProjects.map((project, index) => (
                          <tr key={`${project.name}-${index}`}>
                            <td className="font-semibold text-slate-800">
                              {project.name}
                            </td>
                            <td>{project.lead}</td>
                            <td>
                              <span
                                className={
                                  statusClass[project.status] ??
                                  "badge badge-gray"
                                }
                              >
                                {project.status}
                              </span>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.max(0, Math.min(100, project.progress))}%`,
                                      background:
                                        project.progress >= 100
                                          ? "#10B981"
                                          : "#0D9488",
                                    }}
                                  />
                                </div>
                                <span className="text-xs font-semibold text-slate-500">
                                  {project.progress}%
                                </span>
                              </div>
                            </td>
                            <td className="text-xs text-slate-500">
                              {formatDate(project.deadline)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-8 text-center text-sm text-slate-400"
                          >
                            No recent projects available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="card-header">
                  <div>
                    <span className="card-title">Upcoming Events</span>
                    <p className="mt-1 text-xs text-slate-400">
                      Events and activities
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate("/events")}
                    className="text-xs font-semibold text-teal-600 hover:text-teal-700"
                  >
                    View All →
                  </button>
                </div>

                <div className="flex flex-col divide-y divide-slate-100">
                  {dashboard.upcomingEvents.length > 0 ? (
                    dashboard.upcomingEvents.map((event, index) => (
                      <div
                        key={`${event.title}-${index}`}
                        className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-slate-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-800">
                            {event.title}
                          </span>
                          <span
                            className={
                              statusClass[event.type] ??
                              "badge badge-gray"
                            }
                          >
                            {event.type}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1 text-xs text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <Calendar size={12} />
                            {formatDate(event.date)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <MapPin size={12} />
                            {event.location}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-sm text-slate-400">
                      No upcoming events.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Additional statistics */}
            <div>
              <SectionHeader
                title="More Organisation Insights"
                subtitle="Additional operational indicators"
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  icon={<Clock size={20} />}
                  label="Proposals Under Review"
                  value={dashboard.metrics.pendingProposals.toLocaleString("en-IN")}
                  sub="Awaiting review"
                  color="#6366F1"
                  gradient="from-indigo-50 to-violet-50"
                />

                <StatCard
                  icon={<CheckCircle2 size={20} />}
                  label="Tasks Completed Today"
                  value={dashboard.metrics.tasksCompletedToday.toLocaleString("en-IN")}
                  sub="Completed today"
                  color="#10B981"
                  gradient="from-emerald-50 to-green-50"
                />

                <StatCard
                  icon={<Heart size={20} />}
                  label="New Beneficiaries"
                  value={dashboard.metrics.newBeneficiariesThisMonth.toLocaleString("en-IN")}
                  sub="Added this month"
                  color="#E879A0"
                  gradient="from-pink-50 to-rose-50"
                />

                <StatCard
                  icon={<Target size={20} />}
                  label="Active Campaigns"
                  value={dashboard.metrics.activeCampaigns.toLocaleString("en-IN")}
                  sub="Fundraising efforts"
                  color="#D97706"
                  gradient="from-amber-50 to-yellow-50"
                />
              </div>
            </div>
          </>
        ) : activeTab === "projects" ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={<FolderKanban size={21} />}
                label="Tracked Projects"
                value={dashboard.metrics.totalProjects.toLocaleString("en-IN")}
                sub="Across all stages"
              />

              <StatCard
                icon={<CheckCircle2 size={21} />}
                label="Active Projects"
                value={dashboard.metrics.activeProjects.toLocaleString("en-IN")}
                sub="Currently in progress"
                color="#10B981"
                gradient="from-emerald-50 to-green-50"
              />

              <StatCard
                icon={<Clock size={21} />}
                label="Planning"
                value={String(
                  dashboard.projectStatus.find(
                    (status) => status.name === "Planning"
                  )?.value ?? 0
                )}
                sub="Preparing to launch"
                color="#6366F1"
                gradient="from-indigo-50 to-blue-50"
              />

              <StatCard
                icon={<Target size={21} />}
                label="Average Progress"
                value={`${dashboard.metrics.averageProjectProgress}%`}
                sub="Across all projects"
                color="#D97706"
                gradient="from-amber-50 to-yellow-50"
              />
            </div>

            <div className="card overflow-hidden">
              <div className="card-header">
                <div>
                  <span className="card-title">Project Portfolio</span>
                  <p className="mt-1 text-xs text-slate-400">
                    Overview of recently updated projects
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/projects")}
                  className="text-xs font-semibold text-teal-600"
                >
                  Open projects →
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Lead</th>
                      <th>Status</th>
                      <th>Progress</th>
                      <th>Budget</th>
                      <th>Deadline</th>
                    </tr>
                  </thead>

                  <tbody>
                    {dashboard.recentProjects.length > 0 ? (
                      dashboard.recentProjects.map((project, index) => (
                        <tr key={`${project.name}-${index}`}>
                          <td className="font-semibold text-slate-800">
                            {project.name}
                          </td>
                          <td>{project.lead}</td>
                          <td>
                            <span
                              className={
                                statusClass[project.status] ??
                                "badge badge-gray"
                              }
                            >
                              {project.status}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-teal-500"
                                  style={{
                                    width: `${Math.max(0, Math.min(100, project.progress))}%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs text-slate-500">
                                {project.progress}%
                              </span>
                            </div>
                          </td>
                          <td>{formatCurrency(project.budget)}</td>
                          <td className="text-xs text-slate-500">
                            {formatDate(project.deadline)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-8 text-center text-sm text-slate-400"
                        >
                          No projects available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Project Status Distribution</span>
                </div>
                <div className="card-body">
                  {dashboard.projectStatus.length > 0 ? (
                    <ResponsiveContainer width="100%" height={230}>
                      <PieChart>
                        <Pie
                          data={dashboard.projectStatus}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={85}
                          innerRadius={45}
                          paddingAngle={3}
                        >
                          {dashboard.projectStatus.map((status, index) => (
                            <Cell
                              key={`${status.name}-${index}`}
                              fill={status.color}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="py-12 text-center text-sm text-slate-400">
                      No project status data.
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Project Progress</span>
                </div>
                <div className="card-body flex flex-col gap-5">
                  {dashboard.recentProjects.length > 0 ? (
                    dashboard.recentProjects.map((project, index) => (
                      <div key={`${project.name}-${index}`}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-medium text-slate-700">
                            {project.name}
                          </span>
                          <span className="text-xs font-bold text-slate-500">
                            {project.progress}%
                          </span>
                        </div>

                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400"
                            style={{
                              width: `${Math.max(0, Math.min(100, project.progress))}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">
                      No project progress data available.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : activeTab === "donors" ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={<Heart size={21} />}
                label="Donations This Period"
                value={formatCurrency(
                  dashboard.donationTrend.reduce(
                    (total, month) => total + month.amount,
                    0
                  )
                )}
                sub="Last 7 months"
                color="#E879A0"
                gradient="from-pink-50 to-rose-50"
              />

              <StatCard
                icon={<TrendingUp size={21} />}
                label="Peak Donation Month"
                value={formatCurrency(dashboard.peakDonationMonth.amount)}
                sub={dashboard.peakDonationMonth.label}
                color="#10B981"
                gradient="from-emerald-50 to-green-50"
              />

              <StatCard
                icon={<Users size={21} />}
                label="Total Donors"
                value={dashboard.metrics.totalDonors.toLocaleString("en-IN")}
                sub="Unique donors"
                color="#6366F1"
                gradient="from-indigo-50 to-blue-50"
              />

              <StatCard
                icon={<Target size={21} />}
                label="Active Campaigns"
                value={dashboard.metrics.activeCampaigns.toLocaleString("en-IN")}
                sub="Fundraising efforts"
                color="#D97706"
                gradient="from-amber-50 to-yellow-50"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="card overflow-hidden lg:col-span-2">
                <div className="card-header">
                  <div>
                    <span className="card-title">Monthly Donations</span>
                    <p className="mt-1 text-xs text-slate-400">
                      Donation collection over time
                    </p>
                  </div>
                  <span className="badge badge-teal text-xs">
                    Last 7 Months
                  </span>
                </div>

                <div className="card-body">
                  {dashboard.donationTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={dashboard.donationTrend}>
                        <defs>
                          <linearGradient
                            id="donorTealGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#0D9488"
                              stopOpacity={0.25}
                            />
                            <stop
                              offset="95%"
                              stopColor="#0D9488"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>

                        <CartesianGrid {...GRID} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11 }}
                          {...AXIS}
                        />

                        <YAxis
                          tick={{ fontSize: 11 }}
                          {...AXIS}
                          tickFormatter={(value) =>
                            `₹${(value / 1000).toFixed(0)}k`
                          }
                        />

                        <Tooltip
                          formatter={(value: any) => [
                            formatCurrency(Number(value)),
                            "Donations",
                          ]}
                          contentStyle={{
                            borderRadius: 10,
                            border: "1px solid #E2E8F0",
                            fontSize: 12,
                          }}
                        />

                        <Area
                          type="monotone"
                          dataKey="amount"
                          stroke="#0D9488"
                          strokeWidth={3}
                          fill="url(#donorTealGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
                      No donation trend data available.
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Donation Breakdown</span>
                </div>

                <div className="card-body flex flex-col gap-4">
                  {dashboard.donationTrend.length > 0 ? (
                    dashboard.donationTrend.map((month) => {
                      const maxAmount = Math.max(
                        ...dashboard.donationTrend.map((item) => item.amount),
                        0
                      )

                      const width =
                        maxAmount > 0
                          ? (month.amount / maxAmount) * 100
                          : 0

                      return (
                        <div key={month.month}>
                          <div className="mb-1 flex justify-between gap-2 text-xs">
                            <span className="font-medium text-slate-600">
                              {month.month}
                            </span>
                            <span className="text-slate-500">
                              {formatCurrency(month.amount)}
                            </span>
                          </div>

                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-sm text-slate-400">
                      No donation records available.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/donor-management/admin/dashboard")
                    }
                    className="btn-secondary mt-2 justify-center text-sm"
                  >
                    Open donor dashboard
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <span className="card-title">Donor Management</span>
                  <p className="mt-1 text-xs text-slate-400">
                    Manage donor records and fundraising activities
                  </p>
                </div>
              </div>

              <div className="card-body grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    navigate("/donor-management/admin/directory")
                  }
                  className="btn-secondary justify-center"
                >
                  <Users size={16} />
                  Donor Directory
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/donor-management/admin/dashboard")
                  }
                  className="btn-secondary justify-center"
                >
                  <TrendingUp size={16} />
                  Fundraising Dashboard
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={<Users size={21} />}
                label="Total Volunteers"
                value={dashboard.metrics.activeVolunteers.toLocaleString("en-IN")}
                sub="Currently active"
              />

              <StatCard
                icon={<Clock size={21} />}
                label="Active Assignments"
                value={dashboard.metrics.activeAssignments.toLocaleString("en-IN")}
                sub="Across projects"
                color="#6366F1"
                gradient="from-indigo-50 to-blue-50"
              />

              <StatCard
                icon={<Heart size={21} />}
                label="Beneficiaries Served"
                value={dashboard.metrics.beneficiariesServed.toLocaleString("en-IN")}
                sub="Active project enrollments"
                color="#10B981"
                gradient="from-emerald-50 to-green-50"
              />

              <StatCard
                icon={<AlertCircle size={21} />}
                label="Pending Actions"
                value={dashboard.metrics.pendingTasks.toLocaleString("en-IN")}
                sub="Requires follow-up"
                color="#D97706"
                gradient="from-amber-50 to-yellow-50"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="card lg:col-span-2">
                <div className="card-header">
                  <div>
                    <span className="card-title">
                      Volunteer Assignments by Project
                    </span>
                    <p className="mt-1 text-xs text-slate-400">
                      Current volunteer allocation
                    </p>
                  </div>
                  <span className="badge badge-teal text-xs">Active</span>
                </div>

                <div className="card-body">
                  {dashboard.volunteerActivity.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={dashboard.volunteerActivity}
                        barSize={32}
                      >
                        <XAxis
                          dataKey="dept"
                          tick={{ fontSize: 11, fill: "#94A3B8" }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <YAxis
                          tick={{ fontSize: 11, fill: "#94A3B8" }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <Tooltip
                          contentStyle={{
                            borderRadius: 10,
                            fontSize: 12,
                          }}
                        />

                        <Bar
                          dataKey="assignments"
                          fill="#0D9488"
                          radius={[7, 7, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
                      No volunteer activity data available.
                    </div>
                  )}
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="card-header">
                  <div>
                    <span className="card-title">Pending Actions</span>
                    <p className="mt-1 text-xs text-slate-400">
                      Tasks requiring attention
                    </p>
                  </div>

                  <span className="badge badge-red text-xs">
                    {dashboard.metrics.pendingTasks} tasks
                  </span>
                </div>

                <div className="flex flex-col divide-y divide-slate-100">
                  {dashboard.pendingTasks.length > 0 ? (
                    dashboard.pendingTasks.map((task, index) => (
                      <div
                        key={`${task.task}-${index}`}
                        className="flex flex-col gap-2 px-5 py-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm text-slate-700">
                            {task.task}
                          </span>

                          <span
                            className={
                              priorityClass[task.priority] ??
                              "badge badge-gray"
                            }
                          >
                            {task.priority}
                          </span>
                        </div>

                        <span className="text-[11px] text-slate-400">
                          Due: {task.due}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-sm text-slate-400">
                      No pending tasks.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <span className="card-title">People Management</span>
                  <p className="mt-1 text-xs text-slate-400">
                    Access employee, intern and volunteer sections
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/people-management")}
                  className="text-xs font-semibold text-teal-600"
                >
                  Open people module →
                </button>
              </div>

              <div className="card-body grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "HR Management",
                    path: "/people-management/hr",
                    icon: <BriefcaseBusiness size={18} />,
                  },
                  {
                    label: "Interns",
                    path: "/people-management/interns",
                    icon: <ClipboardList size={18} />,
                  },
                  {
                    label: "Volunteers",
                    path: "/people-management/volunteers",
                    icon: <Users size={18} />,
                  },
                ].map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className="btn-secondary justify-center"
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
