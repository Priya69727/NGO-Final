import { useEffect, useState } from 'react';
import { Plus, Eye, Edit3, CheckCircle2, AlertCircle, RefreshCw, DollarSign, Calendar, Award } from 'lucide-react';
import { Avatar, DataTable, DetailDrawer, FilterBar, InfoGrid, Modal, PhoneField, SectionTitle, SelectField, StatusBadge, SubTabs, TextField, ACCENT, type Column } from '../../../components/people';
import { peopleApi, type StaffProfile, type Department, type StaffLeaveApplication, type StaffPerformanceReview, type StaffPayrollRecord } from '../../../services/peopleApi';

interface Props {
  departments: Department[];
  addOpen?: boolean;
  setAddOpen?: (b: boolean) => void;
  onRefreshStats?: () => void;
}

const SUB_TABS = ['Personal Details', 'Employment Info', 'Qualifications', 'Leave History', 'Performance', 'Salary & Payroll'];

const blankForm = {
  fullName: '',
  email: '',
  phone: '',
  jobTitle: '',
  departmentId: '',
  employmentType: 'Full-time',
  salary: '',
  status: 'Active' as const,
  hiredOn: new Date().toISOString().slice(0, 10),
  gender: 'Female',
  dateOfBirth: '',
  address: '',
  emergencyContact: '',
  degree: '',
  institution: '',
};

export default function EmployeesTab({ departments, addOpen = false, setAddOpen, onRefreshStats }: Props) {
  const [employees, setEmployees] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
  const [subTab, setSubTab] = useState(SUB_TABS[0]);

  // Drawer-loaded sub-records
  const [staffLeaves, setStaffLeaves] = useState<StaffLeaveApplication[]>([]);
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformanceReview[]>([]);
  const [staffPayroll, setStaffPayroll] = useState<StaffPayrollRecord[]>([]);
  const [subLoading, setSubLoading] = useState(false);

  // Add Modal state
  const [localAddOpen, setLocalAddOpen] = useState(false);
  const isAddOpen = setAddOpen ? addOpen : localAddOpen;
  const setIsAddOpen = setAddOpen || setLocalAddOpen;
  const [form, setForm] = useState(blankForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit Modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [editError, setEditError] = useState('');

  const fetchEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await peopleApi.getEmployees();
      setEmployees(res.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch employees.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchEmployees();
  }, []);

  const showNotification = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3500);
  };

  // When an employee is selected, fetch their leaves, performance reviews, and payroll history
  const openDetail = async (staff: StaffProfile) => {
    setSelectedStaff(staff);
    setSubTab(SUB_TABS[0]);
    setSubLoading(true);
    try {
      const [leavesRes, perfRes, payrollRes] = await Promise.all([
        peopleApi.getStaffLeaves({ staffId: staff.id }).catch(() => ({ items: [] })),
        peopleApi.getStaffPerformance({ staffId: staff.id }).catch(() => ({ items: [] })),
        peopleApi.getStaffPayroll({ staffId: staff.id }).catch(() => ({ items: [] })),
      ]);
      setStaffLeaves(leavesRes.items);
      setStaffPerformance(perfRes.items);
      setStaffPayroll(payrollRes.items);
    } catch {
      // Non-blocking
    } finally {
      setSubLoading(false);
    }
  };

  // Add new employee
  const handleAddSubmit = async () => {
    setFormError('');
    if (!form.fullName.trim()) {
      setFormError('Full name is required.');
      return;
    }
    if (!form.jobTitle.trim()) {
      setFormError('Job title / designation is required.');
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (form.salary && Number(form.salary) < 0) {
      setFormError('Salary cannot be negative.');
      return;
    }

    setSaving(true);
    try {
      const nextNum =
        employees.reduce((max, employee) => {
          const match = /^EMP-(\d+)$/.exec(employee.employeeCode);
          return match ? Math.max(max, Number(match[1])) : max;
        }, 0) + 1;
      const empCode = `EMP-${String(nextNum).padStart(3, '0')}`;

      const payload: Partial<StaffProfile> = {
        employeeCode: empCode,
        fullName: form.fullName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        jobTitle: form.jobTitle.trim(),
        departmentId: form.departmentId || undefined,
        employmentType: form.employmentType,
        salary: form.salary ? Number(form.salary) : undefined,
        status: form.status,
        hiredOn: form.hiredOn || undefined,
        gender: form.gender,
        dateOfBirth: form.dateOfBirth || undefined,
        address: form.address.trim() || undefined,
        emergencyContact: form.emergencyContact.trim() || undefined,
        qualifications: form.degree ? [{ degree: form.degree, institution: form.institution }] : [],
      };

      const created = await peopleApi.createEmployee(payload);
      setEmployees(prev => [created, ...prev]);
      setForm(blankForm);
      setIsAddOpen(false);
      showNotification(`Employee ${created.fullName} (${created.employeeCode}) added successfully.`);
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save employee record.');
    } finally {
      setSaving(false);
    }
  };

  // Edit employee
  const startEdit = () => {
    if (!selectedStaff) return;
    setEditForm({
      fullName: selectedStaff.fullName,
      email: selectedStaff.email || '',
      phone: selectedStaff.phone || '',
      jobTitle: selectedStaff.jobTitle,
      departmentId: selectedStaff.departmentId || '',
      employmentType: selectedStaff.employmentType || 'Full-time',
      salary: selectedStaff.salary ? String(selectedStaff.salary) : '',
      status: selectedStaff.status,
      hiredOn: selectedStaff.hiredOn || '',
      gender: selectedStaff.gender || 'Female',
      address: selectedStaff.address || '',
      emergencyContact: selectedStaff.emergencyContact || '',
    });
    setEditError('');
    setEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!selectedStaff) return;
    setEditError('');
    if (!editForm.fullName.trim()) {
      setEditError('Full name is required.');
      return;
    }
    if (!editForm.jobTitle.trim()) {
      setEditError('Job title is required.');
      return;
    }
    if (editForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) {
      setEditError('Valid email format is required.');
      return;
    }
    if (editForm.salary && Number(editForm.salary) < 0) {
      setEditError('Salary cannot be negative.');
      return;
    }

    setSaving(true);
    try {
      const updated = await peopleApi.updateEmployee(selectedStaff.id, {
        fullName: editForm.fullName.trim(),
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
        jobTitle: editForm.jobTitle.trim(),
        departmentId: editForm.departmentId || null,
        employmentType: editForm.employmentType,
        salary: editForm.salary ? Number(editForm.salary) : null,
        status: editForm.status,
        hiredOn: editForm.hiredOn || null,
        gender: editForm.gender,
        address: editForm.address,
        emergencyContact: editForm.emergencyContact,
      });

      setEmployees(prev => prev.map(e => (e.id === updated.id ? updated : e)));
      setSelectedStaff(updated);
      setEditOpen(false);
      showNotification(`Employee ${updated.fullName} updated successfully.`);
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update employee.');
    } finally {
      setSaving(false);
    }
  };

  // Toggle status (Active / Inactive)
  const toggleStatus = async (staff: StaffProfile, newStatus: 'Active' | 'Inactive' | 'On Leave') => {
    try {
      const updated = await peopleApi.updateEmployee(staff.id, { status: newStatus });
      setEmployees(prev => prev.map(e => (e.id === updated.id ? updated : e)));
      if (selectedStaff?.id === staff.id) setSelectedStaff(updated);
      showNotification(`Status for ${staff.fullName} updated to ${newStatus}.`);
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      alert(err?.message || 'Failed to update status.');
    }
  };

  const departmentMap = new Map(departments.map(d => [d.id, d.name]));

  // Filtering
  const filteredEmployees = employees.filter(e => {
    const term = search.toLowerCase();
    const matchSearch =
      e.fullName.toLowerCase().includes(term) ||
      (e.email || '').toLowerCase().includes(term) ||
      e.employeeCode.toLowerCase().includes(term) ||
      e.jobTitle.toLowerCase().includes(term);
    const matchDept = deptFilter === 'All' || e.departmentId === deptFilter;
    const matchStatus = statusFilter === 'All' || e.status === statusFilter;
    return matchSearch && matchDept && matchStatus;
  });

  const columns: Column<StaffProfile>[] = [
    {
      header: 'Employee',
      render: e => (
        <div className="flex items-center gap-3">
          <Avatar name={e.fullName} color={ACCENT.hr} />
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-100">{e.fullName}</div>
            <div className="text-[11px] text-slate-400">
              {e.employeeCode} {e.email ? `· ${e.email}` : ''}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Department',
      render: e => e.departmentId ? departmentMap.get(e.departmentId) || e.departmentId : '—',
    },
    {
      header: 'Designation / Role',
      render: e => <span className="font-medium text-slate-700 dark:text-slate-200">{e.jobTitle}</span>,
    },
    {
      header: 'Status',
      render: e => <StatusBadge status={e.status} />,
    },
    {
      header: 'Hired Date',
      render: e => <span className="text-xs text-slate-500">{e.hiredOn || '—'}</span>,
    },
    {
      header: 'Salary',
      render: e => (
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          {e.salary ? `₹${Number(e.salary).toLocaleString()}` : '—'}
        </span>
      ),
    },
    {
      header: '',
      render: e => (
        <button
          className="p-1.5 rounded hover:bg-teal-50 dark:hover:bg-slate-800 text-slate-400 hover:text-teal-600 transition-colors"
          aria-label={`View details of ${e.fullName}`}
          onClick={ev => {
            ev.stopPropagation();
            openDetail(e);
          }}
          title="View profile"
        >
          <Eye size={15} />
        </button>
      ),
    },
  ];

  const deptOptions = [{ label: 'All Departments', value: 'All' }, ...departments.map(d => ({ label: d.name, value: d.id }))];

  return (
    <div className="flex flex-col gap-4">
      {actionSuccess && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-emerald-800 dark:text-emerald-200 text-sm">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between text-rose-800 dark:text-rose-200 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={fetchEmployees} className="btn-secondary text-xs py-1 px-2.5">
            Retry
          </button>
        </div>
      )}

      <FilterBar
        search={search}
        onSearch={setSearch}
        placeholder="Search by name, code, email, title…"
        filters={[
          {
            label: 'Departments',
            value: deptFilter,
            options: ['All', ...departments.map(d => d.name)],
            onChange: v => {
              if (v === 'All') setDeptFilter('All');
              else {
                const found = departments.find(d => d.name === v);
                setDeptFilter(found ? found.id : 'All');
              }
            },
          },
          {
            label: 'Status',
            value: statusFilter,
            options: ['All', 'Active', 'On Leave', 'Inactive'],
            onChange: setStatusFilter,
          },
        ]}
      />

      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="card-title">Employee Directory ({filteredEmployees.length})</h2>
            {loading && <RefreshCw size={14} className="animate-spin text-teal-600" />}
          </div>
          <button className="btn-primary" onClick={() => setIsAddOpen(true)}>
            <Plus size={14} /> Add Employee
          </button>
        </div>
        <DataTable
          columns={columns}
          rows={filteredEmployees}
          rowKey={e => e.id}
          onRowClick={openDetail}
          emptyTitle="No employee records found"
        />
      </div>

      {/* Add Employee Modal */}
      <Modal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add New Employee"
        submitLabel={saving ? 'Saving...' : 'Add Employee'}
        onSubmit={handleAddSubmit}
      >
        {formError && (
          <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs mb-3 flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{formError}</span>
          </div>
        )}
        <TextField
          label="Full Name"
          value={form.fullName}
          onChange={v => setForm(f => ({ ...f, fullName: v }))}
          required
          wide
        />
        <TextField
          label="Designation / Role"
          value={form.jobTitle}
          onChange={v => setForm(f => ({ ...f, jobTitle: v }))}
          placeholder="e.g. Program Coordinator"
          required
        />
        <SelectField
          label="Department"
          value={form.departmentId}
          onChange={v => setForm(f => ({ ...f, departmentId: v }))}
          options={departments.map(d => ({ label: d.name, value: d.id }))}
        />
        <TextField
          label="Email Address"
          type="email"
          value={form.email}
          onChange={v => setForm(f => ({ ...f, email: v }))}
        />
        <PhoneField
          label="Phone Number"
          value={form.phone}
          onChange={v => setForm(f => ({ ...f, phone: v }))}
        />
        <SelectField
          label="Employment Type"
          value={form.employmentType}
          onChange={v => setForm(f => ({ ...f, employmentType: v }))}
          options={['Full-time', 'Part-time', 'Contract', 'Consultant']}
        />
        <TextField
          label="Monthly Salary (₹)"
          type="number"
          value={form.salary}
          onChange={v => setForm(f => ({ ...f, salary: v }))}
          placeholder="e.g. 40000"
        />
        <TextField
          label="Hired / Joining Date"
          type="date"
          value={form.hiredOn}
          onChange={v => setForm(f => ({ ...f, hiredOn: v }))}
        />
        <SelectField
          label="Status"
          value={form.status}
          onChange={v => setForm(f => ({ ...f, status: v as any }))}
          options={['Active', 'On Leave', 'Inactive']}
        />
        <SelectField
          label="Gender"
          value={form.gender}
          onChange={v => setForm(f => ({ ...f, gender: v }))}
          options={['Female', 'Male', 'Other']}
        />
        <TextField
          label="Date of Birth"
          type="date"
          value={form.dateOfBirth}
          onChange={v => setForm(f => ({ ...f, dateOfBirth: v }))}
        />
        <TextField
          label="Address"
          value={form.address}
          onChange={v => setForm(f => ({ ...f, address: v }))}
          wide
        />
        <TextField
          label="Emergency Contact"
          value={form.emergencyContact}
          onChange={v => setForm(f => ({ ...f, emergencyContact: v }))}
        />
        <TextField
          label="Educational Qualification"
          value={form.degree}
          onChange={v => setForm(f => ({ ...f, degree: v }))}
          placeholder="e.g. B.Tech / MBA / MSW"
        />
        <TextField
          label="Institution / University"
          value={form.institution}
          onChange={v => setForm(f => ({ ...f, institution: v }))}
          placeholder="e.g. Pune University"
          wide
        />
      </Modal>

      {/* Edit Employee Modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Employee Details"
        submitLabel={saving ? 'Updating...' : 'Save Changes'}
        onSubmit={handleEditSubmit}
      >
        {editError && (
          <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs mb-3 flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{editError}</span>
          </div>
        )}
        <TextField
          label="Full Name"
          value={editForm.fullName || ''}
          onChange={v => setEditForm((f: any) => ({ ...f, fullName: v }))}
          required
          wide
        />
        <TextField
          label="Designation / Role"
          value={editForm.jobTitle || ''}
          onChange={v => setEditForm((f: any) => ({ ...f, jobTitle: v }))}
          required
        />
        <SelectField
          label="Department"
          value={editForm.departmentId || ''}
          onChange={v => setEditForm((f: any) => ({ ...f, departmentId: v }))}
          options={departments.map(d => ({ label: d.name, value: d.id }))}
        />
        <TextField
          label="Email Address"
          type="email"
          value={editForm.email || ''}
          onChange={v => setEditForm((f: any) => ({ ...f, email: v }))}
        />
        <PhoneField
          label="Phone Number"
          value={editForm.phone || ''}
          onChange={v => setEditForm((f: any) => ({ ...f, phone: v }))}
        />
        <SelectField
          label="Employment Type"
          value={editForm.employmentType || 'Full-time'}
          onChange={v => setEditForm((f: any) => ({ ...f, employmentType: v }))}
          options={['Full-time', 'Part-time', 'Contract', 'Consultant']}
        />
        <TextField
          label="Monthly Salary (₹)"
          type="number"
          value={editForm.salary || ''}
          onChange={v => setEditForm((f: any) => ({ ...f, salary: v }))}
        />
        <SelectField
          label="Status"
          value={editForm.status || 'Active'}
          onChange={v => setEditForm((f: any) => ({ ...f, status: v }))}
          options={['Active', 'On Leave', 'Inactive']}
        />
        <TextField
          label="Address"
          value={editForm.address || ''}
          onChange={v => setEditForm((f: any) => ({ ...f, address: v }))}
          wide
        />
        <TextField
          label="Emergency Contact"
          value={editForm.emergencyContact || ''}
          onChange={v => setEditForm((f: any) => ({ ...f, emergencyContact: v }))}
        />
      </Modal>

      {/* Employee Detail Drawer */}
      <DetailDrawer
        open={!!selectedStaff}
        onClose={() => setSelectedStaff(null)}
        title={selectedStaff?.fullName ?? ''}
        subtitle={selectedStaff ? `${selectedStaff.employeeCode} · ${selectedStaff.jobTitle}` : ''}
        accent={ACCENT.hr}
      >
        {selectedStaff && (
          <>
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <StatusBadge status={selectedStaff.status} />
                {selectedStaff.status === 'Active' ? (
                  <button
                    onClick={() => toggleStatus(selectedStaff, 'Inactive')}
                    className="text-xs text-rose-600 hover:underline font-semibold"
                  >
                    Deactivate
                  </button>
                ) : (
                  <button
                    onClick={() => toggleStatus(selectedStaff, 'Active')}
                    className="text-xs text-emerald-600 hover:underline font-semibold"
                  >
                    Reactivate
                  </button>
                )}
              </div>
              <button className="btn-secondary text-xs flex items-center gap-1.5" onClick={startEdit}>
                <Edit3 size={13} /> Edit Profile
              </button>
            </div>

            <SubTabs tabs={SUB_TABS} active={subTab} onChange={setSubTab} accent={ACCENT.hr} />

            {subTab === 'Personal Details' && (
              <InfoGrid
                items={[
                  ['Full Name', selectedStaff.fullName],
                  ['Employee Code', selectedStaff.employeeCode],
                  ['Gender', selectedStaff.gender || '—'],
                  ['Date of Birth', selectedStaff.dateOfBirth || '—'],
                  ['Address', selectedStaff.address || '—'],
                  ['Emergency Contact', selectedStaff.emergencyContact || '—'],
                ]}
              />
            )}

            {subTab === 'Employment Info' && (
              <InfoGrid
                items={[
                  ['Job Title / Designation', selectedStaff.jobTitle],
                  ['Department', selectedStaff.departmentId ? departmentMap.get(selectedStaff.departmentId) || selectedStaff.departmentId : 'Unassigned'],
                  ['Employment Type', selectedStaff.employmentType],
                  ['Joining Date', selectedStaff.hiredOn || '—'],
                  ['Monthly Salary', selectedStaff.salary ? `₹${Number(selectedStaff.salary).toLocaleString()}` : 'Not Specified'],
                  ['Status', <StatusBadge key="st" status={selectedStaff.status} />],
                ]}
              />
            )}

            {subTab === 'Qualifications' && (
              <div className="flex flex-col gap-3">
                {Array.isArray(selectedStaff.qualifications) && selectedStaff.qualifications.length > 0 ? (
                  selectedStaff.qualifications.map((q: any, i: number) => (
                    <div key={i} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{q.degree || 'Degree/Qualification'}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{q.institution || q.college || ''} {q.skills ? `· Skills: ${Array.isArray(q.skills) ? q.skills.join(', ') : q.skills}` : ''}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No educational qualifications recorded.</p>
                )}
              </div>
            )}

            {subTab === 'Leave History' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <SectionTitle>Recorded Leaves ({staffLeaves.length})</SectionTitle>
                  {subLoading && <RefreshCw size={13} className="animate-spin text-teal-600" />}
                </div>
                {staffLeaves.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {staffLeaves.map(leave => (
                      <div key={leave.id} className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex justify-between items-start text-xs">
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                            {leave.leaveType} Leave · {leave.daysCount ?? 1} day(s)
                          </div>
                          <div className="text-slate-500 mt-1">
                            {leave.startsOn} to {leave.endsOn}
                          </div>
                          <div className="text-slate-600 dark:text-slate-400 mt-1 italic">
                            "{leave.reason}"
                          </div>
                        </div>
                        <StatusBadge status={leave.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No leave requests found for this employee.</p>
                )}
              </div>
            )}

            {subTab === 'Performance' && (
              <div className="flex flex-col gap-3">
                <SectionTitle>Performance Reviews ({staffPerformance.length})</SectionTitle>
                {staffPerformance.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {staffPerformance.map(perf => (
                      <div key={perf.id} className="p-3.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                            {perf.reviewPeriod || 'Annual'} Review · {perf.reviewedOn}
                          </span>
                          <span className="badge badge-teal font-bold">{perf.rating} / 5.0</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-1">
                          {perf.feedback}
                        </p>
                        {perf.strengths && (
                          <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                            <strong>Strengths:</strong> {perf.strengths}
                          </div>
                        )}
                        {perf.improvementAreas && (
                          <div className="text-xs text-amber-700 dark:text-amber-400">
                            <strong>Improvement Areas:</strong> {perf.improvementAreas}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No performance evaluations recorded yet.</p>
                )}
              </div>
            )}

            {subTab === 'Salary & Payroll' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <SectionTitle>Payroll History ({staffPayroll.length})</SectionTitle>
                  <span className="text-xs text-slate-500">
                    Base Salary: <strong>₹{selectedStaff.salary ? Number(selectedStaff.salary).toLocaleString() : '0'}</strong>
                  </span>
                </div>
                {staffPayroll.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {staffPayroll.map(pay => (
                      <div key={pay.id} className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                            Period: {pay.payrollPeriod}
                          </div>
                          <div className="text-slate-500 mt-0.5">
                            Basic: ₹{Number(pay.basicSalary).toLocaleString()} | Allowances: +₹{Number(pay.allowances).toLocaleString()} | Deductions: -₹{Number(pay.deductions).toLocaleString()}
                          </div>
                          {pay.paymentDate && <div className="text-slate-400 mt-0.5">Paid on: {pay.paymentDate}</div>}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-extrabold text-teal-700 dark:text-teal-400">
                            ₹{Number(pay.netSalary).toLocaleString()}
                          </div>
                          <StatusBadge status={pay.paymentStatus} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No payroll disbursements recorded for this employee.</p>
                )}
              </div>
            )}
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
