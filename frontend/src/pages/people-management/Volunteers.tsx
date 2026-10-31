import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { PageHeader, PageTabs, ACCENT } from '../../components/people';
import DashboardTab from './volunteer/DashboardTab';
import ApplicationsTab from './volunteer/ApplicationsTab';
import ListTab from './volunteer/ListTab';
import AssignmentsTab from './volunteer/AssignmentsTab';
import SkillsTab from './volunteer/SkillsTab';
import AttendanceTab from './volunteer/AttendanceTab';
import PerformanceTab from './volunteer/PerformanceTab';
import CertificatesTab from './volunteer/CertificatesTab';
import ReportsTab from './volunteer/ReportsTab';
import { peopleApi, type VolunteerApplication, type VolunteerAssignment, type VolunteerAttendanceRecord, type VolunteerFeedbackRecord, type VolunteerProfile, type VolunteerRecognition } from '../../services/peopleApi';
import { type AppStatus, type Assignment, type AttendanceRec, type Recognition, type VApplication, type Volunteer } from './volunteer/data';
import type { RatingReview, RatingScores } from '../../lib/peopleRating';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'applications', label: 'Applications' },
  { id: 'list', label: 'Volunteer List' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'skills', label: 'Skills & Availability' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'performance', label: 'Performance & Feedback' },
  { id: 'certificates', label: 'Certificates & Recognition' },
  { id: 'reports', label: 'Reports' },
];

const displayDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const apiDate = (value: string) => {
  if (!value || value === 'TBD') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
};

const ratingScores = (scores?: Record<string, number>): RatingScores => ({
  quality: scores?.quality ?? 0,
  delivery: scores?.delivery ?? 0,
  reliability: scores?.reliability ?? 0,
  collaboration: scores?.collaboration ?? 0,
});

const applicationView = (application: VolunteerApplication): VApplication => ({
  id: application.id,
  name: application.fullName,
  email: application.email,
  skills: application.skills || [],
  motivation: application.motivation || '',
  appliedOn: displayDate(application.appliedOn),
  status: application.status === 'Applied' ? 'New' : application.status,
});

const volunteerView = (
  profile: VolunteerProfile,
  assignments: VolunteerAssignment[],
  attendance: VolunteerAttendanceRecord[],
  feedback: VolunteerFeedbackRecord[],
): Volunteer => {
  const volunteerAssignments = assignments.filter(item => item.volunteerId === profile.id);
  const volunteerAttendance = attendance.filter(item => item.volunteerId === profile.id);
  const volunteerFeedback = feedback.filter(item => item.volunteerId === profile.id);
  const ratingReviews = volunteerFeedback
    .filter(item => item.rating !== null && item.rating !== undefined)
    .map(item => ({
      date: displayDate(item.reviewedOn),
      rating: Number(item.rating),
      scores: ratingScores(item.scores),
    }));
  const ratings = ratingReviews.map(item => item.rating);
  const completedAssignments = volunteerAssignments.filter(item => item.status === 'Completed').length;
  const availability = (profile.availability || '').split(',').map(value => value.trim()).filter(Boolean);

  return {
    id: profile.id,
    name: profile.fullName,
    email: profile.email || '',
    phone: profile.phone || '',
    city: profile.city || '',
    age: profile.age || 0,
    status: profile.status === 'Active' ? 'Active' : 'Inactive',
    joined: displayDate(profile.joinedOn),
    skills: profile.skills || [],
    availability,
    hours: volunteerAttendance.reduce((sum, item) => sum + Number(item.hours || 0), 0),
    tasksDone: completedAssignments,
    tasksTotal: Math.max(volunteerAssignments.length, 1),
    rating: ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 0,
    feedback: volunteerFeedback.map(item => ({ date: displayDate(item.reviewedOn), text: item.feedback })),
    history: [],
    ratingReviews,
  };
};

const assignmentView = (assignment: VolunteerAssignment): Assignment => ({
  id: assignment.id,
  volunteerId: assignment.volunteerId,
  kind: assignment.assignmentKind === 'Event' ? 'Event' : 'Project',
  target: assignment.targetLabel || assignment.projectId || assignment.eventId || 'Assignment',
  role: assignment.roleTitle,
  date: displayDate(assignment.startsOn),
  status: assignment.status === 'Active' ? 'Ongoing' : assignment.status === 'Completed' ? 'Completed' : assignment.status === 'Cancelled' ? 'Cancelled' : 'Upcoming',
  responsibilities: assignment.responsibilities || '',
});

const attendanceView = (record: VolunteerAttendanceRecord): AttendanceRec => ({
  id: record.id,
  volunteerId: record.volunteerId,
  date: displayDate(record.attendanceDate),
  kind: record.assignmentKind === 'Project' ? 'Project' : 'Event',
  target: record.targetLabel || 'Volunteer activity',
  status: record.status,
  hours: Number(record.hours || 0),
});

const recognitionView = (record: VolunteerRecognition): Recognition => ({
  id: record.id,
  volunteerId: record.volunteerId,
  title: record.title,
  kind: record.recognitionType,
  date: displayDate(record.issuedOn),
});

const assignmentStatus = (status: Assignment['status']): VolunteerAssignment['status'] => ({
  Upcoming: 'Pending',
  Ongoing: 'Active',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
} satisfies Record<Assignment['status'], VolunteerAssignment['status']>)[status];

export default function VolunteersPage() {
  const [tab, setTab] = useState('dashboard');
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [applications, setApplications] = useState<VApplication[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [records, setRecords] = useState<AttendanceRec[]>([]);
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [applicationResponse, volunteerResponse, assignmentResponse, attendanceResponse, feedbackResponse, recognitionResponse] = await Promise.all([
        peopleApi.getVolunteerApplications({ limit: 200 }),
        peopleApi.getVolunteers({ limit: 200 }),
        peopleApi.getVolunteerAssignments({ limit: 200 }),
        peopleApi.getVolunteerAttendance({ limit: 200 }),
        peopleApi.getVolunteerFeedback({ limit: 200 }),
        peopleApi.getVolunteerRecognitions({ limit: 200 }),
      ]);
      const attendance = attendanceResponse.items;
      const assignmentsData = assignmentResponse.items;
      const feedbackData = feedbackResponse.items;
      setApplications(applicationResponse.items.map(applicationView));
      setAssignments(assignmentsData.map(assignmentView));
      setRecords(attendance.map(attendanceView));
      setRecognitions(recognitionResponse.items.map(recognitionView));
      setVolunteers(volunteerResponse.items.map(profile => volunteerView(profile, assignmentsData, attendance, feedbackData)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load volunteer records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const setApplicationStatus = async (id: string, status: AppStatus) => {
    try {
      if (status === 'Approved') {
        await peopleApi.approveVolunteerApplicant(id);
      } else {
        await peopleApi.updateVolunteerApplication(id, { status: status === 'New' ? 'Applied' : status });
      }
      setNotice(`Volunteer application updated to ${status}.`);
      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to update volunteer application.');
    }
  };

  const addAssignment = async (assignment: Assignment) => {
    try {
      await peopleApi.createVolunteerAssignment({
        volunteerId: assignment.volunteerId,
        roleTitle: assignment.role,
        startsOn: apiDate(assignment.date),
        status: assignmentStatus(assignment.status),
        assignmentKind: assignment.kind,
        targetLabel: assignment.target,
        responsibilities: assignment.responsibilities,
      });
      setNotice('Volunteer assignment saved.');
      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to save volunteer assignment.');
    }
  };

  const updateAssignmentStatus = async (id: string, status: Assignment['status']) => {
    try {
      await peopleApi.updateVolunteerAssignment(id, { status: assignmentStatus(status) });
      await loadData();
      setNotice('Assignment status updated.');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to update assignment status.');
    }
  };

  const toggleAvailability = async (id: string, key: string) => {
    const volunteer = volunteers.find(item => item.id === id);
    if (!volunteer) return;
    const next = volunteer.availability.includes(key)
      ? volunteer.availability.filter(slot => slot !== key)
      : [...volunteer.availability, key];
    try {
      await peopleApi.updateVolunteer(id, { availability: next.join(', ') });
      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to update volunteer availability.');
    }
  };

  const markAttendance = async (record: AttendanceRec) => {
    try {
      await peopleApi.recordVolunteerAttendance({
        volunteerId: record.volunteerId,
        attendanceDate: new Date().toISOString().slice(0, 10),
        status: record.status,
        hours: record.hours,
        assignmentKind: record.kind,
        targetLabel: record.target,
      });
      await loadData();
      setNotice('Volunteer attendance recorded.');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to record volunteer attendance.');
    }
  };

  const addFeedback = async (id: string, text: string) => {
    try {
      await peopleApi.createVolunteerFeedback({
        volunteerId: id,
        reviewedOn: new Date().toISOString().slice(0, 10),
        feedback: text,
      });
      await loadData();
      setNotice('Volunteer feedback saved.');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to save volunteer feedback.');
    }
  };

  const addRating = async (id: string, review: RatingReview) => {
    try {
      await peopleApi.createVolunteerFeedback({
        volunteerId: id,
        reviewedOn: apiDate(review.date),
        rating: review.rating,
        scores: review.scores,
        feedback: 'Performance review',
      });
      await loadData();
      setNotice('Volunteer performance rating saved.');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to save performance rating.');
    }
  };

  const addRecognition = async (kind: Recognition['kind'], volunteerId: string, title: string) => {
    const record = await peopleApi.createVolunteerRecognition({
      volunteerId,
      title,
      recognitionType: kind,
      issuedOn: new Date().toISOString().slice(0, 10),
    });
    const view = recognitionView(record);
    setRecognitions(current => [view, ...current]);
    return view;
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Volunteer Management"
        subtitle="Manage volunteer applications, profiles, assignments, availability, attendance and recognition."
        action={
          <button onClick={() => void loadData()} className="btn-secondary !p-2" title="Refresh volunteer data" disabled={loading}>
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
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
      {loading && <div role="status" className="text-sm text-slate-500">Loading volunteer records…</div>}
      <PageTabs tabs={TABS} active={tab} onChange={setTab} accent={ACCENT.volunteer} />
      {tab === 'dashboard' && <DashboardTab volunteers={volunteers} applications={applications} assignments={assignments} />}
      {tab === 'applications' && <ApplicationsTab applications={applications} volunteers={volunteers} onSet={setApplicationStatus} />}
      {tab === 'list' && <ListTab volunteers={volunteers} />}
      {tab === 'assignments' && <AssignmentsTab volunteers={volunteers} assignments={assignments} onAdd={addAssignment} onStatus={updateAssignmentStatus} />}
      {tab === 'skills' && <SkillsTab volunteers={volunteers} onToggle={toggleAvailability} />}
      {tab === 'attendance' && <AttendanceTab volunteers={volunteers} records={records} onMark={markAttendance} />}
      {tab === 'performance' && <PerformanceTab volunteers={volunteers} onFeedback={addFeedback} onRate={addRating} />}
      {tab === 'certificates' && <CertificatesTab volunteers={volunteers} items={recognitions} onAdd={addRecognition} />}
      {tab === 'reports' && <ReportsTab volunteers={volunteers} assignments={assignments} records={records} />}
    </div>
  );
}
