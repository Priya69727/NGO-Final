import { useEffect, useState } from 'react';
import { Plus, Eye, CheckCircle2, AlertCircle, RefreshCw, Download, Upload, UserCheck, XCircle, ArrowRight } from 'lucide-react';
import { Avatar, DataTable, DetailDrawer, FilterBar, InfoGrid, Modal, PhoneField, SelectField, StatusBadge, TextAreaField, TextField, ACCENT, type Column } from '../../../components/people';
import { peopleApi, type InternApplication, type Department, type StaffProfile } from '../../../services/peopleApi';

interface Props {
  departments: Department[];
  mentors: StaffProfile[];
  onRefreshStats?: () => void;
  onInternCreated?: () => void;
}

const STATUS_STAGES: InternApplication['status'][] = [
  'Applied',
  'Under Review',
  'Shortlisted',
  'Selected',
  'Rejected',
];

const blankApp = {
  fullName: '',
  email: '',
  phone: '',
  college: '',
  degree: '',
  graduationYear: '2026',
  areaOfInterest: '',
  preferredDepartmentId: '',
  durationWeeks: '8',
  skills: '',
  notes: '',
  resumeUrl: '',
};

export default function ApplicationsTab({ departments, mentors, onRefreshStats, onInternCreated }: Props) {
  const [applications, setApplications] = useState<InternApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Add application modal
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(blankApp);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Detail drawer
  const [selectedApp, setSelectedApp] = useState<InternApplication | null>(null);
  const [reviewerRemarks, setReviewerRemarks] = useState('');
  const [updatingRemarks, setUpdatingRemarks] = useState(false);

  // Convert / Select Modal
  const [selectModalOpen, setSelectModalOpen] = useState(false);
  const [targetApp, setTargetApp] = useState<InternApplication | null>(null);
  const [mentorStaffId, setMentorStaffId] = useState('');
  const [assignDeptId, setAssignDeptId] = useState('');
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10));
  const [endsOn, setEndsOn] = useState(
    new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [projectTitle, setProjectTitle] = useState('Community Outreach');
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState('');

  const fetchApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await peopleApi.getInternApplications({ limit: 100 });
      setApplications(res.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load intern applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchApplications();
  }, []);

  const handleFileUpload = async (file: File) => {
    setUploadingResume(true);
    try {
      const uploadRes = await peopleApi.uploadFile(file);
      setForm(prev => ({ ...prev, resumeUrl: uploadRes.url }));
    } catch (err: any) {
      setFormError(err?.message || 'Resume upload failed.');
    } finally {
      setUploadingResume(false);
    }
  };

  const handleCreateApplication = async () => {
    if (!form.fullName.trim() || !form.email.trim() || !form.areaOfInterest.trim()) {
      setFormError('Full name, email, and area of interest are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const skillsArray = form.skills
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      await peopleApi.createInternApplication({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        college: form.college.trim() || undefined,
        degree: form.degree.trim() || undefined,
        graduationYear: form.graduationYear ? parseInt(form.graduationYear, 10) : undefined,
        areaOfInterest: form.areaOfInterest.trim() || undefined,
        preferredDepartmentId: form.preferredDepartmentId || undefined,
        durationWeeks: form.durationWeeks ? parseInt(form.durationWeeks, 10) : 8,
        skills: skillsArray,
        notes: form.notes.trim() || undefined,
        resumeUrl: form.resumeUrl || undefined,
        status: 'Applied',
        appliedOn: new Date().toISOString().slice(0, 10),
      });

      setNotification(`Application submitted successfully for ${form.fullName}.`);
      setAddOpen(false);
      setForm(blankApp);
      await fetchApplications();
      onRefreshStats?.();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to submit application.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (appId: string, status: InternApplication['status']) => {
    try {
      await peopleApi.updateInternApplication(appId, { status });
      setNotification(`Application status updated to ${status}.`);
      await fetchApplications();
      onRefreshStats?.();
      if (selectedApp && selectedApp.id === appId) {
        setSelectedApp(prev => prev ? { ...prev, status } : null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update application status.');
    }
  };

  const handleSaveRemarks = async () => {
    if (!selectedApp) return;
    setUpdatingRemarks(true);
    try {
      await peopleApi.updateInternApplication(selectedApp.id, {
        reviewerRemarks: reviewerRemarks.trim(),
      });
      setSelectedApp(prev => prev ? { ...prev, reviewerRemarks } : null);
      setNotification('Reviewer remarks saved successfully.');
      await fetchApplications();
    } catch (err: any) {
      setError(err?.message || 'Failed to save remarks.');
    } finally {
      setUpdatingRemarks(false);
    }
  };

  const openSelectModal = (app: InternApplication) => {
    setTargetApp(app);
    setAssignDeptId(app.preferredDepartmentId || departments[0]?.id || '');
    setMentorStaffId(mentors[0]?.id || '');
    setSelectModalOpen(true);
    setConvertError('');
  };

  const handleConfirmSelection = async () => {
    if (!targetApp) return;
    setConverting(true);
    setConvertError('');
    try {
      await peopleApi.selectInternApplicant(targetApp.id, {
        mentorStaffId: mentorStaffId || undefined,
        departmentId: assignDeptId || undefined,
        startsOn,
        endsOn,
        projectName: projectTitle,
      });

      setNotification(`Candidate ${targetApp.fullName} successfully converted to Intern!`);
      setSelectModalOpen(false);
      setTargetApp(null);
      await fetchApplications();
      onRefreshStats?.();
      onInternCreated?.();
    } catch (err: any) {
      setConvertError(err?.message || 'Conversion to Intern profile failed.');
    } finally {
      setConverting(false);
    }
  };

  const deptMap = new Map(departments.map(d => [d.id, d.name]));

  const filteredApps = applications.filter(a => {
    const matchesSearch =
      (a.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.college || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.areaOfInterest || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const cols: Column<InternApplication>[] = [
    {
      header: 'Applicant',
      render: a => (
        <div className="flex items-center gap-3">
          <Avatar name={a.fullName} color={ACCENT.intern} size={36} />
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-100">{a.fullName}</div>
            <div className="text-xs text-slate-400">{a.email}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'College / Degree',
      render: a => (
        <div>
          <div className="text-sm text-slate-700 dark:text-slate-200">{a.college || '—'}</div>
          <div className="text-xs text-slate-400">{a.degree ? `${a.degree} (${a.graduationYear || '—'})` : '—'}</div>
        </div>
      ),
    },
    {
      header: 'Area of Interest',
      render: a => <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{a.areaOfInterest || 'General'}</span>,
    },
    {
      header: 'Department',
      render: a => (
        <span className="text-xs text-slate-500">
          {(a.preferredDepartmentId && deptMap.get(a.preferredDepartmentId)) || 'Unassigned'}
        </span>
      ),
    },
    {
      header: 'Status',
      render: a => <StatusBadge status={a.status} />,
    },
    {
      header: 'Actions',
      render: a => (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => {
              setSelectedApp(a);
              setReviewerRemarks(a.reviewerRemarks || '');
            }}
            className="p-1 text-slate-500 hover:text-teal-600 rounded hover:bg-slate-100"
            title="View Details"
          >
            <Eye size={16} />
          </button>
          {a.status !== 'Selected' && a.status !== 'Rejected' && (
            <button
              onClick={() => openSelectModal(a)}
              className="px-2 py-1 text-xs font-semibold rounded bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-300 flex items-center gap-1"
              title="Select & Convert to Intern Profile"
            >
              <UserCheck size={13} />
              <span>Select</span>
            </button>
          )}
        </div>
      ),
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
          <button onClick={() => void fetchApplications()} className="ml-auto underline text-xs font-semibold">
            Retry
          </button>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <FilterBar
          search={search}
          onSearch={setSearch}
          placeholder="Search by name, college, email..."
          filters={[
            {
              label: 'Status',
              value: statusFilter,
              options: ['All', ...STATUS_STAGES],
              onChange: setStatusFilter,
            },
          ]}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchApplications()}
            className="btn-secondary !p-2"
            title="Refresh applications"
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button className="btn-primary flex items-center gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus size={16} /> New Application
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <div>
            <h2 className="card-title">Intern Applications ({filteredApps.length})</h2>
            <p className="text-xs text-slate-500">Live candidate submissions from database. Select candidates to create active intern profiles.</p>
          </div>
        </div>
        <DataTable
          columns={cols}
          rows={filteredApps}
          rowKey={a => a.id}
          onRowClick={a => {
            setSelectedApp(a);
            setReviewerRemarks(a.reviewerRemarks || '');
          }}
          emptyTitle="No applications found matching filters"
        />
      </div>

      {/* Add Application Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Register New Intern Application"
        submitLabel={saving ? 'Submitting...' : 'Submit Application'}
        onSubmit={handleCreateApplication}
        wide
      >
        {formError && (
          <div className="col-span-1 sm:col-span-2 p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">
            {formError}
          </div>
        )}
        <TextField
          label="Full Name"
          value={form.fullName}
          onChange={v => setForm({ ...form, fullName: v })}
          placeholder="e.g. Priya Sharma"
          required
        />
        <TextField
          label="Email Address"
          type="email"
          value={form.email}
          onChange={v => setForm({ ...form, email: v })}
          placeholder="priya@example.com"
          required
        />
        <PhoneField
          label="Phone Number"
          value={form.phone}
          onChange={v => setForm({ ...form, phone: v })}
        />
        <TextField
          label="College / University"
          value={form.college}
          onChange={v => setForm({ ...form, college: v })}
          placeholder="e.g. Pune University"
        />
        <TextField
          label="Course / Degree"
          value={form.degree}
          onChange={v => setForm({ ...form, degree: v })}
          placeholder="e.g. B.Tech Computer Engineering"
        />
        <TextField
          label="Graduation Year"
          type="number"
          value={form.graduationYear}
          onChange={v => setForm({ ...form, graduationYear: v })}
        />
        <TextField
          label="Area of Interest"
          value={form.areaOfInterest}
          onChange={v => setForm({ ...form, areaOfInterest: v })}
          placeholder="e.g. Digital Marketing, Field Work, Coding"
          required
        />
        <SelectField
          label="Preferred Department"
          value={form.preferredDepartmentId}
          onChange={v => setForm({ ...form, preferredDepartmentId: v })}
          options={departments.map(d => ({ label: d.name, value: d.id }))}
        />
        <TextField
          label="Internship Duration (Weeks)"
          type="number"
          value={form.durationWeeks}
          onChange={v => setForm({ ...form, durationWeeks: v })}
        />
        <TextField
          label="Key Skills (comma separated)"
          value={form.skills}
          onChange={v => setForm({ ...form, skills: v })}
          placeholder="e.g. Python, Content Writing, Research"
        />
        <div className="col-span-1 sm:col-span-2">
          <label className="form-label">Resume Upload (PDF / DOC)</label>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) void handleFileUpload(file);
              }}
              className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
            />
            {uploadingResume && <span className="text-xs text-teal-600 animate-pulse">Uploading resume...</span>}
            {form.resumeUrl && (
              <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                <CheckCircle2 size={13} /> Resume Attached
              </span>
            )}
          </div>
        </div>
        <div className="col-span-1 sm:col-span-2">
          <TextAreaField
            label="Applicant Statement or Notes"
            value={form.notes}
            onChange={v => setForm({ ...form, notes: v })}
            placeholder="Additional details regarding availability or background..."
          />
        </div>
      </Modal>

      {/* Select Candidate & Convert to Intern Profile Modal */}
      <Modal
        open={selectModalOpen}
        onClose={() => setSelectModalOpen(false)}
        title={`Select & Convert ${targetApp?.fullName ?? 'Candidate'} to Intern`}
        submitLabel={converting ? 'Converting...' : 'Confirm Selection & Create Profile'}
        onSubmit={handleConfirmSelection}
        wide
      >
        {convertError && (
          <div className="col-span-1 sm:col-span-2 p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">
            {convertError}
          </div>
        )}
        <div className="col-span-1 sm:col-span-2 text-sm text-slate-600 dark:text-slate-300">
          This workflow automatically generates an <strong>INT-xxx</strong> intern profile in the database, sets their status to <strong>Active</strong>, and updates their application to <strong>Selected</strong> without duplicate data entry.
        </div>
        <SelectField
          label="Assigned Department"
          value={assignDeptId}
          onChange={setAssignDeptId}
          options={departments.map(d => ({ label: d.name, value: d.id }))}
          required
        />
        <SelectField
          label="Assign Mentor (Staff Member)"
          value={mentorStaffId}
          onChange={setMentorStaffId}
          options={mentors.map(m => ({ label: `${m.fullName} (${m.jobTitle || 'Staff'})`, value: m.id }))}
        />
        <TextField
          label="Internship Start Date"
          type="date"
          value={startsOn}
          onChange={setStartsOn}
          required
        />
        <TextField
          label="Internship End Date"
          type="date"
          value={endsOn}
          onChange={setEndsOn}
          required
        />
        <div className="col-span-1 sm:col-span-2">
          <TextField
            label="Assigned Project / Program Title"
            value={projectTitle}
            onChange={setProjectTitle}
            placeholder="e.g. Community Health Awareness 2026"
            required
          />
        </div>
      </Modal>

      {/* Detail Drawer */}
      <DetailDrawer
        open={!!selectedApp}
        onClose={() => setSelectedApp(null)}
        title={selectedApp?.fullName ?? ''}
        subtitle={`${selectedApp?.college || 'Applicant'} · Applied ${selectedApp?.appliedOn || ''}`}
        accent={ACCENT.intern}
      >
        {selectedApp && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <StatusBadge status={selectedApp.status} />
              <div className="flex items-center gap-2">
                {selectedApp.status !== 'Selected' && (
                  <button
                    onClick={() => openSelectModal(selectedApp)}
                    className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                  >
                    <UserCheck size={14} /> Select & Create Intern
                  </button>
                )}
              </div>
            </div>

            <InfoGrid
              items={[
                ['Full Name', selectedApp.fullName],
                ['Email', selectedApp.email],
                ['Phone', selectedApp.phone || '—'],
                ['College / University', selectedApp.college || '—'],
                ['Course / Degree', selectedApp.degree || '—'],
                ['Graduation Year', selectedApp.graduationYear ? String(selectedApp.graduationYear) : '—'],
                ['Area of Interest', selectedApp.areaOfInterest || '—'],
                ['Duration', selectedApp.durationWeeks ? `${selectedApp.durationWeeks} Weeks` : '—'],
                ['Applied Date', selectedApp.appliedOn || '—'],
                ['Preferred Dept', (selectedApp.preferredDepartmentId && deptMap.get(selectedApp.preferredDepartmentId)) || 'Unassigned'],
              ]}
            />

            {selectedApp.skills && selectedApp.skills.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1.5 uppercase tracking-wider">
                  Skills & Competencies
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedApp.skills.map((skill, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedApp.resumeUrl && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Resume Attached</span>
                <a
                  href={selectedApp.resumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary !py-1 !px-2.5 text-xs flex items-center gap-1"
                >
                  <Download size={13} /> View Resume
                </a>
              </div>
            )}

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Update Status Workflow
              </label>
              <div className="flex flex-wrap gap-2">
                {STATUS_STAGES.map(st => (
                  <button
                    key={st}
                    onClick={() => handleUpdateStatus(selectedApp.id, st)}
                    disabled={selectedApp.status === st}
                    className={`px-2.5 py-1 text-xs rounded font-medium border ${
                      selectedApp.status === st
                        ? 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-200'
                        : 'border-slate-200 hover:border-teal-500 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2">
              <TextAreaField
                label="Reviewer Remarks & Notes"
                value={reviewerRemarks}
                onChange={setReviewerRemarks}
                placeholder="Candidate strengths, interview feedback, or mentor assignment notes..."
              />
              <button
                onClick={handleSaveRemarks}
                disabled={updatingRemarks}
                className="btn-secondary text-xs !py-1.5"
              >
                {updatingRemarks ? 'Saving...' : 'Save Remarks'}
              </button>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
