import { FileText, GraduationCap, TrendingUp, Award } from 'lucide-react';
import { ReportGrid, ACCENT } from '../../../components/people';
import type { InternApplication, InternProfile } from '../../../services/peopleApi';

export default function ReportsTab({ applications, interns }: { applications: InternApplication[]; interns: InternProfile[] }) {
  return <ReportGrid accent={ACCENT.intern} reports={[
    { title: 'Application Report', description: 'All applications with stage and college.', icon: <FileText size={18} />, rows: applications.map(a => ({ ID: a.id, Name: a.fullName, Position: a.areaOfInterest, College: a.college || '', Stage: a.status })) },
    { title: 'Intern Report', description: 'Intern roster with mentor and duration.', icon: <GraduationCap size={18} />, rows: interns.map(i => ({ ID: i.internCode || i.id, Name: i.fullName || '', Department: i.departmentId || '', Mentor: i.mentorStaffId || '', Start: i.startsOn || '', End: i.endsOn || '', Status: i.status })) },
    { title: 'Progress Report', description: 'Progress and attendance per intern.', icon: <TrendingUp size={18} />, rows: interns.map(i => ({ Name: i.fullName || '', 'Progress %': i.progress, 'Attendance %': i.attendancePercent })) },
    { title: 'Completion Report', description: 'Completion status and certificate state.', icon: <Award size={18} />, rows: interns.map(i => ({ Name: i.fullName || '', Status: i.status, Certificate: i.certificateStatus })) },
  ]} />;
}
