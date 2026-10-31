import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { PageHeader, PageTabs, ACCENT } from '../../components/people';
import DashboardTab from './intern/DashboardTab';
import ApplicationsTab from './intern/ApplicationsTab';
import InternListTab from './intern/InternListTab';
import WorkTab from './intern/WorkTab';
import FeedbackTab from './intern/FeedbackTab';
import CompletionTab from './intern/CompletionTab';
import ReportsTab from './intern/ReportsTab';
import { peopleApi, type Department, type InternApplication, type InternProfile, type StaffProfile } from '../../services/peopleApi';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'applications', label: 'Applications' },
  { id: 'list', label: 'Intern List' },
  { id: 'work', label: 'Internship Work' },
  { id: 'feedback', label: 'Attendance & Feedback' },
  { id: 'completion', label: 'Completion & Certificate' },
  { id: 'reports', label: 'Reports' },
];

export default function InternsPage() {
  const [tab, setTab] = useState('dashboard');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [mentors, setMentors] = useState<StaffProfile[]>([]);
  const [interns, setInterns] = useState<InternProfile[]>([]);
  const [applications, setApplications] = useState<InternApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [departmentResponse, employeeResponse, internResponse, applicationResponse] = await Promise.all([
        peopleApi.getDepartments(),
        peopleApi.getEmployees({ limit: 200 }),
        peopleApi.getInternProfiles({ limit: 200 }),
        peopleApi.getInternApplications({ limit: 200 }),
      ]);
      setDepartments(departmentResponse.items);
      setMentors(employeeResponse.items.filter(employee => employee.status === 'Active'));
      setInterns(internResponse.items);
      setApplications(applicationResponse.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load internship data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onInternCreated = () => {
    void loadData();
    setTab('list');
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Intern Management"
        subtitle="Manage applications, interns, internship work, mentor feedback and completion records."
        action={
          <button
            onClick={() => void loadData()}
            className="btn-secondary !p-2"
            title="Refresh internship data"
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />
      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => void loadData()} className="ml-auto text-xs font-semibold underline">Retry</button>
        </div>
      )}
      {!error && loading && (
        <div role="status" className="text-sm text-slate-500">Loading internship records…</div>
      )}
      <PageTabs tabs={TABS} active={tab} onChange={setTab} accent={ACCENT.intern} />
      {tab === 'dashboard' && <DashboardTab onNavigateTab={setTab} />}
      {tab === 'applications' && (
        <ApplicationsTab
          departments={departments}
          mentors={mentors}
          onRefreshStats={() => void loadData()}
          onInternCreated={onInternCreated}
        />
      )}
      {tab === 'list' && (
        <InternListTab
          departments={departments}
          mentors={mentors}
          onRefreshStats={() => void loadData()}
        />
      )}
      {tab === 'work' && <WorkTab interns={interns} onRefreshStats={() => void loadData()} />}
      {tab === 'feedback' && <FeedbackTab interns={interns} onRefreshStats={() => void loadData()} />}
      {tab === 'completion' && (
        <CompletionTab interns={interns} departments={departments} onRefreshStats={() => void loadData()} />
      )}
      {tab === 'reports' && <ReportsTab applications={applications} interns={interns} />}
    </div>
  );
}
