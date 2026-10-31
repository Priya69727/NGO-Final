import { useEffect, useState } from 'react';
import { Plus, RefreshCw, AlertCircle } from 'lucide-react';
import { PageHeader, PageTabs, ACCENT } from '../../components/people';
import DashboardTab from './hr/DashboardTab';
import DepartmentsTab from './hr/DepartmentsTab';
import EmployeesTab from './hr/EmployeesTab';
import RequirementsTab from './hr/RequirementsTab';
import RecruitmentTab from './hr/RecruitmentTab';
import AttendanceTab from './hr/AttendanceTab';
import PerformanceTab from './hr/PerformanceTab';
import PayrollTab from './hr/PayrollTab';
import ReportsTab from './hr/ReportsTab';
import { peopleApi, type Department, type StaffProfile, type HrRequirement } from '../../services/peopleApi';

const TABS = [
  { id: 'dashboard', label: 'HR Dashboard' },
  { id: 'employees', label: 'Employees' },
  { id: 'departments', label: 'Departments' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'recruitment', label: 'Recruitment & Applicants' },
  { id: 'attendance', label: 'Attendance & Leave' },
  { id: 'performance', label: 'Performance' },
  { id: 'payroll', label: 'Payroll & Finance' },
  { id: 'reports', label: 'Reports & Exports' },
];

export default function HRPage() {
  const [tab, setTab] = useState('dashboard');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<StaffProfile[]>([]);
  const [requirements, setRequirements] = useState<HrRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [activeRequirementIdForRecruitment, setActiveRequirementIdForRecruitment] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [deptRes, empRes, reqRes] = await Promise.all([
        peopleApi.getDepartments(),
        peopleApi.getEmployees({ limit: 100 }),
        peopleApi.getRequirements({ limit: 100 }),
      ]);
      setDepartments(deptRes.items);
      setEmployees(empRes.items);
      setRequirements(reqRes.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load HR management data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSelectRequirementForRecruitment = (reqId: string) => {
    setActiveRequirementIdForRecruitment(reqId);
    setTab('recruitment');
  };

  const handleEmployeeCreated = () => {
    void loadData();
    setTab('employees');
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="HR & Workforce Management"
        subtitle="Manage employees, organizational departments, hiring requirements, recruitment pipeline, attendance, performance, and payroll."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadData()}
              className="btn-secondary !p-2"
              title="Refresh all HR data"
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              className="btn-primary flex items-center gap-1.5"
              onClick={() => {
                setTab('employees');
                setAddEmployeeOpen(true);
              }}
            >
              <Plus size={16} /> Add Employee
            </button>
          </div>
        }
      />

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => void loadData()} className="ml-auto underline text-xs font-semibold">
            Retry
          </button>
        </div>
      )}

      <PageTabs tabs={TABS} active={tab} onChange={setTab} accent={ACCENT.hr} />

      {tab === 'dashboard' && <DashboardTab onNavigateTab={setTab} />}

      {tab === 'employees' && (
        <EmployeesTab
          departments={departments}
          addOpen={addEmployeeOpen}
          setAddOpen={setAddEmployeeOpen}
          onRefreshStats={() => void loadData()}
        />
      )}

      {tab === 'departments' && (
        <DepartmentsTab departments={departments} employees={employees} requirements={requirements} />
      )}

      {tab === 'requirements' && (
        <RequirementsTab
          departments={departments}
          onRefreshStats={() => void loadData()}
          onSelectRequirementForRecruitment={handleSelectRequirementForRecruitment}
        />
      )}

      {tab === 'recruitment' && (
        <RecruitmentTab
          departments={departments}
          requirements={requirements}
          activeRequirementId={activeRequirementIdForRecruitment}
          onRefreshStats={() => void loadData()}
          onEmployeeCreated={handleEmployeeCreated}
        />
      )}

      {tab === 'attendance' && (
        <AttendanceTab employees={employees} onRefreshStats={() => void loadData()} />
      )}

      {tab === 'performance' && (
        <PerformanceTab employees={employees} onRefreshStats={() => void loadData()} />
      )}

      {tab === 'payroll' && (
        <PayrollTab employees={employees} onRefreshStats={() => void loadData()} />
      )}

      {tab === 'reports' && (
        <ReportsTab departments={departments} employees={employees} requirements={requirements} />
      )}
    </div>
  );
}
