import { useEffect, useState } from 'react';
import { CalendarCheck, Check, Plus, X, AlertCircle, CheckCircle2, RefreshCw, Clock } from 'lucide-react';
import { Avatar, DataTable, FilterBar, Modal, SelectField, StatusBadge, TextAreaField, TextField, ACCENT, type Column } from '../../../components/people';
import { peopleApi, type StaffProfile, type StaffAttendanceRecord, type StaffLeaveApplication } from '../../../services/peopleApi';

interface Props {
  employees: StaffProfile[];
  onRefreshStats?: () => void;
}

export default function AttendanceTab({ employees, onRefreshStats }: Props) {
  const [attendanceRecords, setAttendanceRecords] = useState<StaffAttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<StaffLeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Mark Attendance Modal
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [attendanceStaffId, setAttendanceStaffId] = useState(employees[0]?.id || '');
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceStatus, setAttendanceStatus] = useState<StaffAttendanceRecord['status']>('Present');
  const [attendanceNotes, setAttendanceNotes] = useState('');
  const [attError, setAttError] = useState('');
  const [attSaving, setAttSaving] = useState(false);

  // Submit Leave Modal
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveStaffId, setLeaveStaffId] = useState(employees[0]?.id || '');
  const [leaveType, setLeaveType] = useState('Casual');
  const [leaveStartsOn, setLeaveStartsOn] = useState('');
  const [leaveEndsOn, setLeaveEndsOn] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveError, setLeaveError] = useState('');
  const [leaveSaving, setLeaveSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [attRes, leavesRes] = await Promise.all([
        peopleApi.getStaffAttendance({ limit: 100 }),
        peopleApi.getStaffLeaves({ limit: 100 }),
      ]);
      setAttendanceRecords(attRes.items);
      setLeaves(leavesRes.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load attendance and leave records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const showNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleMarkAttendance = async () => {
    setAttError('');
    if (!attendanceStaffId) {
      setAttError('Please select an employee.');
      return;
    }
    if (!attendanceDate) {
      setAttError('Date is required.');
      return;
    }

    // Duplicate check on frontend
    const existing = attendanceRecords.find(
      r => r.staffId === attendanceStaffId && r.attendanceDate === attendanceDate
    );
    if (existing) {
      setAttError(`Attendance for this employee on ${attendanceDate} has already been recorded (${existing.status}). Update the record instead.`);
      return;
    }

    setAttSaving(true);
    try {
      const created = await peopleApi.recordStaffAttendance({
        staffId: attendanceStaffId,
        attendanceDate,
        status: attendanceStatus,
        notes: attendanceNotes.trim(),
      });
      setAttendanceRecords(prev => [created, ...prev]);
      setAttendanceOpen(false);
      setAttendanceNotes('');
      showNotice(`Attendance recorded successfully for ${attendanceDate}.`);
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      setAttError(err?.message || 'Failed to record attendance in database.');
    } finally {
      setAttSaving(false);
    }
  };

  const handleSubmitLeave = async () => {
    setLeaveError('');
    if (!leaveStaffId) {
      setLeaveError('Please select an employee.');
      return;
    }
    if (!leaveStartsOn || !leaveEndsOn) {
      setLeaveError('Start date and end date are both required.');
      return;
    }
    if (leaveEndsOn < leaveStartsOn) {
      setLeaveError('End date cannot be earlier than start date.');
      return;
    }
    if (!leaveReason.trim()) {
      setLeaveError('Reason for leave is required.');
      return;
    }

    // Overlap check with existing approved or pending leaves
    const overlapping = leaves.find(
      l =>
        l.staffId === leaveStaffId &&
        l.status !== 'Rejected' &&
        l.status !== 'Cancelled' &&
        ((leaveStartsOn >= l.startsOn && leaveStartsOn <= l.endsOn) ||
          (leaveEndsOn >= l.startsOn && leaveEndsOn <= l.endsOn) ||
          (leaveStartsOn <= l.startsOn && leaveEndsOn >= l.endsOn))
    );
    if (overlapping) {
      setLeaveError(`An overlapping ${overlapping.leaveType} leave request (${overlapping.startsOn} to ${overlapping.endsOn}) already exists for this employee.`);
      return;
    }

    const startD = new Date(leaveStartsOn);
    const endD = new Date(leaveEndsOn);
    const diffDays = Math.max(1, Math.round((endD.getTime() - startD.getTime()) / (1000 * 3600 * 24)) + 1);

    setLeaveSaving(true);
    try {
      const created = await peopleApi.submitStaffLeave({
        staffId: leaveStaffId,
        leaveType,
        startsOn: leaveStartsOn,
        endsOn: leaveEndsOn,
        reason: leaveReason.trim(),
        status: 'Pending',
        daysCount: diffDays,
      });

      setLeaves(prev => [created, ...prev]);
      setLeaveOpen(false);
      setLeaveReason('');
      setLeaveStartsOn('');
      setLeaveEndsOn('');
      showNotice(`Leave request submitted (${diffDays} days). Pending HR approval.`);
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      setLeaveError(err?.message || 'Failed to submit leave request.');
    } finally {
      setLeaveSaving(false);
    }
  };

  const handleLeaveDecision = async (leaveId: string, decision: 'Approved' | 'Rejected') => {
    try {
      const updated = await peopleApi.updateStaffLeave(leaveId, {
        status: decision,
        decisionNotes: `Marked ${decision} by HR on ${new Date().toLocaleDateString()}`,
        reviewedAt: new Date().toISOString(),
      });
      setLeaves(prev => prev.map(l => (l.id === leaveId ? updated : l)));
      showNotice(`Leave request marked as ${decision}.`);
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      alert(err?.message || 'Failed to update leave request.');
    }
  };

  const staffMap = new Map(employees.map(e => [e.id, e]));

  const filteredAttendance = attendanceRecords.filter(r => {
    const staff = staffMap.get(r.staffId);
    const matchName = (staff?.fullName || '').toLowerCase().includes(search.toLowerCase());
    const matchDate = !dateFilter || r.attendanceDate === dateFilter;
    return matchName && matchDate;
  });

  const attendanceCols: Column<StaffAttendanceRecord>[] = [
    {
      header: 'Employee',
      render: r => {
        const staff = staffMap.get(r.staffId);
        return (
          <div className="flex items-center gap-2">
            <Avatar name={staff?.fullName || 'Staff'} color={ACCENT.hr} size={28} />
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-100">{staff?.fullName || r.staffId}</div>
              <div className="text-[10px] text-slate-400">{staff?.employeeCode}</div>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Attendance Date',
      render: r => <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{r.attendanceDate}</span>,
    },
    {
      header: 'Status',
      render: r => <StatusBadge status={r.status} />,
    },
    {
      header: 'Notes / Remarks',
      render: r => <span className="text-xs text-slate-500">{r.notes || '—'}</span>,
    },
  ];

  const leaveCols: Column<StaffLeaveApplication>[] = [
    {
      header: 'Employee',
      render: l => {
        const staff = staffMap.get(l.staffId);
        return (
          <div className="flex items-center gap-2">
            <Avatar name={staff?.fullName || 'Staff'} color={ACCENT.hr} size={28} />
            <span className="font-semibold text-slate-800 dark:text-slate-100">{staff?.fullName || l.staffId}</span>
          </div>
        );
      },
    },
    {
      header: 'Leave Type',
      render: l => <span className="badge badge-teal font-medium">{l.leaveType}</span>,
    },
    {
      header: 'Duration',
      render: l => (
        <span className="text-xs text-slate-600 dark:text-slate-300">
          {l.startsOn} &rarr; {l.endsOn} ({l.daysCount ?? 1}d)
        </span>
      ),
    },
    {
      header: 'Reason',
      render: l => <span className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 italic">{l.reason}</span>,
    },
    {
      header: 'Status',
      render: l => <StatusBadge status={l.status} />,
    },
    {
      header: 'Action',
      render: l =>
        l.status === 'Pending' ? (
          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            <button
              className="p-1 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-colors"
              title="Approve Leave"
              onClick={() => handleLeaveDecision(l.id, 'Approved')}
            >
              <Check size={14} />
            </button>
            <button
              className="p-1 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors"
              title="Reject Leave"
              onClick={() => handleLeaveDecision(l.id, 'Rejected')}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
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
          <button onClick={fetchData} className="btn-secondary text-xs py-1 px-2.5">Retry</button>
        </div>
      )}

      {/* Leave Requests Card */}
      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="card-title">Leave Applications ({leaves.length})</h2>
            <span className="badge badge-yellow">{leaves.filter(l => l.status === 'Pending').length} Pending</span>
          </div>
          <button className="btn-primary text-xs py-1.5" onClick={() => setLeaveOpen(true)}>
            <Plus size={13} /> Submit Leave Request
          </button>
        </div>
        <DataTable
          columns={leaveCols}
          rows={leaves}
          rowKey={l => l.id}
          emptyTitle="No leave applications recorded"
        />
      </div>

      {/* Attendance Log Card */}
      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <div>
            <h2 className="card-title">Attendance Log ({filteredAttendance.length})</h2>
            <p className="text-xs text-slate-500 mt-0.5">Persisted employee daily attendance</p>
          </div>
          <button className="btn-primary text-xs py-1.5" onClick={() => setAttendanceOpen(true)}>
            <CalendarCheck size={14} /> Record Attendance
          </button>
        </div>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Filter by employee name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-input text-xs py-1.5"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Date:</span>
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="form-input text-xs py-1 w-36"
            />
            {dateFilter && (
              <button onClick={() => setDateFilter('')} className="text-teal-600 font-semibold hover:underline">
                Clear
              </button>
            )}
          </div>
        </div>
        <DataTable
          columns={attendanceCols}
          rows={filteredAttendance}
          rowKey={r => r.id}
          emptyTitle="No attendance records match your filter"
        />
      </div>

      {/* Record Attendance Modal */}
      <Modal
        open={attendanceOpen}
        onClose={() => setAttendanceOpen(false)}
        title="Record Employee Attendance"
        submitLabel={attSaving ? 'Saving...' : 'Save Attendance'}
        onSubmit={handleMarkAttendance}
      >
        {attError && (
          <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs mb-3 flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{attError}</span>
          </div>
        )}
        <SelectField
          label="Select Employee *"
          value={employees.find(e => e.id === attendanceStaffId)?.fullName || ''}
          onChange={v => {
            const found = employees.find(e => e.fullName === v);
            setAttendanceStaffId(found ? found.id : '');
          }}
          options={employees.map(e => e.fullName)}
          wide
        />
        <TextField
          label="Attendance Date *"
          type="date"
          value={attendanceDate}
          onChange={setAttendanceDate}
          required
        />
        <SelectField
          label="Status *"
          value={attendanceStatus}
          onChange={v => setAttendanceStatus(v as any)}
          options={['Present', 'Absent', 'Late', 'Leave', 'Holiday']}
        />
        <TextField
          label="Notes / Remarks"
          value={attendanceNotes}
          onChange={setAttendanceNotes}
          placeholder="e.g. Field visit, Half-day morning"
          wide
        />
      </Modal>

      {/* Submit Leave Modal */}
      <Modal
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title="Submit Leave Request"
        submitLabel={leaveSaving ? 'Submitting...' : 'Submit Leave'}
        onSubmit={handleSubmitLeave}
      >
        {leaveError && (
          <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs mb-3 flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{leaveError}</span>
          </div>
        )}
        <SelectField
          label="Select Employee *"
          value={employees.find(e => e.id === leaveStaffId)?.fullName || ''}
          onChange={v => {
            const found = employees.find(e => e.fullName === v);
            setLeaveStaffId(found ? found.id : '');
          }}
          options={employees.map(e => e.fullName)}
          wide
        />
        <SelectField
          label="Leave Type"
          value={leaveType}
          onChange={setLeaveType}
          options={['Casual', 'Annual', 'Medical', 'Sick', 'Maternity', 'Paternity', 'Unpaid', 'Other']}
        />
        <TextField
          label="From Date *"
          type="date"
          value={leaveStartsOn}
          onChange={setLeaveStartsOn}
          required
        />
        <TextField
          label="To Date *"
          type="date"
          value={leaveEndsOn}
          onChange={setLeaveEndsOn}
          required
        />
        <TextAreaField
          label="Reason for Leave *"
          value={leaveReason}
          onChange={setLeaveReason}
          placeholder="State the reason for leave..."
        />
      </Modal>
    </div>
  );
}
