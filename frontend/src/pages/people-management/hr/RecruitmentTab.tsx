import { useEffect, useState } from 'react';
import { Plus, Eye, UserCheck, CheckCircle2, AlertCircle, RefreshCw, FileText, Calendar, Star, Download, Upload } from 'lucide-react';
import { Avatar, DataTable, DetailDrawer, FilterBar, InfoGrid, Modal, SelectField, StatusBadge, TextAreaField, TextField, ACCENT, type Column } from '../../../components/people';
import { peopleApi, type HrApplicant, type HrRequirement, type Department } from '../../../services/peopleApi';

interface Props {
  departments: Department[];
  requirements: HrRequirement[];
  activeRequirementId?: string | null;
  onRefreshStats?: () => void;
  onEmployeeCreated?: () => void;
}

const APPLICANT_STATUSES: HrApplicant['status'][] = [
  'Applied',
  'Under Review',
  'Shortlisted',
  'Interview Scheduled',
  'Selected',
  'Rejected',
  'Hired',
];

const blankApplicant = {
  requirementId: '',
  fullName: '',
  email: '',
  phone: '',
  qualification: '',
  experienceYears: '0',
  skills: '',
  status: 'Applied' as HrApplicant['status'],
  notes: '',
  resumeUrl: '',
};

export default function RecruitmentTab({ departments, requirements, activeRequirementId, onRefreshStats, onEmployeeCreated }: Props) {
  const [applicants, setApplicants] = useState<HrApplicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [reqFilter, setReqFilter] = useState<string>(activeRequirementId || 'All');

  const [selectedApplicant, setSelectedApplicant] = useState<HrApplicant | null>(null);

  // Add Modal
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ ...blankApplicant, requirementId: activeRequirementId || '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Interview Schedule / Update Modal
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewNotes, setInterviewNotes] = useState('');
  const [rating, setRating] = useState('4.0');

  // Convert to Employee Modal
  const [convertOpen, setConvertOpen] = useState(false);
  const [salary, setSalary] = useState('40000');
  const [jobTitle, setJobTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [converting, setConverting] = useState(false);

  const fetchApplicants = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await peopleApi.getApplicants();
      setApplicants(res.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load applicants.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchApplicants();
  }, []);

  useEffect(() => {
    if (activeRequirementId) {
      setReqFilter(activeRequirementId);
    }
  }, [activeRequirementId]);

  const showNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Resume upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await peopleApi.uploadFile(file);
      setForm(f => ({ ...f, resumeUrl: res.url }));
      showNotice(`Uploaded ${file.name}`);
    } catch (err: any) {
      alert(err.message || 'File upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAddSubmit = async () => {
    setFormError('');
    if (!form.fullName.trim()) {
      setFormError('Applicant full name is required.');
      return;
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setFormError('A valid email address is required.');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<HrApplicant> = {
        requirementId: form.requirementId || undefined,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        qualification: form.qualification.trim(),
        experienceYears: Number(form.experienceYears) || 0,
        skills: form.skills ? form.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
        status: form.status,
        notes: form.notes.trim(),
        resumeUrl: form.resumeUrl || undefined,
      };

      const created = await peopleApi.createApplicant(payload);
      setApplicants(prev => [created, ...prev]);
      setForm(blankApplicant);
      setAddOpen(false);
      showNotice(`Applicant ${created.fullName} added successfully.`);
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save applicant.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (applicantId: string, nextStatus: HrApplicant['status']) => {
    try {
      const updated = await peopleApi.updateApplicant(applicantId, { status: nextStatus });
      setApplicants(prev => prev.map(a => (a.id === updated.id ? updated : a)));
      if (selectedApplicant?.id === applicantId) setSelectedApplicant(updated);
      showNotice(`Status updated to "${nextStatus}".`);
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      alert(err?.message || 'Failed to update status.');
    }
  };

  const saveInterview = async () => {
    if (!selectedApplicant) return;
    try {
      const updated = await peopleApi.updateApplicant(selectedApplicant.id, {
        interviewDate: interviewDate || undefined,
        interviewNotes: interviewNotes.trim(),
        rating: Number(rating) || 4.0,
        status: 'Interview Scheduled',
      });
      setApplicants(prev => prev.map(a => (a.id === updated.id ? updated : a)));
      setSelectedApplicant(updated);
      setInterviewOpen(false);
      showNotice('Interview details saved.');
    } catch (err: any) {
      alert(err?.message || 'Failed to update interview details.');
    }
  };

  const openConvertModal = (applicant: HrApplicant) => {
    setSelectedApplicant(applicant);
    const req = requirements.find(r => r.id === applicant.requirementId);
    setJobTitle(req?.title || req?.designation || 'Staff Officer');
    setDepartmentId(req?.departmentId || '');
    setSalary('40000');
    setConvertOpen(true);
  };

  const handleConvertSubmit = async () => {
    if (!selectedApplicant) return;
    setConverting(true);
    try {
      const result = await peopleApi.convertApplicantToEmployee(selectedApplicant.id, {
        salary: Number(salary) || undefined,
        jobTitle: jobTitle.trim(),
        departmentId: departmentId || undefined,
        hiredOn: new Date().toISOString().slice(0, 10),
      });

      // Update applicant in local list to 'Hired'
      setApplicants(prev => prev.map(a => (a.id === selectedApplicant.id ? { ...a, status: 'Hired' } : a)));
      setSelectedApplicant(prev => (prev ? { ...prev, status: 'Hired' } : null));
      setConvertOpen(false);
      showNotice(result.message || `Successfully created employee record for ${selectedApplicant.fullName}!`);
      if (onEmployeeCreated) onEmployeeCreated();
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      alert(err?.message || 'Failed to convert applicant to employee.');
    } finally {
      setConverting(false);
    }
  };

  const requirementMap = new Map(requirements.map(r => [r.id, r.title]));

  const filteredApplicants = applicants.filter(a => {
    const term = search.toLowerCase();
    const matchSearch =
      a.fullName.toLowerCase().includes(term) ||
      a.email.toLowerCase().includes(term) ||
      (a.phone || '').includes(term) ||
      (a.qualification || '').toLowerCase().includes(term);
    const matchStatus = statusFilter === 'All' || a.status === statusFilter;
    const matchReq = reqFilter === 'All' || a.requirementId === reqFilter;
    return matchSearch && matchStatus && matchReq;
  });

  const columns: Column<HrApplicant>[] = [
    {
      header: 'Applicant',
      render: a => (
        <div className="flex items-center gap-3">
          <Avatar name={a.fullName} color={ACCENT.hr} />
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-100">{a.fullName}</div>
            <div className="text-[11px] text-slate-400">{a.email} {a.phone ? `· ${a.phone}` : ''}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Linked Opening',
      render: a => a.requirementId ? requirementMap.get(a.requirementId) || 'Opening' : 'General Application',
    },
    {
      header: 'Qualification & Exp',
      render: a => (
        <span className="text-xs text-slate-700 dark:text-slate-300">
          {a.qualification || '—'} ({a.experienceYears ?? 0} yrs)
        </span>
      ),
    },
    {
      header: 'Status',
      render: a => <StatusBadge status={a.status} />,
    },
    {
      header: 'Resume',
      render: a => a.resumeUrl ? (
        <a
          href={a.resumeUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-teal-600 hover:underline font-semibold"
          onClick={e => e.stopPropagation()}
        >
          <FileText size={13} /> Resume
        </a>
      ) : <span className="text-xs text-slate-400">—</span>,
    },
    {
      header: 'Actions',
      render: a => (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <button
            className="p-1.5 rounded hover:bg-teal-50 dark:hover:bg-slate-800 text-slate-400 hover:text-teal-600 transition-colors"
            onClick={() => setSelectedApplicant(a)}
            title="Review application"
          >
            <Eye size={15} />
          </button>
          {a.status === 'Selected' && (
            <button
              className="btn-primary text-xs py-1 px-2 flex items-center gap-1 shadow-sm"
              onClick={() => openConvertModal(a)}
              title="Convert selected applicant directly into an employee record"
            >
              <UserCheck size={13} /> Hire
            </button>
          )}
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
          <button onClick={fetchApplicants} className="btn-secondary text-xs py-1 px-2.5">Retry</button>
        </div>
      )}

      <FilterBar
        search={search}
        onSearch={setSearch}
        placeholder="Search applicants by name, email, qualification…"
        filters={[
          {
            label: 'Stage / Status',
            value: statusFilter,
            options: ['All', ...APPLICANT_STATUSES],
            onChange: setStatusFilter,
          },
          {
            label: 'HR Requirement',
            value: reqFilter,
            options: ['All', ...requirements.map(r => r.title)],
            onChange: v => {
              if (v === 'All') setReqFilter('All');
              else {
                const found = requirements.find(r => r.title === v);
                setReqFilter(found ? found.id : 'All');
              }
            },
          },
        ]}
      />

      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="card-title">Recruitment Pipeline ({filteredApplicants.length})</h2>
            {loading && <RefreshCw size={14} className="animate-spin text-teal-600" />}
          </div>
          <button className="btn-primary" onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Add Applicant
          </button>
        </div>
        <DataTable
          columns={columns}
          rows={filteredApplicants}
          rowKey={a => a.id}
          onRowClick={a => setSelectedApplicant(a)}
          emptyTitle="No applicants match the filter"
        />
      </div>

      {/* Add Applicant Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Job Applicant"
        submitLabel={saving ? 'Saving...' : 'Add Applicant'}
        onSubmit={handleAddSubmit}
      >
        {formError && (
          <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs mb-3 flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{formError}</span>
          </div>
        )}
        <SelectField
          label="Link to HR Requirement"
          value={requirements.find(r => r.id === form.requirementId)?.title || ''}
          onChange={v => {
            const match = requirements.find(r => r.title === v);
            setForm(f => ({ ...f, requirementId: match ? match.id : '' }));
          }}
          options={['General (No specific opening)', ...requirements.map(r => r.title)]}
          wide
        />
        <TextField
          label="Full Name *"
          value={form.fullName}
          onChange={v => setForm(f => ({ ...f, fullName: v }))}
          required
        />
        <TextField
          label="Email Address *"
          type="email"
          value={form.email}
          onChange={v => setForm(f => ({ ...f, email: v }))}
          required
        />
        <TextField
          label="Phone Number"
          value={form.phone}
          onChange={v => setForm(f => ({ ...f, phone: v }))}
        />
        <TextField
          label="Educational Qualification"
          value={form.qualification}
          onChange={v => setForm(f => ({ ...f, qualification: v }))}
          placeholder="e.g. Master's in Social Work / B.Tech"
        />
        <TextField
          label="Experience (Years)"
          type="number"
          value={form.experienceYears}
          onChange={v => setForm(f => ({ ...f, experienceYears: v }))}
        />
        <TextField
          label="Skills (comma separated)"
          value={form.skills}
          onChange={v => setForm(f => ({ ...f, skills: v }))}
          placeholder="e.g. Public Relations, Event Logistics, Reporting"
          wide
        />
        <SelectField
          label="Initial Status"
          value={form.status}
          onChange={v => setForm(f => ({ ...f, status: v as any }))}
          options={APPLICANT_STATUSES}
        />
        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <label className="form-label">Upload Resume (PDF, DOCX)</label>
          <input
            type="file"
            accept=".pdf,.docx,.doc"
            onChange={handleFileUpload}
            className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
          />
          {uploading && <span className="text-xs text-teal-600">Uploading resume to server...</span>}
          {form.resumeUrl && <span className="text-xs text-emerald-600 font-semibold">Resume uploaded successfully!</span>}
        </div>
        <TextAreaField
          label="Review Notes"
          value={form.notes}
          onChange={v => setForm(f => ({ ...f, notes: v }))}
        />
      </Modal>

      {/* Convert to Employee Modal */}
      <Modal
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        title="Hire & Convert to Employee"
        submitLabel={converting ? 'Converting...' : 'Confirm Hire & Create Employee'}
        onSubmit={handleConvertSubmit}
      >
        <div className="sm:col-span-2 p-3 bg-teal-50 dark:bg-teal-950/40 rounded-lg border border-teal-200 dark:border-teal-800 text-xs text-teal-900 dark:text-teal-200 mb-2">
          This will automatically create a formal <strong>Staff Profile</strong> in PostgreSQL with an auto-generated Employee Code, preserving all applicant details without re-entering data.
        </div>
        <TextField
          label="Applicant Name"
          value={selectedApplicant?.fullName || ''}
          onChange={() => {}}
          disabled
        />
        <TextField
          label="Applicant Email"
          value={selectedApplicant?.email || ''}
          onChange={() => {}}
          disabled
        />
        <TextField
          label="Designation / Role Title *"
          value={jobTitle}
          onChange={setJobTitle}
          required
        />
        <SelectField
          label="Department"
          value={departments.find(d => d.id === departmentId)?.name || ''}
          onChange={v => {
            const found = departments.find(d => d.name === v);
            setDepartmentId(found ? found.id : '');
          }}
          options={departments.map(d => d.name)}
        />
        <TextField
          label="Monthly Salary (₹)"
          type="number"
          value={salary}
          onChange={setSalary}
        />
      </Modal>

      {/* Interview Scheduling Modal */}
      <Modal
        open={interviewOpen}
        onClose={() => setInterviewOpen(false)}
        title="Schedule / Record Interview"
        submitLabel="Save Interview Details"
        onSubmit={saveInterview}
      >
        <TextField
          label="Interview Date & Time"
          type="datetime-local"
          value={interviewDate}
          onChange={setInterviewDate}
          wide
        />
        <TextField
          label="Candidate Rating (1 to 5)"
          type="number"
          value={rating}
          onChange={setRating}
        />
        <TextAreaField
          label="Interview Remarks / Feedback"
          value={interviewNotes}
          onChange={setInterviewNotes}
          placeholder="Record interviewer impressions, strengths, and candidate fit..."
        />
      </Modal>

      {/* Applicant Detail Drawer */}
      <DetailDrawer
        open={!!selectedApplicant}
        onClose={() => setSelectedApplicant(null)}
        title={selectedApplicant?.fullName ?? ''}
        subtitle={selectedApplicant ? `Application · ${selectedApplicant.status}` : ''}
        accent={ACCENT.hr}
      >
        {selectedApplicant && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <StatusBadge status={selectedApplicant.status} />
              {selectedApplicant.resumeUrl && (
                <a
                  href={selectedApplicant.resumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary text-xs flex items-center gap-1.5"
                >
                  <Download size={13} /> View Resume
                </a>
              )}
            </div>

            <InfoGrid
              items={[
                ['Full Name', selectedApplicant.fullName],
                ['Email', selectedApplicant.email],
                ['Phone', selectedApplicant.phone || '—'],
                ['Opening', selectedApplicant.requirementId ? requirementMap.get(selectedApplicant.requirementId) || 'Opening' : 'General'],
                ['Qualification', selectedApplicant.qualification || 'Not Specified'],
                ['Experience', `${selectedApplicant.experienceYears ?? 0} years`],
                ['Interview Date', selectedApplicant.interviewDate ? new Date(selectedApplicant.interviewDate).toLocaleString() : 'Not Scheduled'],
                ['Interview Rating', selectedApplicant.rating ? `${selectedApplicant.rating} / 5.0` : 'Not Rated'],
              ]}
            />

            {selectedApplicant.skills && Array.isArray(selectedApplicant.skills) && selectedApplicant.skills.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Candidate Skills</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedApplicant.skills.map((skill, idx) => (
                    <span key={idx} className="badge badge-teal">{skill}</span>
                  ))}
                </div>
              </div>
            )}

            {selectedApplicant.interviewNotes && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">Interview Feedback / Notes</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{selectedApplicant.interviewNotes}</p>
              </div>
            )}

            {/* Workflow transition actions */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Application Stage Transition</label>
              <div className="flex flex-wrap gap-2">
                {selectedApplicant.status !== 'Shortlisted' && selectedApplicant.status !== 'Hired' && (
                  <button
                    className="btn-secondary text-xs"
                    onClick={() => handleStatusUpdate(selectedApplicant.id, 'Shortlisted')}
                  >
                    Shortlist
                  </button>
                )}
                {selectedApplicant.status !== 'Interview Scheduled' && selectedApplicant.status !== 'Hired' && (
                  <button
                    className="btn-secondary text-xs flex items-center gap-1"
                    onClick={() => {
                      setInterviewDate(selectedApplicant.interviewDate || '');
                      setInterviewNotes(selectedApplicant.interviewNotes || '');
                      setRating(String(selectedApplicant.rating || 4.0));
                      setInterviewOpen(true);
                    }}
                  >
                    <Calendar size={13} /> Interview
                  </button>
                )}
                {selectedApplicant.status !== 'Selected' && selectedApplicant.status !== 'Hired' && (
                  <button
                    className="btn-secondary text-xs text-teal-700 font-bold"
                    onClick={() => handleStatusUpdate(selectedApplicant.id, 'Selected')}
                  >
                    Mark Selected
                  </button>
                )}
                {selectedApplicant.status !== 'Rejected' && selectedApplicant.status !== 'Hired' && (
                  <button
                    className="btn-secondary text-xs text-rose-600 font-bold"
                    onClick={() => handleStatusUpdate(selectedApplicant.id, 'Rejected')}
                  >
                    Reject
                  </button>
                )}
              </div>
            </div>

            {/* Direct Hire / Convert to Employee Button */}
            {selectedApplicant.status !== 'Hired' && (
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  className="btn-primary w-full justify-center text-sm py-2"
                  onClick={() => openConvertModal(selectedApplicant)}
                >
                  <UserCheck size={16} /> Convert to Employee Record
                </button>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
