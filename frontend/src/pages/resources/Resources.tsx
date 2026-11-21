
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Plus, RefreshCw, Pencil, Trash2, Wallet, TrendingDown,
  PiggyBank, Package, AlertTriangle, X, Search,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from 'recharts';
import {
  apiList, apiCreate, apiUpdate, apiDelete,
} from '../../services/apiClient';
import PortfolioOverview from './PortfolioOverview';

type Tab = 'overview' | 'budget' | 'expenses' | 'inventory' | 'funding';

interface Project {
  id: string;
  name: string;
  projectCode: string;
  status?: string;
}

interface BudgetItem {
  id: string;
  projectId: string;
  section: 'Salaries' | 'Operations' | 'Assets';
  itemName: string;
  itemType?: string;
  quantity: number;
  unitCost: number;
  frequencyPerYear?: number | null;
}

interface Expense {
  id: string;
  projectId: string;
  expenseDate: string;
  section: 'Salaries' | 'Operations' | 'Assets';
  head: string;
  description: string;
  amount: number;
  paidTo: string;
}

interface FundingSource {
  id: string;
  projectId: string;
  sourceName: string;
  amount: number;
  status: 'Identified' | 'Applied' | 'Committed' | 'Received';
}

interface Resource {
  id: string;
  projectId: string;
  name: string;
  resourceType: string;
  quantity: number;
  unit: string;
  location: string;
  status: 'Available' | 'In Use' | 'Maintenance' | 'Retired';
}

type RecordItem = BudgetItem | Expense | FundingSource | Resource;

const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

const numberValue = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const annualBudgetAmount = (item: BudgetItem) =>
  numberValue(item.quantity) *
  numberValue(item.unitCost) *
  numberValue(item.frequencyPerYear ?? 1);

const today = () => new Date().toISOString().slice(0, 10);

const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'budget', label: 'Budget' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'funding', label: 'Funding' },
];

const chartColors = ['#0D9488', '#6366F1', '#F59E0B', '#E879F9'];

const emptyDraft = (tab: Tab): Record<string, string> => {
  if (tab === 'budget') {
    return {
      section: 'Operations',
      itemName: '',
      itemType: '',
      quantity: '1',
      unitCost: '',
      frequencyPerYear: '1',
    };
  }

  if (tab === 'expenses') {
    return {
      expenseDate: today(),
      section: 'Operations',
      head: '',
      description: '',
      amount: '',
      paidTo: '',
    };
  }

  if (tab === 'funding') {
    return {
      sourceName: '',
      amount: '',
      status: 'Identified',
    };
  }

  return {
    name: '',
    resourceType: 'Equipment',
    quantity: '0',
    unit: 'item',
    location: '',
    status: 'Available',
  };
};

export default function ResourcesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [funding, setFunding] = useState<FundingSource[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RecordItem | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>(
    emptyDraft('budget')
  );

  const selectedProject = projects.find(
    project => project.id === projectId
  );

  // Load projects from the backend.
  useEffect(() => {
    let active = true;

    async function loadProjects() {
      setLoadingProjects(true);
      setError('');

      try {
        const response = await apiList<Project>('projects', {
          limit: 200,
          offset: 0,
        });

        if (!active) return;

        const rows = response.items ?? [];
        setProjects(rows);

        if (rows.length > 0) {
          setProjectId(current =>
            current && rows.some(project => project.id === current)
              ? current
              : rows[0].id
          );
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load projects.'
          );
        }
      } finally {
        if (active) setLoadingProjects(false);
      }
    }

    void loadProjects();

    return () => {
      active = false;
    };
  }, []);

  // Load the selected project's saved records.
  useEffect(() => {
    if (!projectId) {
      setBudgetItems([]);
      setExpenses([]);
      setFunding([]);
      setResources([]);
      return;
    }

    let active = true;

    async function loadRecords() {
      setLoadingRecords(true);
      setError('');

      try {
        const [
          budgetResponse,
          expenseResponse,
          fundingResponse,
          resourceResponse,
        ] = await Promise.all([
          apiList<BudgetItem>('budget-items', {
            projectId,
            limit: 200,
          }),
          apiList<Expense>('expenses', {
            projectId,
            limit: 200,
          }),
          apiList<FundingSource>('funding-sources', {
            projectId,
            limit: 200,
          }),
          apiList<Resource>('resources', {
            projectId,
            limit: 200,
          }),
        ]);

        if (!active) return;

        setBudgetItems(budgetResponse.items ?? []);
        setExpenses(expenseResponse.items ?? []);
        setFunding(fundingResponse.items ?? []);
        setResources(resourceResponse.items ?? []);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load project records.'
          );
        }
      } finally {
        if (active) setLoadingRecords(false);
      }
    }

    void loadRecords();

    return () => {
      active = false;
    };
  }, [projectId]);

  // Annual planned budget includes quantity, unit cost and yearly frequency.
  const plannedBudget = useMemo(
    () =>
      budgetItems.reduce(
        (sum, item) => sum + annualBudgetAmount(item),
        0
      ),
    [budgetItems]
  );

  const actualSpent = useMemo(
    () =>
      expenses.reduce(
        (sum, expense) =>
          sum + numberValue(expense.amount),
        0
      ),
    [expenses]
  );

  const remaining = plannedBudget - actualSpent;

  const utilization = plannedBudget > 0
    ? Math.round((actualSpent / plannedBudget) * 100)
    : 0;

  const receivedFunding = funding
    .filter(item => item.status === 'Received')
    .reduce(
      (sum, item) => sum + numberValue(item.amount),
      0
    );

  const committedFunding = funding
    .filter(item => item.status === 'Committed')
    .reduce(
      (sum, item) => sum + numberValue(item.amount),
      0
    );

  const criticalResources = resources.filter(
    item =>
      item.status === 'Maintenance' ||
      numberValue(item.quantity) <= 0
  ).length;

  // Budget and expenditure totals grouped by section.
  const budgetBySection = (
    ['Salaries', 'Operations', 'Assets'] as const
  ).map(section => {
    const planned = budgetItems
      .filter(item => item.section === section)
      .reduce(
        (sum, item) => sum + annualBudgetAmount(item),
        0
      );

    const spent = expenses
      .filter(item => item.section === section)
      .reduce(
        (sum, item) => sum + numberValue(item.amount),
        0
      );

    return { section, planned, spent };
  });

  const expenseBySection = budgetBySection
    .map(item => ({
      name: item.section,
      value: item.spent,
    }))
    .filter(item => item.value > 0);

  const filteredExpenses = expenses.filter(item =>
    `${item.head} ${item.description} ${item.paidTo}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const filteredResources = resources.filter(item =>
    `${item.name} ${item.resourceType} ${item.location}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const filteredBudget = budgetItems.filter(item =>
    `${item.itemName} ${item.section} ${item.itemType ?? ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const filteredFunding = funding.filter(item =>
    `${item.sourceName} ${item.status}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  function openAdd() {
    setEditing(null);
    setDraft(emptyDraft(activeTab));
    setError('');
    setModalOpen(true);
  }

  function openEdit(item: RecordItem) {
    setEditing(item);

    if (activeTab === 'budget') {
      const row = item as BudgetItem;

      setDraft({
        section: row.section,
        itemName: row.itemName,
        itemType: row.itemType ?? '',
        quantity: String(row.quantity),
        unitCost: String(row.unitCost),
        frequencyPerYear: String(
          row.frequencyPerYear ?? 1
        ),
      });
    } else if (activeTab === 'expenses') {
      const row = item as Expense;

      setDraft({
        expenseDate: String(row.expenseDate).slice(0, 10),
        section: row.section,
        head: row.head,
        description: row.description ?? '',
        amount: String(row.amount),
        paidTo: row.paidTo,
      });
    } else if (activeTab === 'funding') {
      const row = item as FundingSource;

      setDraft({
        sourceName: row.sourceName,
        amount: String(row.amount),
        status: row.status,
      });
    } else {
      const row = item as Resource;

      setDraft({
        name: row.name,
        resourceType: row.resourceType,
        quantity: String(row.quantity),
        unit: row.unit,
        location: row.location ?? '',
        status: row.status,
      });
    }

    setError('');
    setModalOpen(true);
  }

  async function refreshRecords() {
    if (!projectId) return;

    const [b, e, f, r] = await Promise.all([
      apiList<BudgetItem>('budget-items', {
        projectId,
        limit: 200,
      }),
      apiList<Expense>('expenses', {
        projectId,
        limit: 200,
      }),
      apiList<FundingSource>('funding-sources', {
        projectId,
        limit: 200,
      }),
      apiList<Resource>('resources', {
        projectId,
        limit: 200,
      }),
    ]);

    setBudgetItems(b.items ?? []);
    setExpenses(e.items ?? []);
    setFunding(f.items ?? []);
    setResources(r.items ?? []);
  }

  async function saveRecord() {
    if (!projectId) {
      setError('Select a project before adding records.');
      return;
    }

    const numericFields = [
      'quantity',
      'unitCost',
      'frequencyPerYear',
      'amount',
    ];

    for (const field of numericFields) {
      if (
        draft[field] !== undefined &&
        draft[field] !== ''
      ) {
        const value = Number(draft[field]);

        if (!Number.isFinite(value) || value < 0) {
          setError(
            `${field} must be a valid non-negative number.`
          );
          return;
        }
      }
    }

    let payload: Record<string, unknown> = {
      projectId,
    };

    if (activeTab === 'budget') {
      if (!draft.itemName?.trim()) {
        setError('Budget item name is required.');
        return;
      }

      payload = {
        ...payload,
        section: draft.section,
        itemName: draft.itemName.trim(),
        itemType: draft.itemType.trim() || null,
        quantity: Number(draft.quantity || 0),
        unitCost: Number(draft.unitCost || 0),
        frequencyPerYear: Number(
          draft.frequencyPerYear || 1
        ),
      };
    } else if (activeTab === 'expenses') {
      if (
        !draft.expenseDate ||
        !draft.head?.trim() ||
        !(Number(draft.amount) > 0) ||
        !draft.paidTo?.trim()
      ) {
        setError(
          'Enter the date, expense head, a positive amount and payee.'
        );
        return;
      }

      payload = {
        ...payload,
        expenseDate: draft.expenseDate,
        section: draft.section,
        head: draft.head.trim(),
        description: draft.description.trim(),
        amount: Number(draft.amount),
        paidTo: draft.paidTo.trim(),
      };
    } else if (activeTab === 'funding') {
      if (!draft.sourceName?.trim()) {
        setError('Funding source name is required.');
        return;
      }

      payload = {
        ...payload,
        sourceName: draft.sourceName.trim(),
        amount: Number(draft.amount || 0),
        status: draft.status,
      };
    } else {
      if (
        !draft.name?.trim() ||
        !draft.resourceType?.trim() ||
        !draft.unit?.trim()
      ) {
        setError(
          'Resource name, type and unit are required.'
        );
        return;
      }

      payload = {
        ...payload,
        name: draft.name.trim(),
        resourceType: draft.resourceType.trim(),
        quantity: Number(draft.quantity || 0),
        unit: draft.unit.trim(),
        location: draft.location.trim(),
        status: draft.status,
      };
    }

    const resourceName =
      activeTab === 'budget'
        ? 'budget-items'
        : activeTab === 'expenses'
          ? 'expenses'
          : activeTab === 'funding'
            ? 'funding-sources'
            : 'resources';

    setSaving(true);
    setError('');

    try {
      if (editing) {
        await apiUpdate(
          resourceName,
          editing.id,
          payload
        );
      } else {
        await apiCreate(resourceName, payload);
      }

      await refreshRecords();

      setModalOpen(false);
      setEditing(null);
      setDraft(emptyDraft(activeTab));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save this record.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(item: RecordItem) {
    const label =
      activeTab === 'budget'
        ? (item as BudgetItem).itemName
        : activeTab === 'expenses'
          ? (item as Expense).head
          : activeTab === 'funding'
            ? (item as FundingSource).sourceName
            : (item as Resource).name;

    if (
      !window.confirm(
        `Delete "${label}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    const resourceName =
      activeTab === 'budget'
        ? 'budget-items'
        : activeTab === 'expenses'
          ? 'expenses'
          : activeTab === 'funding'
            ? 'funding-sources'
            : 'resources';

    setError('');

    try {
      await apiDelete(resourceName, item.id);
      await refreshRecords();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete this record.'
      );
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Page heading */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="page-title">
            Resources &amp; Budget
          </h1>

          <p className="page-subtitle">
            Track project budgets, spending, funding and physical resources using saved records.
          </p>
        </div>

        {activeTab !== 'overview' && (
          <div className="flex flex-wrap gap-2">
            <select
              value={projectId}
              onChange={event =>
                setProjectId(event.target.value)
              }
              disabled={
                loadingProjects || projects.length === 0
              }
              className="min-w-52 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"
            >
              {projects.length === 0 && (
                <option value="">
                  No projects available
                </option>
              )}

              {projects.map(project => (
                <option
                  key={project.id}
                  value={project.id}
                >
                  {project.name} ({project.projectCode})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() =>
                void refreshRecords().catch(err =>
                  setError(err.message)
                )
              }
              disabled={!projectId || loadingRecords}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw
                size={15}
                className={
                  loadingRecords ? 'animate-spin' : ''
                }
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={openAdd}
              disabled={!projectId}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} />
              Add{' '}
              {activeTab === 'budget'
                ? 'Budget Item'
                : activeTab === 'expenses'
                  ? 'Expense'
                  : activeTab === 'funding'
                    ? 'Funding'
                    : 'Resource'}
            </button>
          </div>
        )}
      </div>

      {/* Selected project information */}
      {activeTab !== 'overview' && selectedProject && (
        <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          Showing saved records for{' '}
          <strong>{selectedProject.name}</strong>

          <span className="ml-2 text-teal-700">
            ({selectedProject.projectCode})
          </span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <AlertTriangle
            size={17}
            className="mt-0.5 shrink-0"
          />

          <span className="flex-1">{error}</span>

          <button
            type="button"
            onClick={() => setError('')}
            aria-label="Close error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Project-specific KPI cards */}
      {activeTab !== 'overview' && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Kpi
            title="Planned Budget"
            value={money(plannedBudget)}
            detail={`${budgetItems.length} saved budget items`}
            icon={<Wallet size={19} />}
            color="teal"
          />

          <Kpi
            title="Actual Expenditure"
            value={money(actualSpent)}
            detail={`${expenses.length} recorded expenses`}
            icon={<TrendingDown size={19} />}
            color="indigo"
          />

          <Kpi
            title="Budget Balance"
            value={money(remaining)}
            detail={`${utilization}% budget utilisation`}
            icon={<PiggyBank size={19} />}
            color={remaining < 0 ? 'red' : 'green'}
          />

          <Kpi
            title="Inventory Alerts"
            value={String(criticalResources)}
            detail="Zero-stock or maintenance items"
            icon={<Package size={19} />}
            color="amber"
          />
        </div>
      )}

      {/* Navigation tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="tab-bar w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`tab-item ${
                activeTab === tab.id ? 'active' : ''
              }`}
              onClick={() => {
                setActiveTab(tab.id);
                setSearch('');
                setError('');
                setModalOpen(false);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab !== 'overview' && (
          <div className="relative min-w-48 flex-1 max-w-xs">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={event =>
                setSearch(event.target.value)
              }
              placeholder={`Search ${activeTab}...`}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-500"
            />
          </div>
        )}
      </div>

      {/* Overview loads all projects and events independently */}
      {activeTab === 'overview' ? (
        <PortfolioOverview />
      ) : loadingProjects || loadingRecords ? (
        <div className="card p-10 text-center text-sm text-slate-500">
          <RefreshCw
            size={20}
            className="mx-auto mb-3 animate-spin text-teal-600"
          />
          Loading records from the database...
        </div>
      ) : !projectId ? (
        <EmptyState
          title="No project selected"
          message="Create or approve a project before adding budget and resource records."
        />
      ) : (
        <>
          {/* BUDGET TAB */}
          {activeTab === 'budget' && (
            <>
              <div className="grid gap-4 xl:grid-cols-3">
                {budgetBySection.map((section, index) => (
                  <div
                    key={section.section}
                    className="stat-card"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700">
                        {section.section}
                      </span>

                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          background: chartColors[index],
                        }}
                      />
                    </div>

                    <div className="text-xl font-extrabold text-slate-900">
                      {money(section.planned)}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      Actual spent: {money(section.spent)}
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${
                            section.planned > 0
                              ? Math.min(
                                  100,
                                  section.spent /
                                    section.planned *
                                    100
                                )
                              : 0
                          }%`,
                          background: chartColors[index],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* ALIGNED PLANNED BUDGET VS ACTUAL EXPENDITURE CHART */}
              <div className="card min-w-0 overflow-hidden">
                <div className="card-header">
                  <span className="card-title">
                    Planned Budget vs Actual Expenditure
                  </span>
                </div>

                <div className="card-body min-w-0">
                  {budgetBySection.some(
                    item => item.planned > 0 || item.spent > 0
                  ) ? (
                    <div className="w-full min-w-0">
                      <div className="h-[320px] w-full min-w-0">
                        <ResponsiveContainer
                          width="100%"
                          height="100%"
                          debounce={100}
                        >
                          <BarChart
                            data={budgetBySection}
                            margin={{
                              top: 15,
                              right: 25,
                              left: 15,
                              bottom: 10,
                            }}
                            barCategoryGap="25%"
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                              stroke="#E2E8F0"
                            />

                            <XAxis
                              dataKey="section"
                              tick={{
                                fontSize: 12,
                                fill: '#64748B',
                              }}
                              tickLine={false}
                              axisLine={{
                                stroke: '#CBD5E1',
                              }}
                              interval={0}
                              height={35}
                            />

                            <YAxis
                              width={100}
                              tick={{
                                fontSize: 11,
                                fill: '#64748B',
                              }}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={value =>
                                `₹${Number(value).toLocaleString('en-IN')}`
                              }
                              domain={[0, 'auto']}
                            />

                            <Tooltip
                              formatter={value =>
                                money(Number(value))
                              }
                              contentStyle={{
                                borderRadius: '12px',
                                border: '1px solid #E2E8F0',
                                fontSize: '12px',
                              }}
                            />

                            <Legend
                              verticalAlign="bottom"
                              align="center"
                              wrapperStyle={{
                                paddingTop: '15px',
                                fontSize: '12px',
                              }}
                            />

                            <Bar
                              dataKey="planned"
                              name="Planned Budget"
                              fill="#CBD5E1"
                              radius={[5, 5, 0, 0]}
                              maxBarSize={48}
                            />

                            <Bar
                              dataKey="spent"
                              name="Actual Expenditure"
                              fill="#0D9488"
                              radius={[5, 5, 0, 0]}
                              maxBarSize={48}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      title="No budget data yet"
                      message="Add budget items and record expenses to generate this chart."
                    />
                  )}
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="card-header">
                  <span className="card-title">
                    Budget Items
                  </span>

                  <span className="text-xs text-slate-500">
                    {filteredBudget.length} records
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th>Budget head</th>
                        <th>Section</th>
                        <th>Quantity</th>
                        <th>Unit cost</th>
                        <th>Frequency/year</th>
                        <th>Planned total</th>
                        <th>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredBudget.map(item => (
                        <tr key={item.id}>
                          <td className="font-semibold text-slate-800">
                            {item.itemName}
                          </td>

                          <td>{item.section}</td>
                          <td>{numberValue(item.quantity)}</td>
                          <td>
                            {money(numberValue(item.unitCost))}
                          </td>

                          <td>
                            {numberValue(item.frequencyPerYear ?? 1)}
                          </td>

                          <td className="font-bold">
                            {money(annualBudgetAmount(item))}
                          </td>

                          <Actions
                            onEdit={() => openEdit(item)}
                            onDelete={() =>
                              void deleteRecord(item)
                            }
                          />
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredBudget.length === 0 && (
                    <EmptyState
                      title="No budget items found"
                      message="Add the approved budget heads for this project. No sample figures are displayed."
                    />
                  )}
                </div>
              </div>
            </>
          )}

          {/* EXPENSES TAB */}
          {activeTab === 'expenses' && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Kpi
                  title="Total Expenses"
                  value={money(actualSpent)}
                  detail={`${expenses.length} entries`}
                  icon={<TrendingDown size={19} />}
                  color="indigo"
                />

                <Kpi
                  title="Average Expense"
                  value={money(
                    expenses.length
                      ? actualSpent / expenses.length
                      : 0
                  )}
                  detail="Per recorded entry"
                  icon={<Wallet size={19} />}
                  color="teal"
                />

                <Kpi
                  title="Budget Utilisation"
                  value={`${utilization}%`}
                  detail="Actual expenditure ÷ planned budget"
                  icon={<PiggyBank size={19} />}
                  color="amber"
                />
              </div>

              {expenseBySection.length > 0 && (
                <div className="card min-w-0 overflow-hidden">
                  <div className="card-header">
                    <span className="card-title">
                      Expenditure by Section
                    </span>
                  </div>

                  <div className="card-body grid min-w-0 items-center gap-4 md:grid-cols-2">
                    <div className="h-[250px] min-w-0 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={expenseBySection}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={3}
                          >
                            {expenseBySection.map(
                              (item, index) => (
                                <Cell
                                  key={item.name}
                                  fill={
                                    chartColors[
                                      index % chartColors.length
                                    ]
                                  }
                                />
                              )
                            )}
                          </Pie>

                          <Tooltip
                            formatter={value =>
                              money(Number(value))
                            }
                          />

                          <Legend
                            verticalAlign="bottom"
                            align="center"
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-3">
                      {expenseBySection.map(
                        (item, index) => (
                          <div
                            key={item.name}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="flex items-center gap-2 text-slate-600">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{
                                  background:
                                    chartColors[index],
                                }}
                              />
                              {item.name}
                            </span>

                            <strong className="text-slate-800">
                              {money(item.value)}
                            </strong>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="card overflow-hidden">
                <div className="card-header">
                  <span className="card-title">
                    Expense Register
                  </span>

                  <span className="text-xs text-slate-500">
                    {filteredExpenses.length} records
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Expense head</th>
                        <th>Section</th>
                        <th>Paid to</th>
                        <th>Amount</th>
                        <th>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredExpenses.map(item => (
                        <tr key={item.id}>
                          <td>
                            {String(item.expenseDate).slice(0, 10)}
                          </td>

                          <td>
                            <div className="font-semibold text-slate-800">
                              {item.head}
                            </div>

                            <div className="text-xs text-slate-500">
                              {item.description}
                            </div>
                          </td>

                          <td>{item.section}</td>
                          <td>{item.paidTo}</td>

                          <td className="font-bold">
                            {money(numberValue(item.amount))}
                          </td>

                          <Actions
                            onEdit={() => openEdit(item)}
                            onDelete={() =>
                              void deleteRecord(item)
                            }
                          />
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredExpenses.length === 0 && (
                    <EmptyState
                      title="No expenses recorded"
                      message="Record an expense to begin tracking actual project expenditure."
                    />
                  )}
                </div>
              </div>
            </>
          )}

          {/* INVENTORY TAB */}
          {activeTab === 'inventory' && (
            <div className="card overflow-hidden">
              <div className="card-header">
                <span className="card-title">
                  Project Resource Inventory
                </span>

                <span className="text-xs text-slate-500">
                  {filteredResources.length} records
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th>Resource</th>
                      <th>Type</th>
                      <th>Quantity</th>
                      <th>Unit</th>
                      <th>Location</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredResources.map(item => (
                      <tr key={item.id}>
                        <td className="font-semibold text-slate-800">
                          {item.name}
                        </td>

                        <td>{item.resourceType}</td>

                        <td className="font-bold">
                          {numberValue(item.quantity)}
                        </td>

                        <td>{item.unit}</td>
                        <td>{item.location || '—'}</td>

                        <td>
                          <Status value={item.status} />
                        </td>

                        <Actions
                          onEdit={() => openEdit(item)}
                          onDelete={() =>
                            void deleteRecord(item)
                          }
                        />
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredResources.length === 0 && (
                  <EmptyState
                    title="No inventory records"
                    message="Add actual equipment, materials or other project resources."
                  />
                )}
              </div>
            </div>
          )}

          {/* FUNDING TAB */}
          {activeTab === 'funding' && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Kpi
                  title="Funding Received"
                  value={money(receivedFunding)}
                  detail="Sources marked Received"
                  icon={<Wallet size={19} />}
                  color="green"
                />

                <Kpi
                  title="Committed Funding"
                  value={money(committedFunding)}
                  detail="Sources marked Committed"
                  icon={<PiggyBank size={19} />}
                  color="teal"
                />

                <Kpi
                  title="Funding Sources"
                  value={String(funding.length)}
                  detail="Saved funding records"
                  icon={<TrendingDown size={19} />}
                  color="indigo"
                />
              </div>

              <div className="card overflow-hidden">
                <div className="card-header">
                  <span className="card-title">
                    Funding Sources Register
                  </span>

                  <span className="text-xs text-slate-500">
                    {filteredFunding.length} records
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredFunding.map(item => (
                        <tr key={item.id}>
                          <td className="font-semibold text-slate-800">
                            {item.sourceName}
                          </td>

                          <td className="font-bold">
                            {money(numberValue(item.amount))}
                          </td>

                          <td>
                            <Status value={item.status} />
                          </td>

                          <Actions
                            onEdit={() => openEdit(item)}
                            onDelete={() =>
                              void deleteRecord(item)
                            }
                          />
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredFunding.length === 0 && (
                    <EmptyState
                      title="No funding sources recorded"
                      message="Add grants, CSR support, donations or other confirmed and potential funding sources."
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
          <div className="my-auto w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  {editing ? 'Update' : 'Add'}{' '}
                  {activeTab === 'budget'
                    ? 'Budget Item'
                    : activeTab === 'expenses'
                      ? 'Expense'
                      : activeTab === 'funding'
                        ? 'Funding Source'
                        : 'Resource'}
                </h2>

                <p className="text-xs text-slate-500">
                  {selectedProject?.name}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {activeTab === 'budget' && (
                <>
                  <Field
                    label="Budget item name"
                    wide
                    value={draft.itemName}
                    onChange={v =>
                      setDraft({ ...draft, itemName: v })
                    }
                  />

                  <Select
                    label="Budget section"
                    value={draft.section}
                    onChange={v =>
                      setDraft({ ...draft, section: v })
                    }
                    options={[
                      'Salaries',
                      'Operations',
                      'Assets',
                    ]}
                  />

                  <Field
                    label="Item type"
                    value={draft.itemType}
                    onChange={v =>
                      setDraft({ ...draft, itemType: v })
                    }
                    placeholder="e.g. Monthly salary, materials"
                  />

                  <Field
                    label="Quantity"
                    type="number"
                    value={draft.quantity}
                    onChange={v =>
                      setDraft({ ...draft, quantity: v })
                    }
                  />

                  <Field
                    label="Unit cost (₹)"
                    type="number"
                    value={draft.unitCost}
                    onChange={v =>
                      setDraft({ ...draft, unitCost: v })
                    }
                  />

                  <Field
                    label="Frequency per year"
                    type="number"
                    value={draft.frequencyPerYear}
                    onChange={v =>
                      setDraft({
                        ...draft,
                        frequencyPerYear: v,
                      })
                    }
                  />

                  <div className="rounded-xl bg-slate-50 p-3 text-sm sm:col-span-2">
                    <div className="text-xs text-slate-500">
                      Estimated annual planned amount
                    </div>

                    <strong className="mt-1 block text-lg text-slate-900">
                      {money(
                        numberValue(draft.quantity) *
                          numberValue(draft.unitCost) *
                          numberValue(draft.frequencyPerYear || 1)
                      )}
                    </strong>

                    <p className="mt-1 text-xs text-slate-500">
                      Quantity × Unit cost × Frequency per year
                    </p>
                  </div>
                </>
              )}

              {activeTab === 'expenses' && (
                <>
                  <Field
                    label="Expense date"
                    type="date"
                    value={draft.expenseDate}
                    onChange={v =>
                      setDraft({ ...draft, expenseDate: v })
                    }
                  />

                  <Select
                    label="Section"
                    value={draft.section}
                    onChange={v =>
                      setDraft({ ...draft, section: v })
                    }
                    options={[
                      'Salaries',
                      'Operations',
                      'Assets',
                    ]}
                  />

                  <Field
                    label="Expense head"
                    wide
                    value={draft.head}
                    onChange={v =>
                      setDraft({ ...draft, head: v })
                    }
                    placeholder="e.g. Travel, supplies, salary"
                  />

                  <Field
                    label="Amount (₹)"
                    type="number"
                    value={draft.amount}
                    onChange={v =>
                      setDraft({ ...draft, amount: v })
                    }
                  />

                  <Field
                    label="Paid to"
                    value={draft.paidTo}
                    onChange={v =>
                      setDraft({ ...draft, paidTo: v })
                    }
                  />

                  <Field
                    label="Description"
                    wide
                    value={draft.description}
                    onChange={v =>
                      setDraft({ ...draft, description: v })
                    }
                  />
                </>
              )}

              {activeTab === 'funding' && (
                <>
                  <Field
                    label="Funding source"
                    wide
                    value={draft.sourceName}
                    onChange={v =>
                      setDraft({ ...draft, sourceName: v })
                    }
                    placeholder="Donor, CSR, grant or institution"
                  />

                  <Field
                    label="Amount (₹)"
                    type="number"
                    value={draft.amount}
                    onChange={v =>
                      setDraft({ ...draft, amount: v })
                    }
                  />

                  <Select
                    label="Funding status"
                    value={draft.status}
                    onChange={v =>
                      setDraft({ ...draft, status: v })
                    }
                    options={[
                      'Identified',
                      'Applied',
                      'Committed',
                      'Received',
                    ]}
                  />
                </>
              )}

              {activeTab === 'inventory' && (
                <>
                  <Field
                    label="Resource name"
                    wide
                    value={draft.name}
                    onChange={v =>
                      setDraft({ ...draft, name: v })
                    }
                  />

                  <Field
                    label="Resource type"
                    value={draft.resourceType}
                    onChange={v =>
                      setDraft({
                        ...draft,
                        resourceType: v,
                      })
                    }
                    placeholder="Equipment, material, vehicle..."
                  />

                  <Field
                    label="Quantity"
                    type="number"
                    value={draft.quantity}
                    onChange={v =>
                      setDraft({ ...draft, quantity: v })
                    }
                  />

                  <Field
                    label="Unit"
                    value={draft.unit}
                    onChange={v =>
                      setDraft({ ...draft, unit: v })
                    }
                    placeholder="pieces, kits, laptops..."
                  />

                  <Field
                    label="Location"
                    value={draft.location}
                    onChange={v =>
                      setDraft({ ...draft, location: v })
                    }
                  />

                  <Select
                    label="Status"
                    value={draft.status}
                    onChange={v =>
                      setDraft({ ...draft, status: v })
                    }
                    options={[
                      'Available',
                      'In Use',
                      'Maintenance',
                      'Retired',
                    ]}
                  />
                </>
              )}

              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">
                  {error}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="btn-secondary"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void saveRecord()}
                disabled={saving}
                className="btn-primary"
              >
                {saving
                  ? 'Saving...'
                  : editing
                    ? 'Save Changes'
                    : 'Save Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({
  title,
  value,
  detail,
  icon,
  color,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
  color: 'teal' | 'indigo' | 'green' | 'amber' | 'red';
}) {
  const styles = {
    teal: 'bg-teal-50 text-teal-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  };

  return (
    <div className="stat-card flex min-w-0 items-center gap-3">
      <div className={`rounded-xl p-3 ${styles[color]}`}>
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

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  wide = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  wide?: boolean;
}) {
  return (
    <label
      className={`flex flex-col gap-1.5 ${
        wide ? 'sm:col-span-2' : ''
      }`}
    >
      <span className="text-xs font-bold text-slate-700">
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={event =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        min={type === 'number' ? 0 : undefined}
        step={type === 'number' ? 'any' : undefined}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-slate-700">
        {label}
      </span>

      <select
        value={value}
        onChange={event =>
          onChange(event.target.value)
        }
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500"
      >
        {options.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Status({ value }: { value: string }) {
  const color =
    value === 'Received' || value === 'Available'
      ? 'bg-emerald-50 text-emerald-700'
      : value === 'Committed' || value === 'In Use'
        ? 'bg-teal-50 text-teal-700'
        : value === 'Applied' || value === 'Maintenance'
          ? 'bg-amber-50 text-amber-700'
          : value === 'Retired'
            ? 'bg-slate-100 text-slate-600'
            : 'bg-blue-50 text-blue-700';

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${color}`}
    >
      {value}
    </span>
  );
}

function Actions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <td>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-teal-50 hover:text-teal-700"
          title="Edit"
        >
          <Pencil size={15} />
        </button>

        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
          title="Delete"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </td>
  );
}

function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="p-8 text-center">
      <Package
        size={26}
        className="mx-auto mb-2 text-slate-300"
      />

      <h3 className="text-sm font-bold text-slate-700">
        {title}
      </h3>

      <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
        {message}
      </p>
    </div>
  );
}
