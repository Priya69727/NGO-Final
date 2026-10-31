import { useEffect, useState } from 'react';
import { Star, Plus, CheckCircle2, AlertCircle, RefreshCw, Award, TrendingUp } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Avatar, DataTable, Modal, SelectField, StatusBadge, TextAreaField, TextField, ACCENT, type Column } from '../../../components/people';
import { peopleApi, type StaffProfile, type StaffPerformanceReview } from '../../../services/peopleApi';

interface Props {
  employees: StaffProfile[];
  onRefreshStats?: () => void;
}

export default function PerformanceTab({ employees, onRefreshStats }: Props) {
  const [reviews, setReviews] = useState<StaffPerformanceReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [selectedStaffId, setSelectedStaffId] = useState<string>(employees[0]?.id || '');
  const [reviewOpen, setReviewOpen] = useState(false);

  // Review Form state
  const [formStaffId, setFormStaffId] = useState(employees[0]?.id || '');
  const [formPeriod, setFormPeriod] = useState('Q1 2026');
  const [formRating, setFormRating] = useState('4.0');
  const [formStrengths, setFormStrengths] = useState('');
  const [formImprovements, setFormImprovements] = useState('');
  const [formFeedback, setFormFeedback] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchReviews = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await peopleApi.getStaffPerformance({ limit: 100 });
      setReviews(res.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load performance evaluations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReviews();
  }, []);

  const showNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleAddReview = async () => {
    setFormError('');
    if (!formStaffId) {
      setFormError('Please select an employee.');
      return;
    }
    const numRating = parseFloat(formRating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      setFormError('Rating must be between 1.0 and 5.0.');
      return;
    }
    if (!formFeedback.trim()) {
      setFormError('Evaluation feedback is required.');
      return;
    }

    setSaving(true);
    try {
      const created = await peopleApi.createStaffPerformance({
        staffId: formStaffId,
        reviewPeriod: formPeriod,
        rating: numRating,
        feedback: formFeedback.trim(),
        strengths: formStrengths.trim(),
        improvementAreas: formImprovements.trim(),
        reviewedOn: new Date().toISOString().slice(0, 10),
      });

      setReviews(prev => [created, ...prev]);
      setReviewOpen(false);
      setFormFeedback('');
      setFormStrengths('');
      setFormImprovements('');
      showNotice('Performance review saved successfully to database.');
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save performance evaluation.');
    } finally {
      setSaving(false);
    }
  };

  const staffMap = new Map(employees.map(e => [e.id, e]));
  const currentStaff = staffMap.get(selectedStaffId) || employees[0];

  const staffReviews = reviews.filter(r => r.staffId === (currentStaff?.id || ''));

  // Calculate average rating per employee from database
  const employeeRatings = employees.map(e => {
    const eReviews = reviews.filter(r => r.staffId === e.id);
    const avg = eReviews.length
      ? eReviews.reduce((sum, r) => sum + Number(r.rating), 0) / eReviews.length
      : 3.5;
    return {
      staff: e,
      avgRating: avg,
      reviewCount: eReviews.length,
      latestFeedback: eReviews[0]?.feedback || 'No evaluation recorded',
    };
  });

  const chartData = [...staffReviews]
    .sort((a, b) => a.reviewedOn.localeCompare(b.reviewedOn))
    .map(r => ({
      period: r.reviewPeriod || r.reviewedOn,
      rating: Number(r.rating),
    }));

  const columns: Column<(typeof employeeRatings)[0]>[] = [
    {
      header: 'Employee',
      render: item => (
        <div className="flex items-center gap-2">
          <Avatar name={item.staff.fullName} color={ACCENT.hr} size={28} />
          <div>
            <span className="font-semibold text-slate-800 dark:text-slate-100">{item.staff.fullName}</span>
            <div className="text-[10px] text-slate-400">{item.staff.jobTitle}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Overall Rating',
      render: item => (
        <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
          <Star size={13} className="text-amber-500 fill-amber-500" />
          {item.avgRating.toFixed(1)} / 5.0
        </span>
      ),
    },
    {
      header: 'Reviews Count',
      render: item => <span className="text-xs text-slate-500">{item.reviewCount} review(s)</span>,
    },
    {
      header: 'Status',
      render: item => <StatusBadge status={item.staff.status} />,
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
          <button onClick={fetchReviews} className="btn-secondary text-xs py-1 px-2.5">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="card overflow-hidden xl:col-span-2">
          <div className="card-header flex items-center justify-between">
            <div>
              <h2 className="card-title">Employee Performance Directory</h2>
              <span className="text-xs text-slate-400">Select an employee row to view their history</span>
            </div>
            <button className="btn-primary text-xs py-1.5" onClick={() => setReviewOpen(true)}>
              <Plus size={13} /> Record Review
            </button>
          </div>
          <DataTable
            columns={columns}
            rows={employeeRatings}
            rowKey={item => item.staff.id}
            onRowClick={item => setSelectedStaffId(item.staff.id)}
            emptyTitle="No employees available for evaluation"
          />
        </div>

        {currentStaff && (
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="card-title">Evaluation History</h2>
              <span className="badge badge-teal font-bold">{staffReviews.length} reviews</span>
            </div>
            <div className="card-body flex flex-col gap-4">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Avatar name={currentStaff.fullName} color={ACCENT.hr} size={36} />
                <div>
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">{currentStaff.fullName}</h3>
                  <p className="text-xs text-slate-500">{currentStaff.jobTitle} · {currentStaff.employeeCode}</p>
                </div>
              </div>

              {chartData.length > 1 ? (
                <div>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 block">
                    Rating Progression
                  </span>
                  <div style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                        <YAxis domain={[1, 5]} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Line dataKey="rating" name="Rating" stroke="#2A8C82" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-2.5 max-h-[320px] overflow-y-auto">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Recorded Reviews</span>
                {staffReviews.length > 0 ? (
                  staffReviews.map(r => (
                    <div key={r.id} className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col gap-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 dark:text-slate-100">{r.reviewPeriod || 'Annual'}</span>
                        <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                          <Star size={12} className="fill-amber-500 text-amber-500" />
                          {Number(r.rating).toFixed(1)}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 italic mt-0.5 leading-relaxed">
                        "{r.feedback}"
                      </p>
                      {r.strengths && (
                        <div className="text-emerald-700 dark:text-emerald-400 text-[11px] mt-0.5">
                          <strong>Strengths:</strong> {r.strengths}
                        </div>
                      )}
                      {r.improvementAreas && (
                        <div className="text-amber-700 dark:text-amber-400 text-[11px]">
                          <strong>Improvement:</strong> {r.improvementAreas}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400 mt-1">Reviewed on {r.reviewedOn}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-4 text-center">No reviews recorded yet for this employee.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Record Review Modal */}
      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="Record Performance Review"
        submitLabel={saving ? 'Saving...' : 'Save Performance Review'}
        onSubmit={handleAddReview}
      >
        {formError && (
          <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs mb-3 flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{formError}</span>
          </div>
        )}
        <SelectField
          label="Select Employee *"
          value={employees.find(e => e.id === formStaffId)?.fullName || ''}
          onChange={v => {
            const found = employees.find(e => e.fullName === v);
            setFormStaffId(found ? found.id : '');
          }}
          options={employees.map(e => e.fullName)}
          wide
        />
        <SelectField
          label="Review Period *"
          value={formPeriod}
          onChange={setFormPeriod}
          options={['Q1 2026', 'Q2 2026', 'Mid-Year 2026', 'Q3 2026', 'Q4 2026', 'Annual 2025', 'Probation Review']}
        />
        <TextField
          label="Rating (1.0 to 5.0) *"
          type="number"
          value={formRating}
          onChange={setFormRating}
          placeholder="e.g. 4.5"
          required
        />
        <TextField
          label="Key Strengths Identified"
          value={formStrengths}
          onChange={setFormStrengths}
          placeholder="e.g. Excellent team leadership, reliable project delivery"
          wide
        />
        <TextField
          label="Improvement Areas"
          value={formImprovements}
          onChange={setFormImprovements}
          placeholder="e.g. Technical reporting documentation, delegation"
          wide
        />
        <TextAreaField
          label="Detailed Review Feedback & Guidance *"
          value={formFeedback}
          onChange={setFormFeedback}
          placeholder="Provide substantive evaluation remarks and constructive feedback..."
        />
      </Modal>
    </div>
  );
}
