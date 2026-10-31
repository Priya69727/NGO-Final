import { useEffect, useState } from 'react';
import { DollarSign, Plus, CheckCircle2, AlertCircle, RefreshCw, CreditCard, ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react';
import { Avatar, DataTable, FilterBar, Modal, SelectField, StatusBadge, TextField, ACCENT, type Column } from '../../../components/people';
import { peopleApi, type StaffProfile, type StaffPayrollRecord } from '../../../services/peopleApi';

interface Props {
  employees: StaffProfile[];
  onRefreshStats?: () => void;
}

const PAYMENT_STATUSES: StaffPayrollRecord['paymentStatus'][] = ['Pending', 'Processing', 'Paid', 'On Hold'];

export default function PayrollTab({ employees, onRefreshStats }: Props) {
  const [payrollRecords, setPayrollRecords] = useState<StaffPayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [periodFilter, setPeriodFilter] = useState('All');

  // Add Modal
  const [addOpen, setAddOpen] = useState(false);
  const [staffId, setStaffId] = useState(employees[0]?.id || '');
  const [period, setPeriod] = useState('2026-03');
  const [basic, setBasic] = useState('35000');
  const [allowances, setAllowances] = useState('5000');
  const [deductions, setDeductions] = useState('2000');
  const [paymentStatus, setPaymentStatus] = useState<StaffPayrollRecord['paymentStatus']>('Paid');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [transRef, setTransRef] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchPayroll = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await peopleApi.getStaffPayroll({ limit: 100 });
      setPayrollRecords(res.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load payroll records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPayroll();
  }, []);

  const showNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleEmployeeChange = (selectedName: string) => {
    const emp = employees.find(e => e.fullName === selectedName);
    if (emp) {
      setStaffId(emp.id);
      if (emp.salary) {
        const base = Number(emp.salary);
        setBasic(String(Math.round(base * 0.75)));
        setAllowances(String(Math.round(base * 0.25)));
        setDeductions(String(Math.round(base * 0.05)));
      }
    }
  };

  const netCalculated = Math.max(0, (Number(basic) || 0) + (Number(allowances) || 0) - (Number(deductions) || 0));

  const handleAddSubmit = async () => {
    setFormError('');
    if (!staffId) {
      setFormError('Please select an employee.');
      return;
    }
    if (!period.trim()) {
      setFormError('Payroll period is required.');
      return;
    }
    if (Number(basic) < 0 || Number(allowances) < 0 || Number(deductions) < 0) {
      setFormError('Financial amounts cannot be negative.');
      return;
    }

    setSaving(true);
    try {
      const created = await peopleApi.createStaffPayroll({
        staffId,
        payrollPeriod: period.trim(),
        basicSalary: Number(basic) || 0,
        allowances: Number(allowances) || 0,
        deductions: Number(deductions) || 0,
        netSalary: netCalculated,
        paymentStatus,
        paymentDate: paymentDate || undefined,
        paymentMethod,
        transactionReference: transRef.trim() || undefined,
      });

      setPayrollRecords(prev => [created, ...prev]);
      setAddOpen(false);
      showNotice(`Payroll record for period ${period} created successfully.`);
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to record payroll entry.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (recordId: string, nextStatus: StaffPayrollRecord['paymentStatus']) => {
    try {
      const updated = await peopleApi.updateStaffPayroll(recordId, {
        paymentStatus: nextStatus,
        paymentDate: nextStatus === 'Paid' ? new Date().toISOString().slice(0, 10) : undefined,
      });
      setPayrollRecords(prev => prev.map(p => (p.id === recordId ? updated : p)));
      showNotice(`Payment status updated to "${nextStatus}".`);
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      alert(err?.message || 'Failed to update payment status.');
    }
  };

  const staffMap = new Map(employees.map(e => [e.id, e]));

  const totalDisbursed = payrollRecords
    .filter(r => r.paymentStatus === 'Paid')
    .reduce((sum, r) => sum + Number(r.netSalary), 0);

  const pendingDisbursement = payrollRecords
    .filter(r => r.paymentStatus === 'Pending' || r.paymentStatus === 'Processing')
    .reduce((sum, r) => sum + Number(r.netSalary), 0);

  const periods = Array.from(new Set(payrollRecords.map(r => r.payrollPeriod))).sort().reverse();

  const filteredRecords = payrollRecords.filter(r => {
    const staff = staffMap.get(r.staffId);
    const term = search.toLowerCase();
    const matchSearch =
      (staff?.fullName || '').toLowerCase().includes(term) ||
      (staff?.employeeCode || '').toLowerCase().includes(term) ||
      r.payrollPeriod.toLowerCase().includes(term);
    const matchStatus = statusFilter === 'All' || r.paymentStatus === statusFilter;
    const matchPeriod = periodFilter === 'All' || r.payrollPeriod === periodFilter;
    return matchSearch && matchStatus && matchPeriod;
  });

  const columns: Column<StaffPayrollRecord>[] = [
    {
      header: 'Employee',
      render: r => {
        const staff = staffMap.get(r.staffId);
        return (
          <div className="flex items-center gap-2">
            <Avatar name={staff?.fullName || 'Staff'} color={ACCENT.hr} size={28} />
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{staff?.fullName || r.staffId}</span>
              <div className="text-[10px] text-slate-400">{staff?.employeeCode}</div>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Period',
      render: r => <span className="font-bold text-slate-700 dark:text-slate-300">{r.payrollPeriod}</span>,
    },
    {
      header: 'Basic Salary',
      render: r => <span className="text-xs">₹{Number(r.basicSalary).toLocaleString()}</span>,
    },
    {
      header: 'Allowances / Deductions',
      render: r => (
        <div className="text-xs">
          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">+₹{Number(r.allowances).toLocaleString()}</span>
          <span className="text-slate-400 mx-1">/</span>
          <span className="text-rose-600 font-semibold">-₹{Number(r.deductions).toLocaleString()}</span>
        </div>
      ),
    },
    {
      header: 'Net Disbursed',
      render: r => (
        <span className="font-extrabold text-teal-800 dark:text-teal-300">
          ₹{Number(r.netSalary).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Payment Status',
      render: r => <StatusBadge status={r.paymentStatus} />,
    },
    {
      header: 'Action',
      render: r => (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          {r.paymentStatus !== 'Paid' ? (
            <button
              className="btn-primary text-xs py-1 px-2.5"
              onClick={() => handleStatusChange(r.id, 'Paid')}
            >
              Mark Paid
            </button>
          ) : (
            <span className="text-[11px] text-slate-400">{r.paymentDate || 'Paid'}</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {notification && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-emerald-800 dark:text-emerald-200 text-sm">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>{notification}</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between text-rose-800 dark:text-rose-200 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={fetchPayroll} className="btn-secondary text-xs py-1 px-2.5">Retry</button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="rounded-xl p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
            <Wallet size={24} />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Total Paid Out</div>
            <div className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">
              ₹{totalDisbursed.toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-600 mt-0.5 font-semibold">Processed payroll disbursements</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="rounded-xl p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
            <CreditCard size={24} />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Pending Disbursement</div>
            <div className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">
              ₹{pendingDisbursement.toLocaleString()}
            </div>
            <div className="text-[11px] text-amber-600 mt-0.5 font-semibold">Awaiting finance approval / payout</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="rounded-xl p-3 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300">
            <DollarSign size={24} />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Staff on Payroll</div>
            <div className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">
              {employees.filter(e => e.salary && Number(e.salary) > 0).length} / {employees.length}
            </div>
            <div className="text-[11px] text-teal-600 mt-0.5 font-semibold">Active salaried workforce</div>
          </div>
        </div>
      </div>

      <FilterBar
        search={search}
        onSearch={setSearch}
        placeholder="Search payroll by employee or code…"
        filters={[
          {
            label: 'Status',
            value: statusFilter,
            options: ['All', ...PAYMENT_STATUSES],
            onChange: setStatusFilter,
          },
          {
            label: 'Period',
            value: periodFilter,
            options: ['All', ...periods],
            onChange: setPeriodFilter,
          },
        ]}
      />

      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="card-title">Staff Salary & Payroll Records ({filteredRecords.length})</h2>
            {loading && <RefreshCw size={14} className="animate-spin text-teal-600" />}
          </div>
          <button className="btn-primary text-xs py-1.5" onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Process Salary Entry
          </button>
        </div>
        <DataTable
          columns={columns}
          rows={filteredRecords}
          rowKey={r => r.id}
          emptyTitle="No payroll records match filter"
        />
      </div>

      {/* Add Payroll Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Generate Staff Salary Entry"
        submitLabel={saving ? 'Processing...' : 'Save Payroll Record'}
        onSubmit={handleAddSubmit}
      >
        {formError && (
          <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs mb-3 flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{formError}</span>
          </div>
        )}
        <SelectField
          label="Select Employee *"
          value={employees.find(e => e.id === staffId)?.fullName || ''}
          onChange={handleEmployeeChange}
          options={employees.map(e => e.fullName)}
          wide
        />
        <TextField
          label="Payroll Period (e.g. 2026-03) *"
          value={period}
          onChange={setPeriod}
          placeholder="YYYY-MM"
          required
        />
        <TextField
          label="Basic Salary (₹) *"
          type="number"
          value={basic}
          onChange={setBasic}
          required
        />
        <TextField
          label="Allowances (₹)"
          type="number"
          value={allowances}
          onChange={setAllowances}
          placeholder="HRA, Transport, etc."
        />
        <TextField
          label="Deductions (₹)"
          type="number"
          value={deductions}
          onChange={setDeductions}
          placeholder="PF, TDS, etc."
        />
        <div className="sm:col-span-2 p-3 bg-teal-50 dark:bg-teal-950/40 rounded-lg border border-teal-200 dark:border-teal-800 flex justify-between items-center text-xs">
          <span className="font-semibold text-teal-900 dark:text-teal-200">Net Calculated Salary:</span>
          <span className="text-base font-extrabold text-teal-800 dark:text-teal-300">
            ₹{netCalculated.toLocaleString()}
          </span>
        </div>
        <SelectField
          label="Payment Status"
          value={paymentStatus}
          onChange={v => setPaymentStatus(v as any)}
          options={PAYMENT_STATUSES}
        />
        <SelectField
          label="Payment Method"
          value={paymentMethod}
          onChange={setPaymentMethod}
          options={['Bank Transfer', 'Cheque', 'UPI / IMPS', 'Direct Deposit', 'Cash']}
        />
        <TextField
          label="Payment Date"
          type="date"
          value={paymentDate}
          onChange={setPaymentDate}
        />
        <TextField
          label="Transaction / Reference ID"
          value={transRef}
          onChange={setTransRef}
          placeholder="e.g. TXN98765432"
        />
      </Modal>
    </div>
  );
}
