import { useEffect, useState } from 'react';
import { Avatar, DataTable, DetailDrawer, FilterBar, InfoGrid, ProgressBar, SelectField, StatusBadge, TextField, TextAreaField, ACCENT, type Column } from '../../../components/people';
import { peopleApi, type InternProfile, type Department, type StaffProfile } from '../../../services/peopleApi';
import { RefreshCw, AlertCircle, CheckCircle2, UserCheck, Edit3 } from 'lucide-react';

interface Props {
  departments: Department[];
  mentors: StaffProfile[];
  onRefreshStats?: () => void;
}

export default function InternListTab({ departments, mentors, onRefreshStats }: Props) {
  const [interns, setInterns] = useState<InternProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const [selectedIntern, setSelectedIntern] = useState<InternProfile | null>(null);
  const [editingMentor, setEditingMentor] = useState('');
  const [editingStatus, setEditingStatus] = useState<InternProfile['status']>('Active');
  const [editingProgress, setEditingProgress] = useState('0');
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchInterns = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await peopleApi.getInternProfiles({ limit: 100 });
      setInterns(res.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load intern directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchInterns();
  }, []);

  const deptMap = new Map(departments.map(d => [d.id, d.name]));
  const mentorMap = new Map(mentors.map(m => [m.id, m.fullName]));

  const handleOpenDrawer = (intern: InternProfile) => {
    setSelectedIntern(intern);
    setEditingMentor(intern.mentorStaffId || '');
    setEditingStatus(intern.status);
    setEditingProgress(String(intern.progress ?? 0));
  };

  const handleSaveProfileUpdates = async () => {
    if (!selectedIntern) return;
    setSavingEdit(true);
    try {
      const progressNum = Math.min(100, Math.max(0, parseInt(editingProgress, 10) || 0));
      await peopleApi.updateInternProfile(selectedIntern.id, {
        mentorStaffId: editingMentor || undefined,
        status: editingStatus,
        progress: progressNum,
      });

      setNotification(`Updated profile for ${selectedIntern.fullName || selectedIntern.internCode}`);
      await fetchInterns();
      setSelectedIntern(prev => prev ? {
        ...prev,
        mentorStaffId: editingMentor || undefined,
        status: editingStatus,
        progress: progressNum,
      } : null);
      onRefreshStats?.();
    } catch (err: any) {
      setError(err?.message || 'Failed to update intern profile.');
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredInterns = interns.filter(i => {
    const mentorName = (i.mentorStaffId && mentorMap.get(i.mentorStaffId)) || '';
    const matchesSearch =
      (i.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
      (i.internCode || '').toLowerCase().includes(search.toLowerCase()) ||
      mentorName.toLowerCase().includes(search.toLowerCase()) ||
      (i.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (i.college || '').toLowerCase().includes(search.toLowerCase());

    const matchesDept = deptFilter === 'All' || i.departmentId === deptFilter;
    const matchesStatus = statusFilter === 'All' || i.status === statusFilter;
    return matchesSearch && matchesDept && matchesStatus;
  });

  const cols: Column<InternProfile>[] = [
    {
      header: 'Intern',
      render: i => (
        <div className="flex items-center gap-3">
          <Avatar name={i.fullName || i.internCode || 'Intern'} color={ACCENT.intern} size={36} />
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-100">{i.fullName || 'Intern'}</div>
            <div className="text-xs font-mono text-slate-400">{i.internCode}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Department',
      render: i => (
        <span className="text-sm text-slate-700 dark:text-slate-300">
          {(i.departmentId && deptMap.get(i.departmentId)) || 'Unassigned'}
        </span>
      ),
    },
    {
      header: 'Mentor',
      render: i => (
        <span className="text-sm text-slate-600 dark:text-slate-300">
          {(i.mentorStaffId && mentorMap.get(i.mentorStaffId)) || <span className="text-slate-400 italic">Not Assigned</span>}
        </span>
      ),
    },
    {
      header: 'Period',
      render: i => (
        <span className="text-xs text-slate-500">
          {i.startsOn || 'TBD'} → {i.endsOn || 'TBD'}
        </span>
      ),
    },
    {
      header: 'Progress',
      className: 'w-32',
      render: i => <ProgressBar value={i.progress ?? 0} color={ACCENT.intern} />,
    },
    {
      header: 'Status',
      render: i => <StatusBadge status={i.status} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {notification && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => void fetchInterns()} className="ml-auto underline text-xs font-semibold">
            Retry
          </button>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <FilterBar
          search={search}
          onSearch={setSearch}
          placeholder="Search by code, intern name, mentor..."
          filters={[
            {
              label: 'Department',
              value: deptFilter,
              options: ['All', ...departments.map(d => d.name)],
              onChange: val => {
                if (val === 'All') setDeptFilter('All');
                else {
                  const d = departments.find(item => item.name === val);
                  setDeptFilter(d ? d.id : 'All');
                }
              },
            },
            {
              label: 'Status',
              value: statusFilter,
              options: ['All', 'Active', 'Completed', 'On Hold'],
              onChange: setStatusFilter,
            },
          ]}
        />
        <button
          onClick={() => void fetchInterns()}
          className="btn-secondary !p-2"
          title="Refresh intern directory"
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <div>
            <h2 className="card-title">Active & Completed Interns ({filteredInterns.length})</h2>
            <p className="text-xs text-slate-500">Live directory of active and alumni interns registered in database.</p>
          </div>
        </div>
        <DataTable
          columns={cols}
          rows={filteredInterns}
          rowKey={i => i.id}
          onRowClick={handleOpenDrawer}
          emptyTitle="No interns found matching filters"
        />
      </div>

      {/* Detail Drawer */}
      <DetailDrawer
        open={!!selectedIntern}
        onClose={() => setSelectedIntern(null)}
        title={selectedIntern?.fullName || selectedIntern?.internCode || 'Intern Profile'}
        subtitle={`${selectedIntern?.internCode || ''} · ${selectedIntern?.college || 'Intern'}`}
        accent={ACCENT.intern}
      >
        {selectedIntern && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <StatusBadge status={selectedIntern.status} />
              <span className="text-xs font-mono text-slate-400">ID: {selectedIntern.internCode}</span>
            </div>

            <InfoGrid
              items={[
                ['Intern Code', selectedIntern.internCode],
                ['Full Name', selectedIntern.fullName || '—'],
                ['Email', selectedIntern.email || '—'],
                ['Phone', selectedIntern.phone || '—'],
                ['College', selectedIntern.college || '—'],
                ['Department', (selectedIntern.departmentId && deptMap.get(selectedIntern.departmentId)) || 'Unassigned'],
                ['Start Date', selectedIntern.startsOn || 'TBD'],
                ['End Date', selectedIntern.endsOn || 'TBD'],
                ['Assigned Mentor', (selectedIntern.mentorStaffId && mentorMap.get(selectedIntern.mentorStaffId)) || 'Unassigned'],
                ['Certificate Status', selectedIntern.certificateStatus || 'Pending'],
              ]}
            />

            <div>
              <div className="form-label flex justify-between text-xs mb-1 font-semibold text-slate-700 dark:text-slate-300">
                <span>Overall Progress</span>
                <span>{selectedIntern.progress ?? 0}%</span>
              </div>
              <ProgressBar value={selectedIntern.progress ?? 0} color={ACCENT.intern} />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-5 space-y-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Mentor Allocation & Progress Management
              </h4>

              <SelectField
                label="Assign / Reassign Mentor"
                value={editingMentor}
                onChange={setEditingMentor}
                options={[
                  { label: 'Unassigned', value: '' },
                  ...mentors.map(m => ({ label: `${m.fullName} (${m.jobTitle || 'Staff'})`, value: m.id })),
                ]}
              />

              <SelectField
                label="Internship Status"
                value={editingStatus}
                onChange={v => setEditingStatus(v as InternProfile['status'])}
                options={['Active', 'Completed', 'On Hold']}
              />

              <TextField
                label="Update Project Progress Percentage (0 - 100)"
                type="number"
                value={editingProgress}
                onChange={setEditingProgress}
              />

              <button
                onClick={handleSaveProfileUpdates}
                disabled={savingEdit}
                className="btn-primary text-xs !py-2 w-full flex items-center justify-center gap-1.5"
              >
                <Edit3 size={14} />
                <span>{savingEdit ? 'Saving Updates...' : 'Save Profile Changes'}</span>
              </button>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
