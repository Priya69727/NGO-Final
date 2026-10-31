import { Users, Building2, ClipboardList, DollarSign } from 'lucide-react';
import { ReportGrid, ACCENT } from '../../../components/people';
import type { Department, StaffProfile, HrRequirement } from '../../../services/peopleApi';

interface Props {
  departments: Department[];
  employees: StaffProfile[];
  requirements: HrRequirement[];
}

export default function ReportsTab({ departments, employees, requirements }: Props) {
  const deptMap = new Map(departments.map(d => [d.id, d.name]));

  const employeeRows = employees.map(e => ({
    'Employee Code': e.employeeCode || '—',
    'Full Name': e.fullName,
    'Email': e.email || '—',
    'Phone': e.phone || '—',
    'Department': (e.departmentId && deptMap.get(e.departmentId)) || 'Unassigned',
    'Job Title': e.jobTitle || 'Staff',
    'Employment Type': e.employmentType || 'Full-time',
    'Status': e.status,
    'Hired Date': e.hiredOn || '—',
    'Base Salary': e.salary ? `₹${e.salary}` : '—',
  }));

  const departmentRows = departments.map(d => {
    const deptEmps = employees.filter(e => e.departmentId === d.id);
    const deptReqs = requirements.filter(r => r.departmentId === d.id);
    return {
      'Department Name': d.name,
      'Department Code': d.code || '—',
      'Total Employees': deptEmps.length,
      'Active Employees': deptEmps.filter(e => e.status === 'Active').length,
      'Open Requirements': deptReqs.filter(r => r.status !== 'Fulfilled' && r.status !== 'Filled' && r.status !== 'Cancelled').length,
      'Description': d.description || '—',
    };
  });

  const requirementRows = requirements.map(r => ({
    'Requirement ID': r.id,
    'Role / Title': r.title,
    'Designation': r.designation || r.title,
    'Department': (r.departmentId && deptMap.get(r.departmentId)) || 'Unassigned',
    'Openings': r.openings,
    'Urgency': r.urgency,
    'Experience Required (Yrs)': r.experienceYears ?? 0,
    'Qualification': r.qualification || '—',
    'Status': r.status,
    'Opened On': r.openedOn || '—',
    'Closing Date': r.closesOn || '—',
  }));

  const payrollSummaryRows = employees
    .filter(e => e.salary && e.salary > 0)
    .map(e => ({
      'Employee Code': e.employeeCode || '—',
      'Full Name': e.fullName,
      'Department': (e.departmentId && deptMap.get(e.departmentId)) || 'Unassigned',
      'Designation': e.jobTitle || 'Staff',
      'Status': e.status,
      'Basic Salary': e.salary ?? 0,
      'Estimated Annual CTC': (e.salary ?? 0) * 12,
    }));

  return (
    <ReportGrid
      accent={ACCENT.hr}
      reports={[
        {
          title: 'Employee Directory Report',
          description: 'Export all employee profiles, departments, job designations, status, and contact details.',
          icon: <Users size={18} />,
          rows: employeeRows,
        },
        {
          title: 'Department Headcount Report',
          description: 'Departmental staff distribution, active headcount, and hiring requirements overview.',
          icon: <Building2 size={18} />,
          rows: departmentRows,
        },
        {
          title: 'HR Requirements & Hiring Pipeline',
          description: 'Hiring needs, open positions, experience requirements, urgency levels, and closure targets.',
          icon: <ClipboardList size={18} />,
          rows: requirementRows,
        },
        {
          title: 'Compensation & Payroll Estimate',
          description: 'Salary structures and compensation data for all active organization staff.',
          icon: <DollarSign size={18} />,
          rows: payrollSummaryRows,
        },
      ]}
    />
  );
}
