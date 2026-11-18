import { useEffect, useState } from 'react';
import { Plus, Eye, Edit3, Trash2, CheckCircle2, AlertCircle, RefreshCw, XCircle, Clock } from 'lucide-react';
import { DataTable, DetailDrawer, FilterBar, InfoGrid, Modal, SelectField, StatusBadge, TextAreaField, TextField, ACCENT, type Column } from '../../../components/people';
import { peopleApi, type HrRequirement, type Department } from '../../../services/peopleApi';

interface Props {
  departments: Department[];
  onRefreshStats?: () => void;
  onSelectRequirementForRecruitment?: (reqId: string) => void;
}

const STATUS_OPTIONS: HrRequirement['status'][] = [
  'Draft',
  'Pending Approval',
  'Approved',
  'In Progress',
  'Open',
  'Shortlisting',
  'On Hold',
  'Fulfilled',
  'Filled',
  'Rejected',
  'Cancelled',
];

const blankRequirement = {
  title: '',
  designation: '',
  departmentId: '',
  urgency: 'Medium' as HrRequirement['urgency'],
  openings: '1',
  experienceYears: '0',
  qualification: '',
  requiredSkills: '',
  description: '',
  status: 'Open' as HrRequirement['status'],
  openedOn: new Date().toISOString().slice(0, 10),
  closesOn: '',
};

export default function RequirementsTab({ departments, onRefreshStats, onSelectRequirementForRecruitment }: Props) {
  const [requirements, setRequirements] = useState<HrRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');

  const [selectedReq, setSelectedReq] = useState<HrRequirement | null>(null);

  // Add Modal
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(blankRequirement);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit Modal
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [editError, setEditError] = useState('');

  const fetchRequirements = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await peopleApi.getRequirements();
      setRequirements(res.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load requirements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRequirements();
  }, []);

  const showNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleAddSubmit = async () => {
    setFormError('');
    if (!form.title.trim()) {
      setFormError('Role title is required.');
      return;
    }
    if (!form.description.trim()) {
      setFormError('Job description is required.');
      return;
    }
    const openingsNum = parseInt(form.openings, 10);
    if (isNaN(openingsNum) || openingsNum <= 0) {
      setFormError('Number of openings must be at least 1.');
      return;
    }
    if (form.closesOn && form.openedOn && form.closesOn < form.openedOn) {
      setFormError('Expected closing/joining date cannot be earlier than opening date.');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<HrRequirement> = {
        title: form.title.trim(),
        designation: form.designation.trim() || form.title.trim(),
        departmentId: form.departmentId || undefined,
        urgency: form.urgency,
        openings: openingsNum,
        experienceYears: Number(form.experienceYears) || 0,
        qualification: form.qualification.trim(),
        requiredSkills: form.requiredSkills.trim(),
        description: form.description.trim(),
        status: form.status,
        openedOn: form.openedOn || new Date().toISOString().slice(0, 10),
        closesOn: form.closesOn || undefined,
      };

      const created = await peopleApi.createRequirement(payload);
      setRequirements(prev => [created, ...prev]);
      setForm(blankRequirement);
      setAddOpen(false);
      showNotice(`Requirement "${created.title}" created successfully.`);
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create requirement.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = () => {
    if (!selectedReq) return;
    setEditForm({
      title: selectedReq.title,
      designation: selectedReq.designation || selectedReq.title,
      departmentId: selectedReq.departmentId || '',
      urgency: selectedReq.urgency,
      openings: String(selectedReq.openings),
      experienceYears: String(selectedReq.experienceYears || 0),
      qualification: selectedReq.qualification || '',
      requiredSkills: selectedReq.requiredSkills || '',
      description: selectedReq.description || '',
      status: selectedReq.status,
      openedOn: selectedReq.openedOn || '',
      closesOn: selectedReq.closesOn || '',
    });
    setEditError('');
    setEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!selectedReq) return;
    setEditError('');
    if (!editForm.title.trim()) {
      setEditError('Role title is required.');
      return;
    }
    if (!editForm.description.trim()) {
      setEditError('Job description is required.');
      return;
    }
    if (editForm.closesOn && editForm.openedOn && editForm.closesOn < editForm.openedOn) {
      setEditError('Closing date cannot be earlier than the opening date.');
      return;
    }
    const openingsNum = parseInt(editForm.openings, 10);
    if (isNaN(openingsNum) || openingsNum <= 0) {
      setEditError('Positions must be at least 1.');
      return;
    }

    setSaving(true);
    try {
      const updated = await peopleApi.updateRequirement(selectedReq.id, {
        title: editForm.title.trim(),
        designation: editForm.designation.trim() || editForm.title.trim(),
        departmentId: editForm.departmentId || null,
        urgency: editForm.urgency,
        openings: openingsNum,
        experienceYears: Number(editForm.experienceYears) || 0,
        qualification: editForm.qualification,
        requiredSkills: editForm.requiredSkills,
        description: editForm.description,
        status: editForm.status,
        openedOn: editForm.openedOn || undefined,
        closesOn: editForm.closesOn || null,
      });

      setRequirements(prev => prev.map(r => (r.id === updated.id ? updated : r)));
      setSelectedReq(updated);
      setEditOpen(false);
      showNotice(`Requirement "${updated.title}" updated successfully.`);
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update requirement.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (reqId: string, newStatus: HrRequirement['status']) => {
    try {
      const updated = await peopleApi.updateRequirement(reqId, { status: newStatus });
      setRequirements(prev => prev.map(r => (r.id === updated.id ? updated : r)));
      if (selectedReq?.id === reqId) setSelectedReq(updated);
      showNotice(`Requirement status updated to "${newStatus}".`);
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      alert(err?.message || 'Failed to update status.');
    }
  };

  const handleDelete = async (reqId: string) => {
    if (!window.confirm('Are you sure you want to delete this HR requirement?')) return;
    try {
      await peopleApi.deleteRequirement(reqId);
      setRequirements(prev => prev.filter(r => r.id !== reqId));
      if (selectedReq?.id === reqId) setSelectedReq(null);
      showNotice('Requirement deleted successfully.');
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete requirement.');
    }
  };

  const departmentMap = new Map(departments.map(d => [d.id, d.name]));

  const filteredRequirements = requirements.filter(r => {
    const term = search.toLowerCase();
    const matchSearch =
      r.title.toLowerCase().includes(term) ||
      (r.description || '').toLowerCase().includes(term) ||
      (r.requiredSkills || '').toLowerCase().includes(term);
    const matchStatus = statusFilter === 'All' || r.status === statusFilter;
    const matchDept = deptFilter === 'All' || r.departmentId === deptFilter;
    return matchSearch && matchStatus && matchDept;
  });

  const columns: Column<HrRequirement>[] = [
    {
      header: 'Role / Designation',
      render: r => (
        <div>
          <span className="font-semibold text-slate-800 dark:text-slate-100">{r.title}</span>
          {r.qualification && <div className="text-[11px] text-slate-500">{r.qualification}</div>}
        </div>
      ),
    },
    {
      header: 'Department',
      render: r => r.departmentId ? departmentMap.get(r.departmentId) || r.departmentId : '—',
    },
    {
      header: 'Openings',
      render: r => (
        <span className="font-bold text-teal-700 dark:text-teal-400">{r.openings}</span>
      ),
    },
    {
      header: 'Priority',
      render: r => <StatusBadge status={r.urgency} />,
    },
    {
      header: 'Status',
      render: r => <StatusBadge status={r.status} />,
    },
    {
      header: 'Opened Date',
      render: r => <span className="text-xs text-slate-500">{r.openedOn}</span>,
    },
    {
      header: '',
      render: r => (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button
            className="p-1.5 rounded hover:bg-teal-50 dark:hover:bg-slate-800 text-slate-400 hover:text-teal-600 transition-colors"
            onClick={() => setSelectedReq(r)}
            title="View details"
          >
            <Eye size={15} />
          </button>
          <button
            className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-600 transition-colors"
            onClick={() => handleDelete(r.id)}
            title="Delete requirement"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
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
          <button onClick={fetchRequirements} className="btn-secondary text-xs py-1 px-2.5">
            Retry
          </button>
        </div>
      )}

      <FilterBar
        search={search}
        onSearch={setSearch}
        placeholder="Search requirements by title or skill…"
        filters={[
          {
            label: 'Status',
            value: statusFilter,
            options: ['All', ...STATUS_OPTIONS],
            onChange: setStatusFilter,
          },
          {
            label: 'Department',
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
        ]}
      />

      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="card-title">Staff Requirements ({filteredRequirements.length})</h2>
            {loading && <RefreshCw size={14} className="animate-spin text-teal-600" />}
          </div>
          <button className="btn-primary" onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Add Requirement
          </button>
        </div>
        <DataTable
          columns={columns}
          rows={filteredRequirements}
          rowKey={r => r.id}
          onRowClick={r => setSelectedReq(r)}
          emptyTitle="No HR requirements found"
        />
      </div>

      {/* Add Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Create New HR Requirement"
        submitLabel={saving ? 'Saving...' : 'Create Requirement'}
        onSubmit={handleAddSubmit}
      >
        {formError && (
          <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs mb-3 flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{formError}</span>
          </div>
        )}
        <TextField
          label="Required Designation / Role Title *"
          value={form.title}
          onChange={v => setForm(f => ({ ...f, title: v }))}
          placeholder="e.g. Senior Project Coordinator"
          required
          wide
        />
        <SelectField
          label="Department / Organisation Unit"
          value={departments.find(d => d.id === form.departmentId)?.name || ''}
          onChange={v => {
            const found = departments.find(d => d.name === v);
            setForm(f => ({ ...f, departmentId: found ? found.id : '' }));
          }}
          options={departments.map(d => d.name)}
        />
        <SelectField
          label="Priority / Urgency"
          value={form.urgency}
          onChange={v => setForm(f => ({ ...f, urgency: v as any }))}
          options={['Low', 'Medium', 'High', 'Critical']}
        />
        <TextField
          label="Number of Employees Required *"
          type="number"
          value={form.openings}
          onChange={v => setForm(f => ({ ...f, openings: v }))}
          required
        />
        <TextField
          label="Experience Required (Years)"
          type="number"
          value={form.experienceYears}
          onChange={v => setForm(f => ({ ...f, experienceYears: v }))}
        />
        <TextField
          label="Educational Qualification"
          value={form.qualification}
          onChange={v => setForm(f => ({ ...f, qualification: v }))}
          placeholder="e.g. Master's in Social Work / B.Tech"
        />
        <TextField
          label="Required Skills"
          value={form.requiredSkills}
          onChange={v => setForm(f => ({ ...f, requiredSkills: v }))}
          placeholder="e.g. Field Operations, Donor Communication"
          wide
        />
        <SelectField
          label="Initial Status"
          value={form.status}
          onChange={v => setForm(f => ({ ...f, status: v as any }))}
          options={STATUS_OPTIONS}
        />
        <TextField
          label="Expected Joining / Closes On"
          type="date"
          value={form.closesOn}
          onChange={v => setForm(f => ({ ...f, closesOn: v }))}
        />
        <TextAreaField
          label="Job Description"
          value={form.description}
          onChange={v => setForm(f => ({ ...f, description: v }))}
          required
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit HR Requirement"
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
          label="Role Title *"
          value={editForm.title || ''}
          onChange={v => setEditForm((f: any) => ({ ...f, title: v }))}
          required
          wide
        />
        <SelectField
          label="Department"
          value={departments.find(d => d.id === editForm.departmentId)?.name || ''}
          onChange={v => {
            const found = departments.find(d => d.name === v);
            setEditForm((f: any) => ({ ...f, departmentId: found ? found.id : '' }));
          }}
          options={departments.map(d => d.name)}
        />
        <SelectField
          label="Priority"
          value={editForm.urgency || 'Medium'}
          onChange={v => setEditForm((f: any) => ({ ...f, urgency: v }))}
          options={['Low', 'Medium', 'High', 'Critical']}
        />
        <TextField
          label="Positions Required"
          type="number"
          value={editForm.openings || '1'}
          onChange={v => setEditForm((f: any) => ({ ...f, openings: v }))}
        />
        <TextField
          label="Experience Required (Years)"
          type="number"
          value={editForm.experienceYears || '0'}
          onChange={v => setEditForm((f: any) => ({ ...f, experienceYears: v }))}
        />
        <TextField
          label="Qualification"
          value={editForm.qualification || ''}
          onChange={v => setEditForm((f: any) => ({ ...f, qualification: v }))}
        />
        <TextField
          label="Required Skills"
          value={editForm.requiredSkills || ''}
          onChange={v => setEditForm((f: any) => ({ ...f, requiredSkills: v }))}
          wide
        />
        <SelectField
          label="Status"
          value={editForm.status || 'Open'}
          onChange={v => setEditForm((f: any) => ({ ...f, status: v }))}
          options={STATUS_OPTIONS}
        />
        <TextField
          label="Expected Joining / Closes On"
          type="date"
          value={editForm.closesOn || ''}
          onChange={v => setEditForm((f: any) => ({ ...f, closesOn: v }))}
        />
        <TextAreaField
          label="Job Description"
          value={editForm.description || ''}
          onChange={v => setEditForm((f: any) => ({ ...f, description: v }))}
          required
        />
      </Modal>

      {/* Detail Drawer */}
      <DetailDrawer
        open={!!selectedReq}
        onClose={() => setSelectedReq(null)}
        title={selectedReq?.title ?? ''}
        subtitle={selectedReq ? `${selectedReq.openings} position(s) · ${selectedReq.urgency} priority` : ''}
        accent={ACCENT.hr}
      >
        {selectedReq && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <StatusBadge status={selectedReq.status} />
                <StatusBadge status={selectedReq.urgency} />
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-secondary text-xs flex items-center gap-1.5" onClick={startEdit}>
                  <Edit3 size={13} /> Edit
                </button>
                <button
                  className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded transition-colors"
                  onClick={() => handleDelete(selectedReq.id)}
                  title="Delete requirement"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            <InfoGrid
              items={[
                ['Status', <StatusBadge key="st" status={selectedReq.status} />],
                ['Priority', <StatusBadge key="pr" status={selectedReq.urgency} />],
                ['Department', selectedReq.departmentId ? departmentMap.get(selectedReq.departmentId) || selectedReq.departmentId : 'Unassigned'],
                ['Openings Required', selectedReq.openings],
                ['Opened Date', selectedReq.openedOn],
                ['Target Joining Date', selectedReq.closesOn || 'Open until filled'],
                ['Experience Required', `${selectedReq.experienceYears ?? 0} years`],
                ['Educational Qualification', selectedReq.qualification || 'Not Specified'],
                ['Required Skills', selectedReq.requiredSkills || 'Not Specified'],
              ]}
            />

            <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Job Description</h4>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {selectedReq.description || 'No detailed description provided.'}
              </p>
            </div>

            {/* Quick Status Workflow Action Buttons */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Quick Status Transition</label>
              <div className="flex flex-wrap gap-2">
                {selectedReq.status !== 'Approved' && (
                  <button
                    className="btn-secondary text-xs"
                    onClick={() => handleStatusChange(selectedReq.id, 'Approved')}
                  >
                    Mark Approved
                  </button>
                )}
                {selectedReq.status !== 'In Progress' && (
                  <button
                    className="btn-secondary text-xs"
                    onClick={() => handleStatusChange(selectedReq.id, 'In Progress')}
                  >
                    Mark In Progress
                  </button>
                )}
                {selectedReq.status !== 'Fulfilled' && (
                  <button
                    className="btn-secondary text-xs text-emerald-700 font-bold"
                    onClick={() => handleStatusChange(selectedReq.id, 'Fulfilled')}
                  >
                    Mark Fulfilled
                  </button>
                )}
                {selectedReq.status !== 'Cancelled' && (
                  <button
                    className="btn-secondary text-xs text-rose-600 font-bold"
                    onClick={() => handleStatusChange(selectedReq.id, 'Cancelled')}
                  >
                    Cancel Requirement
                  </button>
                )}
              </div>
            </div>

            {onSelectRequirementForRecruitment && (
              <div className="mt-3 p-3 bg-teal-50 dark:bg-teal-950/40 rounded-lg border border-teal-200 dark:border-teal-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-teal-900 dark:text-teal-200">Recruitment Pipeline</div>
                  <div className="text-[11px] text-teal-700 dark:text-teal-400">View & manage applicants for this opening</div>
                </div>
                <button
                  className="btn-primary text-xs py-1.5 px-3"
                  onClick={() => {
                    onSelectRequirementForRecruitment(selectedReq.id);
                    setSelectedReq(null);
                  }}
                >
                  View Applicants &rarr;
                </button>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
