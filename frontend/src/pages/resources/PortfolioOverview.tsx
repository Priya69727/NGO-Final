
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Download,
  Share2,
  RefreshCw,
  AlertTriangle,
  Wallet,
  Package,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart as PieIcon,
  Search,
  Users,
} from 'lucide-react';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';

import { apiList } from '../../services/apiClient';
import { listEvents, type EventRecord } from '../../services/eventApi';

interface Project {
  id: string;
  name: string;
  projectCode: string;
  status: string;
}

interface BudgetItem {
  id: string;
  projectId: string;
  section: string;
  itemName: string;
  quantity: number;
  unitCost: number;
  frequencyPerYear: number | null;
}

interface Expense {
  id: string;
  projectId: string;
  amount: number;
  section: string;
  head?: string;
  description?: string;
  paidTo?: string;
  expenseDate?: string;
}

interface Resource {
  id: string;
  projectId: string;
  name: string;
  resourceType: string;
  quantity: number;
  unit: string;
  status: string;
  location?: string;
}

interface Funding {
  id: string;
  projectId: string;
  sourceName: string;
  amount: number;
  status: string;
}

interface PortfolioRow {
  project: Project;
  planned: number;
  spent: number;
  remaining: number;
  fundingReceived: number;
  fundingCommitted: number;
  resources: Resource[];
  budgets: BudgetItem[];
  expenses: Expense[];
  fundingSources: Funding[];
  resourceCount: number;
  lowStock: number;
  events: EventRecord[];
  eventBudget: number;
}

const chartColors = [
  '#0D9488',
  '#6366F1',
  '#F59E0B',
  '#E879F9',
  '#3B82F6',
  '#F97316',
];

const n = (value: unknown) => {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
};

const inr = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

const compactInr = (value: number) => {
  if (Math.abs(value) >= 10000000) {
    return `₹${(value / 10000000).toFixed(1)}Cr`;
  }

  if (Math.abs(value) >= 100000) {
    return `₹${(value / 100000).toFixed(1)}L`;
  }

  if (Math.abs(value) >= 1000) {
    return `₹${(value / 1000).toFixed(1)}K`;
  }

  return `₹${Math.round(value)}`;
};

async function fetchAll<T>(resource: string): Promise<T[]> {
  const records: T[] = [];
  let offset = 0;

  while (true) {
    const page = await apiList<T>(resource, {
      limit: 200,
      offset,
    });

    records.push(...(page.items ?? []));
    offset += page.items?.length ?? 0;

    if (
      records.length >= page.total ||
      !page.items?.length
    ) {
      break;
    }
  }

  return records;
}

async function fetchAllEvents(): Promise<EventRecord[]> {
  const events: EventRecord[] = [];

  for (let offset = 0; ; offset += 200) {
    const page = await listEvents({
      limit: 200,
      offset,
    });

    events.push(...(page.items ?? []));

    if (
      events.length >= page.total ||
      !page.items?.length
    ) {
      break;
    }
  }

  return events;
}

function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, records: unknown[][]) {
  const csv = records
    .map(record => record.map(csvCell).join(','))
    .join('\r\n');

  const blob = new Blob(
    ['\uFEFF' + csv],
    { type: 'text/csv;charset=utf-8;' }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function safeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function PortfolioOverview() {
  const [rows, setRows] = useState<PortfolioRow[]>([]);
  const [allEvents, setAllEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sharingProject, setSharingProject] = useState<string | null>(null);

  async function loadPortfolio() {
    setLoading(true);
    setError('');

    try {
      const [
        projects,
        budgets,
        expenses,
        resources,
        funding,
        events,
      ] = await Promise.all([
        fetchAll<Project>('projects'),
        fetchAll<BudgetItem>('budget-items'),
        fetchAll<Expense>('expenses'),
        fetchAll<Resource>('resources'),
        fetchAll<Funding>('funding-sources'),
        fetchAllEvents(),
      ]);

      const projectRows: PortfolioRow[] = projects.map(project => {
        const projectBudgets = budgets.filter(
          item => item.projectId === project.id
        );

        const projectExpenses = expenses.filter(
          item => item.projectId === project.id
        );

        const projectResources = resources.filter(
          item => item.projectId === project.id
        );

        const projectFunding = funding.filter(
          item => item.projectId === project.id
        );

        const projectEvents = events.filter(
          event => event.projectId === project.id
        );

        const planned = projectBudgets.reduce((sum, item) => {
          const frequency =
            item.frequencyPerYear == null
              ? 1
              : n(item.frequencyPerYear);

          return (
            sum +
            n(item.quantity) *
              n(item.unitCost) *
              frequency
          );
        }, 0);

        const spent = projectExpenses.reduce(
          (sum, item) => sum + n(item.amount),
          0
        );

        return {
          project,
          planned,
          spent,
          remaining: planned - spent,

          fundingReceived: projectFunding
            .filter(item => item.status === 'Received')
            .reduce(
              (sum, item) => sum + n(item.amount),
              0
            ),

          fundingCommitted: projectFunding
            .filter(item => item.status === 'Committed')
            .reduce(
              (sum, item) => sum + n(item.amount),
              0
            ),

          resources: projectResources,
          budgets: projectBudgets,
          expenses: projectExpenses,
          fundingSources: projectFunding,

          resourceCount: projectResources.length,

          lowStock: projectResources.filter(item =>
            item.status === 'Maintenance' ||
            item.status === 'Retired' ||
            n(item.quantity) <= 0
          ).length,

          events: projectEvents,

          eventBudget: projectEvents
            .filter(event => event.status !== 'Cancelled')
            .reduce(
              (sum, event) => sum + n(event.budget),
              0
            ),
        };
      });

      setRows(projectRows);
      setAllEvents(events);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load portfolio data.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPortfolio();
  }, []);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return rows;

    return rows.filter(row =>
      `${row.project.name} ${row.project.projectCode} ${row.project.status}`
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  const totals = useMemo(() => ({
    planned: rows.reduce(
      (sum, row) => sum + row.planned,
      0
    ),

    spent: rows.reduce(
      (sum, row) => sum + row.spent,
      0
    ),

    remaining: rows.reduce(
      (sum, row) => sum + row.remaining,
      0
    ),

    received: rows.reduce(
      (sum, row) => sum + row.fundingReceived,
      0
    ),

    committed: rows.reduce(
      (sum, row) => sum + row.fundingCommitted,
      0
    ),

    resources: rows.reduce(
      (sum, row) => sum + row.resourceCount,
      0
    ),

    alerts: rows.reduce(
      (sum, row) => sum + row.lowStock,
      0
    ),

    eventBudget: allEvents
      .filter(event => event.status !== 'Cancelled')
      .reduce(
        (sum, event) => sum + n(event.budget),
        0
      ),
  }), [rows, allEvents]);

  const totalUtilization = totals.planned > 0
    ? Math.round(
        (totals.spent / totals.planned) * 100
      )
    : 0;

  // Project-wise comparison chart.
  const projectChartData = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.planned - a.planned)
        .slice(0, 10)
        .map(row => ({
          name:
            row.project.name.length > 18
              ? `${row.project.name.slice(0, 18)}…`
              : row.project.name,
          planned: row.planned,
          spent: row.spent,
        })),
    [rows]
  );

  // Funding status breakdown.
  const fundingChartData = useMemo(() => {
    const statusMap = new Map<string, number>();

    rows.forEach(row => {
      row.fundingSources.forEach(item => {
        const status = item.status || 'Unknown';

        statusMap.set(
          status,
          (statusMap.get(status) ?? 0) + n(item.amount)
        );
      });
    });

    return Array.from(statusMap.entries())
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0);
  }, [rows]);

  // Resource inventory status breakdown.
  const resourceChartData = useMemo(() => {
    const statusMap = new Map<string, number>();

    rows.forEach(row => {
      row.resources.forEach(item => {
        const status = item.status || 'Unknown';

        statusMap.set(
          status,
          (statusMap.get(status) ?? 0) + 1
        );
      });
    });

    return Array.from(statusMap.entries())
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0);
  }, [rows]);

  // Budget and expenditure totals by section.
  const sectionChartData = useMemo(() => {
    const sections = ['Salaries', 'Operations', 'Assets'];

    return sections.map(section => {
      const planned = rows.reduce(
        (sum, row) =>
          sum +
          row.budgets
            .filter(item => item.section === section)
            .reduce(
              (sub, item) =>
                sub +
                n(item.quantity) *
                  n(item.unitCost) *
                  (item.frequencyPerYear == null
                    ? 1
                    : n(item.frequencyPerYear)),
              0
            ),
        0
      );

      const spent = rows.reduce(
        (sum, row) =>
          sum +
          row.expenses
            .filter(item => item.section === section)
            .reduce(
              (sub, item) => sub + n(item.amount),
              0
            ),
        0
      );

      return { section, planned, spent };
    }).filter(item => item.planned > 0 || item.spent > 0);
  }, [rows]);

  function exportCsv() {
    const header = [
      'Project Code',
      'Project Name',
      'Project Status',
      'Planned Annual Budget (INR)',
      'Recorded Expenses (INR)',
      'Remaining Budget (INR)',
      'Utilisation (%)',
      'Funding Received (INR)',
      'Funding Committed (INR)',
      'Resource Records',
      'Resource Alerts',
      'Linked Events',
      'Linked Event Budgets (INR)',
    ];

    const data = visibleRows.map(row => [
      row.project.projectCode,
      row.project.name,
      row.project.status,
      row.planned,
      row.spent,
      row.remaining,
      row.planned > 0
        ? Math.round(row.spent / row.planned * 100)
        : 0,
      row.fundingReceived,
      row.fundingCommitted,
      row.resourceCount,
      row.lowStock,
      row.events.length,
      row.eventBudget,
    ]);

    downloadCsv(
      'hope-foundation-portfolio-summary.csv',
      [header, ...data]
    );
  }

  function exportProject(row: PortfolioRow) {
    const records: unknown[][] = [
      ['HOPE FOUNDATION - PROJECT RESOURCE & BUDGET REPORT'],
      ['Project Name', row.project.name],
      ['Project Code', row.project.projectCode],
      ['Project Status', row.project.status],
      [],
      ['FINANCIAL SUMMARY'],
      ['Planned Budget (INR)', row.planned],
      ['Recorded Expenses (INR)', row.spent],
      ['Remaining Budget (INR)', row.remaining],
      [
        'Budget Utilisation (%)',
        row.planned > 0
          ? Math.round(row.spent / row.planned * 100)
          : 0,
      ],
      ['Funding Received (INR)', row.fundingReceived],
      ['Funding Committed (INR)', row.fundingCommitted],
      [],
      [
        'BUDGET ITEMS',
        'Section',
        'Item Name',
        'Quantity',
        'Unit Cost',
        'Frequency Per Year',
        'Calculated Total (INR)',
      ],
      ...row.budgets.map(item => [
        'Budget',
        item.section,
        item.itemName,
        n(item.quantity),
        n(item.unitCost),
        item.frequencyPerYear ?? 1,
        n(item.quantity) *
          n(item.unitCost) *
          (item.frequencyPerYear == null
            ? 1
            : n(item.frequencyPerYear)),
      ]),
      [],
      [
        'EXPENSES',
        'Date',
        'Expense Head',
        'Section',
        'Description',
        'Paid To',
        'Amount (INR)',
      ],
      ...row.expenses.map(item => [
        'Expense',
        item.expenseDate ?? '',
        item.head ?? '',
        item.section,
        item.description ?? '',
        item.paidTo ?? '',
        n(item.amount),
      ]),
      [],
      [
        'RESOURCES',
        'Resource Name',
        'Resource Type',
        'Quantity',
        'Unit',
        'Location',
        'Status',
      ],
      ...row.resources.map(item => [
        'Resource',
        item.name,
        item.resourceType,
        n(item.quantity),
        item.unit,
        item.location ?? '',
        item.status,
      ]),
      [],
      [
        'FUNDING SOURCES',
        'Source Name',
        'Amount (INR)',
        'Status',
      ],
      ...row.fundingSources.map(item => [
        'Funding',
        item.sourceName,
        n(item.amount),
        item.status,
      ]),
      [],
      [
        'EVENTS',
        'Event Title',
        'Date',
        'Event Type',
        'Status',
        'Budget (INR)',
      ],
      ...row.events.map(event => [
        'Event',
        event.title,
        event.startsAt,
        event.eventType,
        event.status,
        n(event.budget),
      ]),
      [],
      [
        'Note',
        'Figures are calculated from records currently saved in the system.',
      ],
    ];

    downloadCsv(
      `${safeFilename(row.project.projectCode || row.project.name)}-resource-budget-report.csv`,
      records
    );
  }

  async function shareProject(row: PortfolioRow) {
    const utilization = row.planned > 0
      ? Math.round(row.spent / row.planned * 100)
      : 0;

    const summary = [
      'HOPE FOUNDATION - PROJECT RESOURCE & BUDGET SUMMARY',
      '',
      `Project: ${row.project.name}`,
      `Project Code: ${row.project.projectCode}`,
      `Status: ${row.project.status}`,
      '',
      'FINANCIAL SUMMARY',
      `Planned Budget: ${inr(row.planned)}`,
      `Recorded Expenses: ${inr(row.spent)}`,
      `Remaining Budget: ${inr(row.remaining)}`,
      `Budget Utilisation: ${utilization}%`,
      `Funding Received: ${inr(row.fundingReceived)}`,
      `Funding Committed: ${inr(row.fundingCommitted)}`,
      '',
      'RESOURCE SUMMARY',
      `Total Resource Records: ${row.resourceCount}`,
      `Resource Alerts: ${row.lowStock}`,
      '',
      'EVENT SUMMARY',
      `Linked Events: ${row.events.length}`,
      `Linked Event Budgets: ${inr(row.eventBudget)}`,
      '',
      'Note: Figures are calculated from records currently saved in the system.',
    ].join('\n');

    setSharingProject(row.project.id);

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${row.project.name} - Resource & Budget Summary`,
          text: summary,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary);

        window.alert(
          'Project summary copied. You can paste it into email or WhatsApp.'
        );
      } else {
        window.alert(summary);
      }
    } catch (err) {
      if (
        err instanceof Error &&
        err.name !== 'AbortError'
      ) {
        setError(
          `Unable to share ${row.project.name}. Please try exporting its report.`
        );
      }
    } finally {
      setSharingProject(null);
    }
  }

  async function shareSummary() {
    const summary = [
      'HOPE FOUNDATION - RESOURCE & BUDGET SUMMARY',
      `Projects included: ${rows.length}`,
      `Planned annual budget: ${inr(totals.planned)}`,
      `Recorded expenditure: ${inr(totals.spent)}`,
      `Remaining budget: ${inr(totals.remaining)}`,
      `Budget utilisation: ${totalUtilization}%`,
      `Funding received: ${inr(totals.received)}`,
      `Funding committed: ${inr(totals.committed)}`,
      `Resource records: ${totals.resources}`,
      `Resource alerts: ${totals.alerts}`,
      `Linked event budgets: ${inr(totals.eventBudget)}`,
      '',
      ...visibleRows.map(row =>
        `${row.project.name} (${row.project.projectCode}): Planned ${inr(row.planned)}, Spent ${inr(row.spent)}, Balance ${inr(row.remaining)}, Resources ${row.resourceCount}, Events ${row.events.length}`
      ),
      '',
      'Note: Figures are calculated from records currently saved in the system.',
    ].join('\n');

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Hope Foundation Resource & Budget Summary',
          text: summary,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary);

        window.alert(
          'Summary copied. You can paste it into email or WhatsApp.'
        );
      } else {
        window.alert(summary);
      }
    } catch (err) {
      if (
        err instanceof Error &&
        err.name !== 'AbortError'
      ) {
        setError(
          'Unable to share the summary. Please use CSV export.'
        );
      }
    }
  }

  return (
    <div className="flex flex-col gap-6 min-w-0">
      {/* Overview heading and actions */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            All Projects Overview
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Consolidated financial, resource and event overview across all projects.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadPortfolio()}
            disabled={loading}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw
              size={15}
              className={loading ? 'animate-spin' : ''}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={exportCsv}
            disabled={loading || rows.length === 0}
            className="btn-secondary flex items-center gap-2"
          >
            <Download size={15} />
            Export All
          </button>

          <button
            type="button"
            onClick={() => void shareSummary()}
            disabled={loading || rows.length === 0}
            className="btn-primary flex items-center gap-2"
          >
            <Share2 size={15} />
            Share Summary
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="card p-10 text-center text-sm text-slate-500">
          <RefreshCw
            size={22}
            className="mx-auto mb-3 animate-spin text-teal-600"
          />
          Loading all project and event records...
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              icon={<Wallet size={19} />}
              title="Planned Budget"
              value={inr(totals.planned)}
              detail="Total planned across projects"
              color="teal"
            />

            <SummaryCard
              icon={<TrendingDown size={19} />}
              title="Recorded Expenses"
              value={inr(totals.spent)}
              detail="Total recorded expenditure"
              color="indigo"
            />

            <SummaryCard
              icon={<TrendingUp size={19} />}
              title="Remaining Balance"
              value={inr(totals.remaining)}
              detail="Planned budget less expenses"
              color={totals.remaining < 0 ? 'red' : 'green'}
            />

            <SummaryCard
              icon={<Package size={19} />}
              title="Resource Records"
              value={String(totals.resources)}
              detail="Across all projects"
              color="blue"
            />

            <SummaryCard
              icon={<AlertTriangle size={19} />}
              title="Resource Alerts"
              value={String(totals.alerts)}
              detail="Maintenance, retired or zero stock"
              color="amber"
            />

            <SummaryCard
              icon={<Wallet size={19} />}
              title="Funding Received"
              value={inr(totals.received)}
              detail="Funding marked received"
              color="green"
            />

            <SummaryCard
              icon={<Wallet size={19} />}
              title="Funding Committed"
              value={inr(totals.committed)}
              detail="Funding marked committed"
              color="purple"
            />

            <SummaryCard
              icon={<CalendarDays size={19} />}
              title="Event Budgets"
              value={inr(totals.eventBudget)}
              detail={`${allEvents.length} linked event records`}
              color="orange"
            />
          </div>

          {/* Overall budget utilisation */}
          <div className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-slate-800">
                  Overall Budget Utilisation
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Recorded expenditure compared with planned budget
                </p>
              </div>

              <div className="text-right">
                <div
                  className={`text-2xl font-extrabold ${
                    totalUtilization > 100
                      ? 'text-red-600'
                      : 'text-teal-700'
                  }`}
                >
                  {totalUtilization}%
                </div>
                <div className="text-xs text-slate-500">
                  Utilised
                </div>
              </div>
            </div>

            <div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${
                  totalUtilization > 100
                    ? 'bg-red-500'
                    : 'bg-teal-500'
                }`}
                style={{
                  width: `${Math.min(100, totalUtilization)}%`,
                }}
              />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div>
                <span className="text-xs text-slate-500">
                  Planned
                </span>
                <p className="font-bold text-slate-800">
                  {inr(totals.planned)}
                </p>
              </div>

              <div>
                <span className="text-xs text-slate-500">
                  Spent
                </span>
                <p className="font-bold text-slate-800">
                  {inr(totals.spent)}
                </p>
              </div>

              <div>
                <span className="text-xs text-slate-500">
                  Balance
                </span>
                <p className={`font-bold ${
                  totals.remaining < 0
                    ? 'text-red-600'
                    : 'text-emerald-700'
                }`}>
                  {inr(totals.remaining)}
                </p>
              </div>
            </div>
          </div>

          {/* Main financial charts */}
          <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
            <ChartCard
              title="Project-wise Budget Comparison"
              subtitle="Top 10 projects by planned budget"
              icon={<BarChart3 size={18} />}
            >
              {projectChartData.length > 0 ? (
                <div className="h-[320px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={projectChartData}
                      margin={{
                        top: 12,
                        right: 15,
                        left: 10,
                        bottom: 10,
                      }}
                      barGap={5}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={65}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        width={75}
                        tickFormatter={compactInr}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip
                        formatter={(value) => inr(Number(value))}
                      />
                      <Legend />
                      <Bar
                        dataKey="planned"
                        name="Planned Budget"
                        fill="#CBD5E1"
                        radius={[5, 5, 0, 0]}
                      />
                      <Bar
                        dataKey="spent"
                        name="Actual Expenses"
                        fill="#0D9488"
                        radius={[5, 5, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <ChartEmpty message="No project budget data available." />
              )}
            </ChartCard>

            <ChartCard
              title="Budget by Section"
              subtitle="Planned allocation compared with actual expenses"
              icon={<Wallet size={18} />}
            >
              {sectionChartData.length > 0 ? (
                <div className="h-[320px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={sectionChartData}
                      margin={{
                        top: 12,
                        right: 15,
                        left: 10,
                        bottom: 10,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="section"
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        width={75}
                        tickFormatter={compactInr}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip
                        formatter={(value) => inr(Number(value))}
                      />
                      <Legend />
                      <Bar
                        dataKey="planned"
                        name="Planned"
                        fill="#6366F1"
                        radius={[5, 5, 0, 0]}
                      />
                      <Bar
                        dataKey="spent"
                        name="Spent"
                        fill="#F59E0B"
                        radius={[5, 5, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <ChartEmpty message="No budget section data available." />
              )}
            </ChartCard>
          </div>

          {/* Resource and funding charts */}
          <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
            <ChartCard
              title="Resource Inventory Status"
              subtitle="Distribution of saved resource records"
              icon={<Package size={18} />}
            >
              {resourceChartData.length > 0 ? (
                <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-2">
                  <div className="h-[260px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={resourceChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={95}
                          paddingAngle={3}
                        >
                          {resourceChartData.map((item, index) => (
                            <Cell
                              key={item.name}
                              fill={chartColors[index % chartColors.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-3">
                    {resourceChartData.map((item, index) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-2 text-slate-600">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{
                              background: chartColors[index % chartColors.length],
                            }}
                          />
                          <span className="truncate">{item.name}</span>
                        </span>
                        <strong className="text-slate-800">
                          {item.value}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <ChartEmpty message="No inventory records available." />
              )}
            </ChartCard>

            <ChartCard
              title="Funding Status Breakdown"
              subtitle="Funding amounts grouped by their saved status"
              icon={<PieIcon size={18} />}
            >
              {fundingChartData.length > 0 ? (
                <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-2">
                  <div className="h-[260px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={fundingChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={95}
                          paddingAngle={3}
                        >
                          {fundingChartData.map((item, index) => (
                            <Cell
                              key={item.name}
                              fill={chartColors[index % chartColors.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => inr(Number(value))}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-3">
                    {fundingChartData.map((item, index) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-2 text-slate-600">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{
                              background: chartColors[index % chartColors.length],
                            }}
                          />
                          <span className="truncate">{item.name}</span>
                        </span>
                        <strong className="text-slate-800">
                          {inr(item.value)}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <ChartEmpty message="No funding records available." />
              )}
            </ChartCard>
          </div>

          {/* Project table */}
          <div className="card min-w-0 overflow-hidden">
            <div className="card-header flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <span className="card-title">
                  Project-wise Budget & Resource Summary
                </span>
                <p className="mt-1 text-xs text-slate-500">
                  View, share or export individual project information.
                </p>
              </div>

              <div className="relative w-full lg:max-w-xs">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search project..."
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Status</th>
                    <th>Planned Budget</th>
                    <th>Expenses</th>
                    <th>Balance</th>
                    <th>Utilisation</th>
                    <th>Funding</th>
                    <th>Resources</th>
                    <th>Events</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleRows.map(row => {
                    const utilization = row.planned > 0
                      ? Math.round(row.spent / row.planned * 100)
                      : 0;

                    return (
                      <tr key={row.project.id}>
                        <td>
                          <div className="font-bold text-slate-800">
                            {row.project.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {row.project.projectCode}
                          </div>
                        </td>

                        <td>{row.project.status}</td>

                        <td className="font-semibold">
                          {inr(row.planned)}
                        </td>

                        <td>{inr(row.spent)}</td>

                        <td
                          className={
                            row.remaining < 0
                              ? 'font-bold text-red-600'
                              : 'font-semibold text-emerald-700'
                          }
                        >
                          {inr(row.remaining)}
                        </td>

                        <td>
                          <div className="min-w-20">
                            <div className="font-semibold">
                              {utilization}%
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${
                                  utilization > 100
                                    ? 'bg-red-500'
                                    : 'bg-teal-500'
                                }`}
                                style={{
                                  width: `${Math.min(100, utilization)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="whitespace-nowrap text-xs">
                            Received: {inr(row.fundingReceived)}
                          </div>
                          <div className="whitespace-nowrap text-xs text-slate-500">
                            Committed: {inr(row.fundingCommitted)}
                          </div>
                        </td>

                        <td>
                          <div className="font-semibold">
                            {row.resourceCount} records
                          </div>
                          {row.lowStock > 0 && (
                            <div className="text-xs font-bold text-amber-600">
                              {row.lowStock} alerts
                            </div>
                          )}
                        </td>

                        <td>
                          <div className="font-semibold">
                            {row.events.length} events
                          </div>
                          <div className="whitespace-nowrap text-xs text-slate-500">
                            {inr(row.eventBudget)}
                          </div>
                        </td>

                        <td>
                          <div className="flex min-w-max items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void shareProject(row)}
                              disabled={sharingProject === row.project.id}
                              title="Share project summary"
                              className="rounded-lg p-2 text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                            >
                              {sharingProject === row.project.id ? (
                                <RefreshCw size={16} className="animate-spin" />
                              ) : (
                                <Share2 size={16} />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => exportProject(row)}
                              title="Export project details"
                              className="rounded-lg p-2 text-indigo-700 hover:bg-indigo-50"
                            >
                              <Download size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {visibleRows.length === 0 && (
                <div className="p-8 text-center text-sm text-slate-500">
                  No project records match your search.
                </div>
              )}
            </div>
          </div>

          {/* Event overview */}
          <div className="card min-w-0 overflow-hidden">
            <div className="card-header flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="card-title">
                  Event Budget Overview
                </span>
                <p className="mt-1 text-xs text-slate-500">
                  Events linked to projects and their budget information.
                </p>
              </div>

              <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
                {allEvents.length} events
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Project</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Event Budget</th>
                    <th>Project Resources</th>
                  </tr>
                </thead>

                <tbody>
                  {allEvents.map(event => {
                    const linked = rows.find(
                      row => row.project.id === event.projectId
                    );

                    return (
                      <tr key={event.id}>
                        <td className="font-semibold text-slate-800">
                          {event.title}
                        </td>

                        <td>
                          {event.projectName || 'Not linked to a project'}
                        </td>

                        <td>
                          {event.startsAt
                            ? new Date(event.startsAt).toLocaleDateString('en-IN')
                            : '—'}
                        </td>

                        <td>{event.eventType}</td>
                        <td>{event.status}</td>

                        <td>
                          {event.budget == null
                            ? 'Not available'
                            : inr(n(event.budget))}
                        </td>

                        <td>
                          {linked
                            ? `${linked.resourceCount} project resource records`
                            : 'No linked project resources'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {allEvents.length === 0 && (
                <div className="p-8 text-center text-sm text-slate-500">
                  No event records found.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  title,
  value,
  detail,
  color,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  detail: string;
  color: 'teal' | 'indigo' | 'green' | 'blue' | 'amber' | 'purple' | 'orange' | 'red';
}) {
  const styles = {
    teal: 'bg-teal-50 text-teal-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    green: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    purple: 'bg-purple-50 text-purple-700',
    orange: 'bg-orange-50 text-orange-700',
    red: 'bg-red-50 text-red-700',
  };

  return (
    <div className="stat-card flex min-w-0 items-center gap-3">
      <div className={`shrink-0 rounded-xl p-3 ${styles[color]}`}>
        {icon}
      </div>

      <div className="min-w-0">
        <div className="truncate text-lg font-extrabold text-slate-900">
          {value}
        </div>

        <div className="text-xs font-bold text-slate-600">
          {title}
        </div>

        <div className="mt-0.5 text-[11px] text-slate-400">
          {detail}
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="card min-w-0 overflow-hidden">
      <div className="card-header flex items-start gap-3">
        <div className="rounded-xl bg-teal-50 p-2 text-teal-700">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="card-title">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="card-body min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] flex-col items-center justify-center text-center">
      <BarChart3 size={28} className="mb-3 text-slate-300" />
      <p className="text-sm font-semibold text-slate-600">
        No chart data available
      </p>
      <p className="mt-1 text-xs text-slate-400">
        {message}
      </p>
    </div>
  );
}
