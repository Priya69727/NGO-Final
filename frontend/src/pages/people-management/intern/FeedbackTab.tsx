import { useEffect, useState } from 'react';
import { CalendarCheck, Star, Plus, CheckCircle2, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import { Avatar, DataTable, Modal, ProgressBar, SelectField, StatusBadge, TextAreaField, TextField, ACCENT, type Column } from '../../../components/people';
import { peopleApi, type InternProfile, type InternAttendanceRecord, type InternFeedbackRecord } from '../../../services/peopleApi';

interface Props {
  interns: InternProfile[];
  onRefreshStats?: () => void;
}

export default function FeedbackTab({ interns, onRefreshStats }: Props) {
  const [attendanceRecords, setAttendanceRecords] = useState<InternAttendanceRecord[]>([]);
  const [feedbackRecords, setFeedbackRecords] = useState<InternFeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [selectedInternId, setSelectedInternId] = useState<string>(interns[0]?.id || '');

  // Mark Attendance Modal
  const [attOpen, setAttOpen] = useState(false);
  const [attInternId, setAttInternId] = useState(interns[0]?.id || '');
  const [attDate, setAttDate] = useState(new Date().toISOString().slice(0, 10));
  const [attStatus, setAttStatus] = useState<InternAttendanceRecord['status']>('Present');
  const [attNote, setAttNote] = useState('');
  const [attError, setAttError] = useState('');
  const [attSaving, setAttSaving] = useState(false);

  // Add Feedback Modal
  const [fbOpen, setFbOpen] = useState(false);
  const [fbInternId, setFbInternId] = useState(interns[0]?.id || '');
  const [fbRating, setFbRating] = useState('4.5');
  const [fbText, setFbText] = useState('');
  const [fbSaving, setFbSaving] = useState(false);
  const [fbError, setFbError] = useState('');

  const internMap = new Map(interns.map(i => [i.id, i.fullName || i.internCode]));

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [attRes, fbRes] = await Promise.all([
        peopleApi.getInternAttendance({ limit: 150 }),
        peopleApi.getInternFeedback({ limit: 100 }),
      ]);
      setAttendanceRecords(attRes.items);
      setFeedbackRecords(fbRes.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load attendance and feedback.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const handleMarkAttendance = async () => {
    if (!attInternId || !attDate) {
      setAttError('Please select an intern and attendance date.');
      return;
    }

    // Duplicate check
    const existing = attendanceRecords.find(
      r => r.internId === attInternId && r.attendanceDate === attDate
    );
    if (existing) {
      setAttError(`Attendance for ${internMap.get(attInternId)} on ${attDate} already exists.`);
      return;
    }

    setAttSaving(true);
    setAttError('');
    try {
      await peopleApi.createInternAttendance({
        internId: attInternId,
        attendanceDate: attDate,
        status: attStatus,
        note: attNote.trim() || undefined,
      });

      setNotification(`Attendance marked for ${internMap.get(attInternId)}.`);
      setAttOpen(false);
      setAttNote('');
      await fetchData();
      onRefreshStats?.();
    } catch (err: any) {
      setAttError(err?.message || 'Failed to record attendance.');
    } finally {
      setAttSaving(false);
    }
  };

  const handleSaveFeedback = async () => {
    if (!fbInternId || !fbText.trim()) {
      setFbError('Please provide feedback comments.');
      return;
    }
    setFbSaving(true);
    setFbError('');
    try {
      const ratingNum = Math.min(5, Math.max(1, parseFloat(fbRating) || 4));
      await peopleApi.createInternFeedback({
        internId: fbInternId,
        feedbackDate: new Date().toISOString().slice(0, 10),
        rating: ratingNum,
        feedback: fbText.trim(),
      });

      setNotification(`Feedback recorded for ${internMap.get(fbInternId)}.`);
      setFbOpen(false);
      setFbText('');
      await fetchData();
    } catch (err: any) {
      setFbError(err?.message || 'Failed to record feedback.');
    } finally {
      setFbSaving(false);
    }
  };

  const selectedIntern = interns.find(i => i.id === selectedInternId);
  const internAttendance = attendanceRecords.filter(a => a.internId === selectedInternId);
  const internFeedbackList = feedbackRecords.filter(f => f.internId === selectedInternId);

  // Calculate stats for current selected intern
  const presentDays = internAttendance.filter(a => a.status === 'Present').length;
  const totalDays = internAttendance.length;
  const attPct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

  const cols: Column<InternProfile>[] = [
    {
      header: 'Intern',
      render: i => (
        <div className="flex items-center gap-2.5">
          <Avatar name={i.fullName || i.internCode || 'Intern'} color={ACCENT.intern} size={32} />
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-100">{i.fullName || 'Intern'}</div>
            <div className="text-xs text-slate-400 font-mono">{i.internCode}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Attendance Ratio',
      render: i => {
        const records = attendanceRecords.filter(a => a.internId === i.id);
        const pres = records.filter(a => a.status === 'Present').length;
        const tot = records.length;
        const pct = tot > 0 ? Math.round((pres / tot) * 100) : 100;
        return (
          <div className="w-28">
            <div className="flex justify-between text-[11px] mb-0.5">
              <span>{pct}%</span>
              <span className="text-slate-400">({pres}/{tot})</span>
            </div>
            <ProgressBar value={pct} color={pct >= 85 ? '#10B981' : pct >= 70 ? '#F59E0B' : '#EF4444'} />
          </div>
        );
      },
    },
    {
      header: 'Progress',
      className: 'w-28',
      render: i => <ProgressBar value={i.progress ?? 0} color={ACCENT.intern} />,
    },
    {
      header: 'Status',
      render: i => <StatusBadge status={i.status} />,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
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
          <button onClick={() => void fetchData()} className="ml-auto underline text-xs font-semibold">
            Retry
          </button>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
            Intern Attendance & Evaluation History
          </h2>
          <p className="text-xs text-slate-500">Record daily check-ins and mentor evaluation reviews.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchData()}
            className="btn-secondary !p-2"
            title="Refresh records"
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            className="btn-secondary flex items-center gap-1.5"
            onClick={() => {
              if (selectedInternId) setFbInternId(selectedInternId);
              setFbOpen(true);
            }}
          >
            <Star size={15} /> Add Evaluation
          </button>
          <button
            className="btn-primary flex items-center gap-1.5"
            onClick={() => {
              if (selectedInternId) setAttInternId(selectedInternId);
              setAttOpen(true);
            }}
          >
            <CalendarCheck size={16} /> Mark Attendance
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Interns Table */}
        <div className="card overflow-hidden xl:col-span-2">
          <div className="card-header flex items-center justify-between">
            <h3 className="card-title">Intern Attendance & Progress Overview</h3>
            <span className="text-xs text-slate-400">Click row to inspect records</span>
          </div>
          <DataTable
            columns={cols}
            rows={interns}
            rowKey={i => i.id}
            onRowClick={i => setSelectedInternId(i.id)}
            emptyTitle="No interns currently registered"
          />

          {/* Attendance History Drawer */}
          {selectedIntern && (
            <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Recent Attendance Logs: {selectedIntern.fullName || selectedIntern.internCode} ({attPct}%)
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {presentDays} Present / {totalDays} Recorded Days
                </span>
              </div>
              {internAttendance.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No attendance records logged yet for this intern.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {internAttendance.map(entry => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-white dark:bg-slate-800 p-2.5 border border-slate-200/80 dark:border-slate-700 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {entry.attendanceDate}
                        </span>
                        {entry.note && (
                          <span className="text-slate-400 ml-2">· {entry.note}</span>
                        )}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                          entry.status === 'Present'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : entry.status === 'Late'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                        }`}
                      >
                        {entry.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Feedback / Review Section */}
        <div className="card flex flex-col">
          <div className="card-header">
            <h3 className="card-title">Mentor Evaluation Reviews</h3>
          </div>
          <div className="card-body flex-1 flex flex-col gap-3">
            <div className="text-xs text-slate-500">
              Selected Intern:{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {selectedIntern?.fullName || selectedIntern?.internCode || 'None'}
              </strong>
            </div>

            {internFeedbackList.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 text-xs">
                <Star size={28} className="text-slate-300 mb-2 stroke-1" />
                <p>No mentor evaluations recorded yet for this intern.</p>
                <button
                  onClick={() => {
                    if (selectedInternId) setFbInternId(selectedInternId);
                    setFbOpen(true);
                  }}
                  className="mt-3 text-xs text-teal-600 font-semibold hover:underline"
                >
                  + Add First Evaluation
                </button>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[380px]">
                {internFeedbackList.map(fb => (
                  <div
                    key={fb.id}
                    className="p-3 rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {fb.feedbackDate}
                      </span>
                      <span className="inline-flex items-center gap-1 font-bold text-amber-500">
                        <Star size={12} fill="#F59E0B" />
                        {(fb.rating ?? 0).toFixed(1)} / 5.0
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {fb.feedback}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mark Attendance Modal */}
      <Modal
        open={attOpen}
        onClose={() => setAttOpen(false)}
        title="Record Intern Attendance"
        submitLabel={attSaving ? 'Recording...' : 'Record Attendance'}
        onSubmit={handleMarkAttendance}
      >
        {attError && (
          <div className="col-span-1 sm:col-span-2 p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">
            {attError}
          </div>
        )}
        <SelectField
          label="Intern"
          value={attInternId}
          onChange={setAttInternId}
          options={interns.map(i => ({ label: `${i.fullName || i.internCode} (${i.internCode})`, value: i.id }))}
          required
        />
        <TextField
          label="Attendance Date"
          type="date"
          value={attDate}
          onChange={setAttDate}
          required
        />
        <SelectField
          label="Attendance Status"
          value={attStatus}
          onChange={v => setAttStatus(v as InternAttendanceRecord['status'])}
          options={['Present', 'Late', 'Absent', 'Half Day']}
          required
        />
        <div className="col-span-1 sm:col-span-2">
          <TextField
            label="Notes or Remarks (Optional)"
            value={attNote}
            onChange={setAttNote}
            placeholder="e.g. Attended field outreach session"
          />
        </div>
      </Modal>

      {/* Add Mentor Feedback Modal */}
      <Modal
        open={fbOpen}
        onClose={() => setFbOpen(false)}
        title="Add Mentor Performance Evaluation"
        submitLabel={fbSaving ? 'Saving...' : 'Save Evaluation'}
        onSubmit={handleSaveFeedback}
      >
        {fbError && (
          <div className="col-span-1 sm:col-span-2 p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">
            {fbError}
          </div>
        )}
        <SelectField
          label="Intern"
          value={fbInternId}
          onChange={setFbInternId}
          options={interns.map(i => ({ label: `${i.fullName || i.internCode} (${i.internCode})`, value: i.id }))}
          required
        />
        <TextField
          label="Performance Rating (1.0 - 5.0)"
          type="number"
          step="0.1"
          value={fbRating}
          onChange={setFbRating}
          required
        />
        <div className="col-span-1 sm:col-span-2">
          <TextAreaField
            label="Detailed Feedback & Remarks"
            value={fbText}
            onChange={setFbText}
            placeholder="Evaluate punctuality, quality of deliverables, initiative, and teamwork..."
            required
          />
        </div>
      </Modal>
    </div>
  );
}
