import { useEffect, useState } from 'react';
import { Award, CheckCircle2, AlertCircle, RefreshCw, Printer, FileText } from 'lucide-react';
import { DataTable, DetailDrawer, Modal, SelectField, StatusBadge, TextAreaField, TextField, ACCENT, type Column } from '../../../components/people';
import { peopleApi, type InternProfile, type InternCertificateRecord, type Department } from '../../../services/peopleApi';

interface Props {
  interns: InternProfile[];
  departments: Department[];
  onRefreshStats?: () => void;
}

export default function CompletionTab({ interns, departments, onRefreshStats }: Props) {
  const [certificates, setCertificates] = useState<InternCertificateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [selectedInternId, setSelectedInternId] = useState<string>(
    interns.find(i => i.status === 'Completed')?.id ?? interns[0]?.id ?? ''
  );

  // Complete Intern Modal
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [targetIntern, setTargetIntern] = useState<InternProfile | null>(null);
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().slice(0, 10));
  const [finalEvaluationText, setFinalEvaluationText] = useState('');
  const [savingCompletion, setSavingCompletion] = useState(false);

  // Certificate Generation
  const [generating, setGenerating] = useState(false);

  const deptMap = new Map(departments.map(d => [d.id, d.name]));

  const fetchCertificates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await peopleApi.getInternCertificates({ limit: 100 });
      setCertificates(res.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load certificate records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCertificates();
  }, []);

  const printCertificate = (
    name: string,
    dept: string,
    start: string,
    end: string,
    certNum: string,
    issuedOn: string
  ) => {
    const popup = window.open('', '_blank', 'width=950,height=720');
    if (!popup) return;
    const html = `<!doctype html>
<html>
<head>
  <title>Certificate of Internship - ${name}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { margin: 0; background: linear-gradient(135deg, #F0FDF4, #F8FAFC); font-family: Georgia, serif; color: #1E293B; }
    .certificate {
      max-width: 900px; margin: 20px auto; border: 12px solid #C8A96B; border-radius: 16px;
      background: #FFFFFF; padding: 36px 48px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); position: relative;
    }
    .inner-border {
      border: 2px solid #2A8C82; padding: 28px; text-align: center; border-radius: 8px; position: relative;
    }
    .org-title { font-size: 26px; font-weight: bold; color: #243247; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
    .org-subtitle { font-size: 13px; color: #2A8C82; font-style: italic; letter-spacing: 1px; margin-bottom: 24px; }
    .cert-heading { font-size: 34px; font-weight: 700; color: #243247; margin: 8px 0; font-family: 'Times New Roman', serif; }
    .presented-to { font-size: 14px; color: #64748B; text-transform: uppercase; letter-spacing: 2px; margin-top: 16px; }
    .recipient-name { font-size: 32px; font-weight: bold; color: #1E293B; border-bottom: 2px solid #2A8C82; display: inline-block; padding: 4px 32px; margin: 12px 0; }
    .body-text { font-size: 15px; color: #475569; line-height: 1.8; max-width: 700px; margin: 14px auto; }
    .seal-box { position: absolute; top: 20px; right: 24px; width: 75px; height: 75px; border: 3px double #C8A96B; border-radius: 50%; display: grid; place-items: center; color: #C8A96B; font-size: 10px; font-weight: bold; text-align: center; }
    .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 20px; border-top: 1px solid #E2E8F0; }
    .sig-block { width: 200px; text-align: center; font-size: 13px; color: #475569; }
    .sig-line { border-top: 2px solid #243247; margin-bottom: 6px; padding-top: 6px; font-weight: bold; }
    .cert-meta { font-size: 11px; color: #94A3B8; text-align: left; }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="inner-border">
      <div class="seal-box">HOPE<br/>SEAL</div>
      <div class="org-title">Hope Foundation</div>
      <div class="org-subtitle">Empowering Communities, Transforming Lives</div>
      <div class="cert-heading">Certificate of Internship Completion</div>
      <div class="presented-to">This is proudly awarded to</div>
      <div class="recipient-name">${name}</div>
      <p class="body-text">
        for successfully completing the internship program with the <strong>${dept}</strong> department from <strong>${start}</strong> to <strong>${end}</strong>. During this tenure, the candidate demonstrated commendable dedication, professional ethics, and active contribution to our social welfare initiatives.
      </p>
      <div class="footer">
        <div class="cert-meta">
          <div>Certificate ID: <strong>${certNum}</strong></div>
          <div>Issued On: ${issuedOn}</div>
        </div>
        <div class="sig-block">
          <div class="sig-line">Director / HR Head</div>
          Hope Foundation Management
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    setTimeout(() => {
      try {
        popup.print();
      } catch (e) {
        /* noop */
      }
    }, 400);
  };

  const handleOpenCompleteModal = (intern: InternProfile) => {
    setTargetIntern(intern);
    setCompletionDate(intern.endsOn || new Date().toISOString().slice(0, 10));
    setFinalEvaluationText('');
    setCompleteModalOpen(true);
  };

  const handleSaveCompletion = async () => {
    if (!targetIntern) return;
    setSavingCompletion(true);
    try {
      await peopleApi.updateInternProfile(targetIntern.id, {
        status: 'Completed',
        endsOn: completionDate,
      });

      setNotification(`Internship marked as Completed for ${targetIntern.fullName || targetIntern.internCode}.`);
      setCompleteModalOpen(false);
      onRefreshStats?.();
    } catch (err: any) {
      setError(err?.message || 'Failed to update completion status.');
    } finally {
      setSavingCompletion(false);
    }
  };

  const handleGenerateCertificate = async (intern: InternProfile) => {
    setGenerating(true);
    try {
      const certNum = `CERT-INT-${Date.now().toString().slice(-6)}`;
      const todayStr = new Date().toISOString().slice(0, 10);
      const deptName = (intern.departmentId && deptMap.get(intern.departmentId)) || 'Hope Foundation Programs';

      await peopleApi.createInternCertificate({
        internId: intern.id,
        certificateNumber: certNum,
        issuedOn: todayStr,
        finalEvaluation: 'Excellent performance throughout internship tenure.',
      });

      await peopleApi.updateInternProfile(intern.id, {
        certificateStatus: 'Generated',
      });

      setNotification(`Certificate ${certNum} generated successfully for ${intern.fullName || intern.internCode}!`);
      await fetchCertificates();
      onRefreshStats?.();

      // Open print preview
      printCertificate(
        intern.fullName || intern.internCode || 'Intern',
        deptName,
        intern.startsOn || 'Program Start',
        intern.endsOn || todayStr,
        certNum,
        new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      );
    } catch (err: any) {
      setError(err?.message || 'Certificate generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const selectedIntern = interns.find(i => i.id === selectedInternId);
  const internCert = certificates.find(c => c.internId === selectedInternId);

  const cols: Column<InternProfile>[] = [
    {
      header: 'Intern',
      render: i => (
        <div>
          <div className="font-semibold text-slate-800 dark:text-slate-100">{i.fullName || 'Intern'}</div>
          <div className="text-xs font-mono text-slate-400">{i.internCode}</div>
        </div>
      ),
    },
    {
      header: 'Department',
      render: i => (
        <span className="text-xs text-slate-600 dark:text-slate-300">
          {(i.departmentId && deptMap.get(i.departmentId)) || 'Unassigned'}
        </span>
      ),
    },
    {
      header: 'Tenure',
      render: i => (
        <span className="text-xs text-slate-500">
          {i.startsOn || 'TBD'} → {i.endsOn || 'TBD'}
        </span>
      ),
    },
    {
      header: 'Status',
      render: i => <StatusBadge status={i.status} />,
    },
    {
      header: 'Certificate',
      render: i => <StatusBadge status={i.certificateStatus || 'Pending'} />,
    },
    {
      header: 'Actions',
      render: i => (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          {i.status !== 'Completed' ? (
            <button
              onClick={() => handleOpenCompleteModal(i)}
              className="px-2 py-1 text-xs font-semibold rounded bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-300"
              title="Mark as Completed"
            >
              Mark Done
            </button>
          ) : (
            <button
              onClick={() => void handleGenerateCertificate(i)}
              disabled={generating}
              className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 flex items-center gap-1"
              title="Generate / Print Certificate"
            >
              <Award size={13} />
              <span>{i.certificateStatus === 'Generated' ? 'Re-Print' : 'Generate'}</span>
            </button>
          )}
        </div>
      ),
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
          <button onClick={() => void fetchCertificates()} className="ml-auto underline text-xs font-semibold">
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Table of Interns and Completion Status */}
        <div className="card overflow-hidden xl:col-span-2">
          <div className="card-header flex items-center justify-between">
            <div>
              <h2 className="card-title">Internship Completion & Certificates</h2>
              <p className="text-xs text-slate-500">Record program completion, evaluate outcomes, and issue official certificates.</p>
            </div>
            <button
              onClick={() => void fetchCertificates()}
              className="btn-secondary !p-1.5"
              title="Refresh certificate records"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <DataTable
            columns={cols}
            rows={interns}
            rowKey={i => i.id}
            onRowClick={i => setSelectedInternId(i.id)}
            emptyTitle="No interns currently registered"
          />
        </div>

        {/* Selected Intern Certificate / Completion Card */}
        <div className="card flex flex-col">
          <div className="card-header">
            <h3 className="card-title">Certificate Details & Preview</h3>
          </div>
          <div className="card-body flex-1 flex flex-col gap-4">
            {selectedIntern ? (
              <>
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {selectedIntern.fullName || selectedIntern.internCode}
                    </span>
                    <StatusBadge status={selectedIntern.status} />
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <div>Department: <strong>{(selectedIntern.departmentId && deptMap.get(selectedIntern.departmentId)) || 'Unassigned'}</strong></div>
                    <div>Period: {selectedIntern.startsOn || 'TBD'} to {selectedIntern.endsOn || 'TBD'}</div>
                    <div>Certificate: <StatusBadge status={selectedIntern.certificateStatus || 'Pending'} /></div>
                  </div>
                </div>

                {internCert && (
                  <div className="p-3 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-950/20 text-xs space-y-1.5">
                    <div className="font-semibold text-teal-800 dark:text-teal-200 flex items-center gap-1.5">
                      <Award size={14} /> Issued Certificate
                    </div>
                    <div>Certificate ID: <strong className="font-mono">{internCert.certificateNumber}</strong></div>
                    <div>Issued Date: {internCert.issuedOn}</div>
                    {internCert.finalEvaluation && (
                      <p className="text-slate-600 dark:text-slate-300 italic pt-1 border-t border-teal-100 dark:border-teal-900">
                        "{internCert.finalEvaluation}"
                      </p>
                    )}
                  </div>
                )}

                <div className="pt-2 flex flex-col gap-2">
                  {selectedIntern.status !== 'Completed' ? (
                    <button
                      onClick={() => handleOpenCompleteModal(selectedIntern)}
                      className="btn-primary w-full text-xs !py-2 flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 size={15} />
                      <span>Mark Internship as Completed</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => void handleGenerateCertificate(selectedIntern)}
                      disabled={generating}
                      className="btn-primary w-full text-xs !py-2 flex items-center justify-center gap-1.5"
                    >
                      <Printer size={15} />
                      <span>{generating ? 'Processing...' : 'Generate & Print Certificate'}</span>
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center text-xs text-slate-400 py-10">
                Select an intern to view certificate actions.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Complete Intern Modal */}
      <Modal
        open={completeModalOpen}
        onClose={() => setCompleteModalOpen(false)}
        title={`Complete Internship: ${targetIntern?.fullName || targetIntern?.internCode}`}
        submitLabel={savingCompletion ? 'Saving...' : 'Confirm Completion'}
        onSubmit={handleSaveCompletion}
      >
        <div className="col-span-1 sm:col-span-2 text-xs text-slate-500 mb-2">
          Confirm that the intern has finished assigned deliverables and fulfilled internship requirements.
        </div>
        <TextField
          label="Completion Date"
          type="date"
          value={completionDate}
          onChange={setCompletionDate}
          required
        />
        <div className="col-span-1 sm:col-span-2">
          <TextAreaField
            label="Final Evaluation Remarks"
            value={finalEvaluationText}
            onChange={setFinalEvaluationText}
            placeholder="Summarize project performance, key competencies exhibited, and recommendations..."
          />
        </div>
      </Modal>
    </div>
  );
}
