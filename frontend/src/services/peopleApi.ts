import { apiRequest, apiList, apiCreate, apiUpdate, apiDelete, type ApiList } from './apiClient';

export interface Department {
  id: string;
  name: string;
  code?: string;
  description?: string;
  createdAt?: string;
}

export interface HrDashboardData {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  openRequirements: number;
  pendingLeaves: number;
  totalApplicants: number;
  attendanceSummary: {
    present: number;
    absent: number;
    late: number;
    leave: number;
    totalRecorded: number;
  };
  departmentDistribution: {
    departmentId: string;
    name: string;
    count: number;
  }[];
}

export interface InternDashboardData {
  totalInterns: number;
  activeInterns: number;
  completedInternships: number;
  totalApplications: number;
  newApplications: number;
  applicationsUnderReview: number;
  shortlisted: number;
  selected: number;
  departmentDistribution: {
    departmentId: string;
    name: string;
    count: number;
  }[];
}

export interface VolunteerDashboardData {
  totalVolunteers: number;
  activeVolunteers: number;
  totalApplications: number;
  newApplications: number;
  underReviewApplications: number;
  approvedApplications: number;
  activeAssignments: number;
  totalHours: number;
}

export interface StaffProfile {
  id: string;
  userId?: string | null;
  employeeCode: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  jobTitle: string;
  departmentId?: string | null;
  employmentType: string;
  hiredOn?: string | null;
  managerId?: string | null;
  salary?: number | null;
  status: 'Active' | 'On Leave' | 'Inactive';
  gender?: string | null;
  dateOfBirth?: string | null;
  address?: string;
  emergencyContact?: string;
  qualifications?: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface HrRequirement {
  id: string;
  title: string;
  departmentId?: string | null;
  urgency: 'Low' | 'Medium' | 'High' | 'Critical';
  openings: number;
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'In Progress' | 'Open' | 'Shortlisting' | 'On Hold' | 'Fulfilled' | 'Filled' | 'Rejected' | 'Cancelled';
  description: string;
  requiredSkills: string;
  openedOn: string;
  closesOn?: string | null;
  experienceYears?: number;
  qualification?: string;
  designation?: string;
  assignedHrId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface HrApplicant {
  id: string;
  requirementId?: string | null;
  fullName: string;
  email: string;
  phone?: string;
  qualification?: string;
  experienceYears?: number;
  skills?: string[];
  resumeUrl?: string | null;
  status: 'Applied' | 'Under Review' | 'Shortlisted' | 'Interview Scheduled' | 'Selected' | 'Rejected' | 'Hired';
  interviewDate?: string | null;
  interviewNotes?: string;
  rating?: number | null;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StaffAttendanceRecord {
  id: string;
  staffId: string;
  attendanceDate: string;
  checkIn?: string | null;
  checkOut?: string | null;
  status: 'Present' | 'Absent' | 'Late' | 'Leave' | 'Holiday';
  notes?: string;
  createdAt?: string;
}

export interface StaffLeaveApplication {
  id: string;
  staffId: string;
  leaveType: string;
  startsOn: string;
  endsOn: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  decisionNotes?: string;
  daysCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface StaffPerformanceReview {
  id: string;
  staffId: string;
  reviewerId?: string | null;
  reviewedOn: string;
  rating: number;
  scores?: Record<string, number>;
  feedback: string;
  reviewPeriod?: string;
  strengths?: string;
  improvementAreas?: string;
  createdAt?: string;
}

export interface StaffPayrollRecord {
  id: string;
  staffId: string;
  payrollPeriod: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  paymentStatus: 'Pending' | 'Processing' | 'Paid' | 'On Hold';
  paymentDate?: string | null;
  paymentMethod: string;
  transactionReference?: string | null;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InternApplication {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  areaOfInterest: string;
  appliedOn: string;
  status: 'New' | 'Applied' | 'Under Review' | 'Shortlisted' | 'Selected' | 'Accepted' | 'Rejected' | 'Withdrawn' | 'Completed';
  assignedProjectId?: string | null;
  notes?: string;
  college?: string;
  degree?: string;
  graduationYear?: number | null;
  cgpa?: number | null;
  skills?: string[];
  resumeUrl?: string | null;
  preferredDepartmentId?: string | null;
  durationWeeks?: number;
  reviewerRemarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InternProfile {
  id: string;
  applicationId: string;
  internCode?: string;
  mentorStaffId?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  status: 'Active' | 'Completed' | 'On Hold';
  projectName: string;
  progress: number;
  attendancePercent: number;
  finalFeedback?: string;
  certificateStatus: 'Pending' | 'Generated' | 'Issued' | 'Not Eligible';
  fullName?: string;
  email?: string;
  phone?: string;
  college?: string;
  departmentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface InternTask {
  id: string;
  internId: string;
  title: string;
  projectName?: string;
  status: 'Not Started' | 'To Do' | 'In Progress' | 'Under Review' | 'Completed' | 'Done' | 'On Hold';
  dueDate?: string | null;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  description?: string;
  progress?: number;
  mentorFeedback?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InternAttendanceRecord {
  id: string;
  internId: string;
  attendanceDate: string;
  status: 'Present' | 'Late' | 'Absent';
  note?: string;
  createdAt?: string;
}

export interface InternFeedbackRecord {
  id: string;
  internId: string;
  feedbackDate: string;
  rating?: number | null;
  scores?: Record<string, number>;
  feedback: string;
  createdAt?: string;
}

export interface InternCertificateRecord {
  id: string;
  internId: string;
  certificateNumber: string;
  issuedOn: string;
  fileUrl?: string | null;
  finalEvaluation?: string;
  createdAt?: string;
}

export interface VolunteerApplication {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  skills?: string[];
  motivation?: string;
  status: 'New' | 'Applied' | 'Under Review' | 'Approved' | 'Rejected';
  appliedOn: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VolunteerProfile {
  id: string;
  userId?: string | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  skills?: string[];
  availability?: string;
  status: 'Applicant' | 'Applied' | 'Under Review' | 'Approved' | 'Active' | 'Inactive' | 'Rejected';
  joinedOn?: string | null;
  city?: string;
  age?: number | null;
  applicationId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface VolunteerAssignment {
  id: string;
  volunteerId: string;
  projectId?: string | null;
  roleTitle: string;
  startsOn?: string | null;
  endsOn?: string | null;
  status: 'Pending' | 'Active' | 'Completed' | 'Cancelled';
  eventId?: string | null;
  assignmentKind?: 'Project' | 'Event' | 'Activity';
  targetLabel?: string;
  responsibilities?: string;
  createdAt?: string;
}

export interface VolunteerAttendanceRecord {
  id: string;
  volunteerId: string;
  assignmentId?: string | null;
  attendanceDate: string;
  status: 'Present' | 'Absent' | 'Late';
  hours: number;
  assignmentKind?: 'Project' | 'Event' | 'Activity';
  targetLabel?: string;
  notes?: string;
  createdAt?: string;
}

export interface VolunteerFeedbackRecord {
  id: string;
  volunteerId: string;
  reviewerId?: string | null;
  reviewedOn: string;
  rating?: number | null;
  scores?: Record<string, number>;
  feedback: string;
  createdAt?: string;
}

export interface VolunteerRecognition {
  id: string;
  volunteerId: string;
  title: string;
  recognitionType: 'Certificate' | 'Award' | 'Recognition';
  issuedOn: string;
  createdAt?: string;
}

// -------------------------------------------------------------
// API Calls
// -------------------------------------------------------------

export const peopleApi = {
  // Dashboards
  getHrDashboard: () => apiRequest<HrDashboardData>('/people/hr/dashboard'),
  getInternDashboard: () => apiRequest<InternDashboardData>('/people/intern/dashboard'),
  getVolunteerDashboard: () => apiRequest<VolunteerDashboardData>('/people/volunteer/dashboard'),

  // Departments
  getDepartments: () => apiList<Department>('departments', { limit: 200 }),

  // Staff / Employees
  getEmployees: (params: Record<string, any> = {}) => apiList<StaffProfile>('staff', { limit: 200, ...params }),
  getEmployee: (id: string) => apiRequest<StaffProfile>(`/staff/${id}`),
  createEmployee: (data: Partial<StaffProfile>) => apiCreate<StaffProfile>('staff', data),
  updateEmployee: (id: string, data: Partial<StaffProfile>) => apiUpdate<StaffProfile>('staff', id, data),
  deleteEmployee: (id: string) => apiDelete('staff', id),

  // HR Requirements
  getRequirements: (params: Record<string, any> = {}) => apiList<HrRequirement>('hr-requirements', { limit: 200, ...params }),
  createRequirement: (data: Partial<HrRequirement>) => apiCreate<HrRequirement>('hr-requirements', data),
  updateRequirement: (id: string, data: Partial<HrRequirement>) => apiUpdate<HrRequirement>('hr-requirements', id, data),
  deleteRequirement: (id: string) => apiDelete('hr-requirements', id),

  // HR Applicants / Recruitment
  getApplicants: (params: Record<string, any> = {}) => apiList<HrApplicant>('hr-applicants', { limit: 200, ...params }),
  createApplicant: (data: Partial<HrApplicant>) => apiCreate<HrApplicant>('hr-applicants', data),
  updateApplicant: (id: string, data: Partial<HrApplicant>) => apiUpdate<HrApplicant>('hr-applicants', id, data),
  deleteApplicant: (id: string) => apiDelete('hr-applicants', id),
  convertApplicantToEmployee: (applicantId: string, details: { salary?: number; jobTitle?: string; departmentId?: string; hiredOn?: string } = {}) =>
    apiRequest<{ employee: StaffProfile; applicant: HrApplicant; message: string }>('/people/recruitment/convert-applicant', {
      method: 'POST',
      body: JSON.stringify({ applicantId, ...details }),
    }),

  // Staff Attendance
  getStaffAttendance: (params: Record<string, any> = {}) => apiList<StaffAttendanceRecord>('staff-attendance', { limit: 200, ...params }),
  recordStaffAttendance: (data: Partial<StaffAttendanceRecord>) => apiCreate<StaffAttendanceRecord>('staff-attendance', data),
  updateStaffAttendance: (id: string, data: Partial<StaffAttendanceRecord>) => apiUpdate<StaffAttendanceRecord>('staff-attendance', id, data),

  // Staff Leaves
  getStaffLeaves: (params: Record<string, any> = {}) => apiList<StaffLeaveApplication>('staff-leave-applications', { limit: 200, ...params }),
  submitStaffLeave: (data: Partial<StaffLeaveApplication>) => apiCreate<StaffLeaveApplication>('staff-leave-applications', data),
  updateStaffLeave: (id: string, data: Partial<StaffLeaveApplication>) => apiUpdate<StaffLeaveApplication>('staff-leave-applications', id, data),

  // Staff Performance
  getStaffPerformance: (params: Record<string, any> = {}) => apiList<StaffPerformanceReview>('staff-performance-reviews', { limit: 200, ...params }),
  createStaffPerformance: (data: Partial<StaffPerformanceReview>) => apiCreate<StaffPerformanceReview>('staff-performance-reviews', data),

  // Staff Payroll & Finance
  getStaffPayroll: (params: Record<string, any> = {}) => apiList<StaffPayrollRecord>('staff-payroll', { limit: 200, ...params }),
  createStaffPayroll: (data: Partial<StaffPayrollRecord>) => apiCreate<StaffPayrollRecord>('staff-payroll', data),
  updateStaffPayroll: (id: string, data: Partial<StaffPayrollRecord>) => apiUpdate<StaffPayrollRecord>('staff-payroll', id, data),

  // Intern Applications
  getInternApplications: (params: Record<string, any> = {}) => apiList<InternApplication>('intern-applications', { limit: 200, ...params }),
  createInternApplication: (data: Partial<InternApplication>) => apiCreate<InternApplication>('intern-applications', data),
  updateInternApplication: (id: string, data: Partial<InternApplication>) => apiUpdate<InternApplication>('intern-applications', id, data),
  deleteInternApplication: (id: string) => apiDelete('intern-applications', id),
  selectInternApplicant: (applicationId: string, details: { mentorStaffId?: string; departmentId?: string; projectName?: string; startsOn?: string; endsOn?: string } = {}) =>
    apiRequest<{ intern: InternProfile; application: InternApplication; message: string }>('/people/intern/select-applicant', {
      method: 'POST',
      body: JSON.stringify({ applicationId, ...details }),
    }),

  // Intern Profiles
  getInternProfiles: (params: Record<string, any> = {}) => apiList<InternProfile>('intern-profiles', { limit: 200, ...params }),
  getInternProfile: (id: string) => apiRequest<InternProfile>(`/intern-profiles/${id}`),
  updateInternProfile: (id: string, data: Partial<InternProfile>) => apiUpdate<InternProfile>('intern-profiles', id, data),

  // Intern Tasks
  getInternTasks: (params: Record<string, any> = {}) => apiList<InternTask>('intern-tasks', { limit: 200, ...params }),
  createInternTask: (data: Partial<InternTask>) => apiCreate<InternTask>('intern-tasks', data),
  updateInternTask: (id: string, data: Partial<InternTask>) => apiUpdate<InternTask>('intern-tasks', id, data),
  deleteInternTask: (id: string) => apiDelete('intern-tasks', id),

  // Intern Attendance, Feedback, Certificates
  getInternAttendance: (params: Record<string, any> = {}) => apiList<InternAttendanceRecord>('intern-attendance', { limit: 200, ...params }),
  recordInternAttendance: (data: Partial<InternAttendanceRecord>) => apiCreate<InternAttendanceRecord>('intern-attendance', data),
  createInternAttendance: (data: Partial<InternAttendanceRecord>) => apiCreate<InternAttendanceRecord>('intern-attendance', data),
  getInternFeedback: (params: Record<string, any> = {}) => apiList<InternFeedbackRecord>('intern-feedback', { limit: 200, ...params }),
  createInternFeedback: (data: Partial<InternFeedbackRecord>) => apiCreate<InternFeedbackRecord>('intern-feedback', data),
  getInternCertificates: (params: Record<string, any> = {}) => apiList<InternCertificateRecord>('intern-certificates', { limit: 200, ...params }),
  createInternCertificate: (data: Partial<InternCertificateRecord>) => apiCreate<InternCertificateRecord>('intern-certificates', data),

  // Volunteers
  getVolunteerApplications: (params: Record<string, any> = {}) => apiList<VolunteerApplication>('volunteer-applications', { limit: 200, ...params }),
  createVolunteerApplication: (data: Partial<VolunteerApplication>) => apiCreate<VolunteerApplication>('volunteer-applications', data),
  updateVolunteerApplication: (id: string, data: Partial<VolunteerApplication>) => apiUpdate<VolunteerApplication>('volunteer-applications', id, data),
  approveVolunteerApplicant: (applicationId: string) =>
    apiRequest<{ volunteer: VolunteerProfile; application: VolunteerApplication; message: string }>('/people/volunteer/approve-applicant', {
      method: 'POST',
      body: JSON.stringify({ applicationId }),
    }),
  getVolunteers: (params: Record<string, any> = {}) => apiList<VolunteerProfile>('volunteers', { limit: 200, ...params }),
  getVolunteer: (id: string) => apiRequest<VolunteerProfile>(`/volunteers/${id}`),
  updateVolunteer: (id: string, data: Partial<VolunteerProfile>) => apiUpdate<VolunteerProfile>('volunteers', id, data),

  // Volunteer Assignments
  getVolunteerAssignments: (params: Record<string, any> = {}) => apiList<VolunteerAssignment>('volunteer-assignments', { limit: 200, ...params }),
  createVolunteerAssignment: (data: Partial<VolunteerAssignment>) => apiCreate<VolunteerAssignment>('volunteer-assignments', data),
  updateVolunteerAssignment: (id: string, data: Partial<VolunteerAssignment>) => apiUpdate<VolunteerAssignment>('volunteer-assignments', id, data),
  deleteVolunteerAssignment: (id: string) => apiDelete('volunteer-assignments', id),

  // Volunteer Attendance, Feedback, Recognitions
  getVolunteerAttendance: (params: Record<string, any> = {}) => apiList<VolunteerAttendanceRecord>('volunteer-attendance', { limit: 200, ...params }),
  recordVolunteerAttendance: (data: Partial<VolunteerAttendanceRecord>) => apiCreate<VolunteerAttendanceRecord>('volunteer-attendance', data),
  getVolunteerFeedback: (params: Record<string, any> = {}) => apiList<VolunteerFeedbackRecord>('volunteer-feedback', { limit: 200, ...params }),
  createVolunteerFeedback: (data: Partial<VolunteerFeedbackRecord>) => apiCreate<VolunteerFeedbackRecord>('volunteer-feedback', data),
  getVolunteerRecognitions: (params: Record<string, any> = {}) => apiList<VolunteerRecognition>('volunteer-recognitions', { limit: 200, ...params }),
  createVolunteerRecognition: (data: Partial<VolunteerRecognition>) => apiCreate<VolunteerRecognition>('volunteer-recognitions', data),

  // Uploads
  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/uploads', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Upload failed');
    }
    return response.json() as Promise<{ url: string; filename: string; originalName: string; size: number }>;
  },
};
