import { useState } from 'react';
import { DataTable, DetailDrawer, SectionTitle, StatusBadge, ACCENT, Avatar, type Column } from '../../../components/people';
import type { Department, StaffProfile, HrRequirement } from '../../../services/peopleApi';

interface Props {
  departments: Department[];
  employees: StaffProfile[];
  requirements: HrRequirement[];
}

export default function DepartmentsTab({ departments, employees, requirements }: Props) {
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);

  const getDeptEmployees = (deptId: string) => employees.filter(e => e.departmentId === deptId);
  const getDeptRequirements = (deptId: string) => requirements.filter(r => r.departmentId === deptId);

  const cols: Column<Department>[] = [
    {
      header: 'Department',
      render: d => (
        <div>
          <span className="font-semibold text-slate-800 dark:text-slate-100">{d.name}</span>
          {d.code && <span className="ml-2 text-xs font-mono text-slate-400">({d.code})</span>}
        </div>
      ),
    },
    {
      header: 'Description',
      render: d => <span className="text-xs text-slate-500 max-w-xs truncate block">{d.description || '—'}</span>,
    },
    {
      header: 'Total Employees',
      render: d => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
          {getDeptEmployees(d.id).length}
        </span>
      ),
    },
    {
      header: 'Active Staff',
      render: d => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {getDeptEmployees(d.id).filter(e => e.status === 'Active').length}
        </span>
      ),
    },
    {
      header: 'Open Requirements',
      render: d => {
        const openReqs = getDeptRequirements(d.id).filter(r => r.status !== 'Fulfilled' && r.status !== 'Filled' && r.status !== 'Cancelled' && r.status !== 'Rejected');
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${openReqs.length > 0 ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-slate-100 text-slate-500'}`}>
            {openReqs.length}
          </span>
        );
      },
    },
  ];

  const deptEmps = selectedDept ? getDeptEmployees(selectedDept.id) : [];
  const deptReqs = selectedDept ? getDeptRequirements(selectedDept.id) : [];

  return (
    <>
      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <div>
            <h2 className="card-title">All Organisation Departments</h2>
            <p className="text-xs text-slate-500">Live departments registered in the NGO database. Click a department for staffing details.</p>
          </div>
          <span className="text-xs text-slate-400 font-medium">{departments.length} Departments</span>
        </div>
        <DataTable columns={cols} rows={departments} rowKey={d => d.id} onRowClick={setSelectedDept} />
      </div>

      <DetailDrawer
        open={!!selectedDept}
        onClose={() => setSelectedDept(null)}
        title={selectedDept?.name ?? ''}
        subtitle={selectedDept?.description || (selectedDept?.code ? `Code: ${selectedDept.code}` : 'Department overview')}
        accent={ACCENT.hr}
      >
        {selectedDept && (
          <div className="flex flex-col gap-6">
            <section>
              <SectionTitle>Department Information</SectionTitle>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Department Name:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{selectedDept.name}</span>
                </div>
                {selectedDept.code && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Department Code:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">{selectedDept.code}</span>
                  </div>
                )}
                {selectedDept.description && (
                  <div className="text-sm pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 block text-xs mb-1">Description:</span>
                    <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">{selectedDept.description}</p>
                  </div>
                )}
              </div>
            </section>

            <section>
              <SectionTitle>Assigned Employees ({deptEmps.length})</SectionTitle>
              {deptEmps.length > 0 ? (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {deptEmps.map(e => (
                    <li key={e.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={e.fullName} color={ACCENT.hr} size={32} />
                        <div>
                          <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{e.fullName}</div>
                          <div className="text-xs text-slate-400">{e.jobTitle || 'Staff Member'} · {e.employeeCode}</div>
                        </div>
                      </div>
                      <StatusBadge status={e.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500 italic">No employees currently assigned to this department.</p>
              )}
            </section>

            <section>
              <SectionTitle>HR Requirements ({deptReqs.length})</SectionTitle>
              {deptReqs.length > 0 ? (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {deptReqs.map(r => (
                    <li key={r.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{r.title}</div>
                        <div className="text-xs text-slate-400">
                          {r.designation || 'Staff'} · {r.openings} opening(s) · {r.urgency} Urgency
                        </div>
                      </div>
                      <StatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500 italic">No open hiring requirements for this department.</p>
              )}
            </section>
          </div>
        )}
      </DetailDrawer>
    </>
  );
}
