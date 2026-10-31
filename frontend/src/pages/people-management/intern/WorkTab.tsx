import { useEffect, useState } from 'react';
import { Plus, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, Calendar, Clock, MessageSquare, Award } from 'lucide-react';
import { Modal, ProgressBar, SelectField, StatusBadge, TextField, TextAreaField, ACCENT } from '../../../components/people';
import { peopleApi, type InternProfile, type InternTask } from '../../../services/peopleApi';

interface Props {
  interns: InternProfile[];
  onRefreshStats?: () => void;
}

const TASK_STATUSES: InternTask['status'][] = [
  'Not Started',
  'In Progress',
  'Under Review',
  'Completed',
  'On Hold',
];

export default function WorkTab({ interns, onRefreshStats }: Props) {
  const [tasks, setTasks] = useState<InternTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [selectedInternId, setSelectedInternId] = useState<string>('All');

  // Add Task Modal
  const [addOpen, setAddOpen] = useState(false);
  const [targetInternId, setTargetInternId] = useState(interns[0]?.id || '');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<InternTask['priority']>('Medium');
  const [savingTask, setSavingTask] = useState(false);
  const [taskFormError, setTaskFormError] = useState('');

  // Mentor Feedback Modal
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackTask, setFeedbackTask] = useState<InternTask | null>(null);
  const [mentorFeedbackText, setMentorFeedbackText] = useState('');
  const [taskProgressVal, setTaskProgressVal] = useState('0');
  const [savingFeedback, setSavingFeedback] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await peopleApi.getInternTasks({ limit: 100 });
      setTasks(res.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load intern tasks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTasks();
  }, []);

  const handleCreateTask = async () => {
    if (!taskTitle.trim() || !targetInternId) {
      setTaskFormError('Please select an intern and enter a task title.');
      return;
    }
    setSavingTask(true);
    setTaskFormError('');
    try {
      await peopleApi.createInternTask({
        internId: targetInternId,
        title: taskTitle.trim(),
        description: taskDescription.trim() || undefined,
        dueDate: taskDueDate || undefined,
        priority: taskPriority,
        status: 'Not Started',
        progress: 0,
      });

      setNotification(`Task "${taskTitle}" assigned successfully.`);
      setAddOpen(false);
      setTaskTitle('');
      setTaskDescription('');
      setTaskDueDate('');
      await fetchTasks();
      onRefreshStats?.();
    } catch (err: any) {
      setTaskFormError(err?.message || 'Failed to assign task.');
    } finally {
      setSavingTask(false);
    }
  };

  const handleAdvanceStatus = async (task: InternTask, nextStatus: InternTask['status']) => {
    try {
      const progress = nextStatus === 'Completed' ? 100 : task.progress;
      await peopleApi.updateInternTask(task.id, {
        status: nextStatus,
        progress,
      });
      setNotification(`Task moved to ${nextStatus}.`);
      await fetchTasks();
      onRefreshStats?.();
    } catch (err: any) {
      setError(err?.message || 'Failed to update task status.');
    }
  };

  const openFeedbackModal = (task: InternTask) => {
    setFeedbackTask(task);
    setMentorFeedbackText(task.mentorFeedback || '');
    setTaskProgressVal(String(task.progress ?? 0));
    setFeedbackOpen(true);
  };

  const handleSaveFeedback = async () => {
    if (!feedbackTask) return;
    setSavingFeedback(true);
    try {
      const progressNum = Math.min(100, Math.max(0, parseInt(taskProgressVal, 10) || 0));
      await peopleApi.updateInternTask(feedbackTask.id, {
        mentorFeedback: mentorFeedbackText.trim(),
        progress: progressNum,
        status: progressNum === 100 ? 'Completed' : feedbackTask.status,
      });
      setNotification('Mentor feedback and task progress saved.');
      setFeedbackOpen(false);
      await fetchTasks();
      onRefreshStats?.();
    } catch (err: any) {
      setError(err?.message || 'Failed to save feedback.');
    } finally {
      setSavingFeedback(false);
    }
  };

  const internMap = new Map(interns.map(i => [i.id, i.fullName || i.internCode]));

  const shownTasks = selectedInternId === 'All'
    ? tasks
    : tasks.filter(t => t.internId === selectedInternId);

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
          <button onClick={() => void fetchTasks()} className="ml-auto underline text-xs font-semibold">
            Retry
          </button>
        </div>
      )}

      {/* Action Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="w-72">
          <SelectField
            label="Filter by Intern"
            hideLabel
            value={selectedInternId}
            onChange={setSelectedInternId}
            options={[
              { label: 'All Interns', value: 'All' },
              ...interns.map(i => ({ label: `${i.fullName || i.internCode} (${i.internCode})`, value: i.id })),
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchTasks()}
            className="btn-secondary !p-2"
            title="Refresh tasks"
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            className="btn-primary flex items-center gap-1.5"
            onClick={() => {
              if (interns.length > 0) setTargetInternId(interns[0].id);
              setAddOpen(true);
            }}
          >
            <Plus size={16} /> Assign Task
          </button>
        </div>
      </div>

      {/* Status Columns */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div>
            <h2 className="card-title">Intern Task Board & Deliverables</h2>
            <p className="text-xs text-slate-500">Track task progression from assignment to completion with mentor reviews.</p>
          </div>
          <span className="text-xs text-slate-400 font-semibold">{shownTasks.length} Total Tasks</span>
        </div>
        <div className="card-body grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3.5">
          {TASK_STATUSES.map((status, colIdx) => {
            const colTasks = shownTasks.filter(t => t.status === status);
            return (
              <section
                key={status}
                className="rounded-xl bg-slate-100/70 dark:bg-slate-800/50 p-3 flex flex-col gap-2.5 min-h-[300px]"
                aria-label={status}
              >
                <div className="flex items-center justify-between px-1">
                  <StatusBadge status={status} />
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {colTasks.length}
                  </span>
                </div>

                {colTasks.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-xs text-slate-400 italic">
                    No tasks
                  </div>
                ) : (
                  colTasks.map(task => (
                    <article
                      key={task.id}
                      className="card p-3 flex flex-col gap-2 shadow-sm border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">
                          {task.title}
                        </div>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            task.priority === 'High' || task.priority === 'Critical'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {task.priority || 'Medium'}
                        </span>
                      </div>

                      {task.description && (
                        <p className="text-xs text-slate-500 line-clamp-2">{task.description}</p>
                      )}

                      <div className="text-[11px] text-teal-700 dark:text-teal-400 font-medium">
                        {internMap.get(task.internId) || 'Assigned Intern'}
                      </div>

                      {task.dueDate && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Calendar size={12} />
                          <span>Due: {task.dueDate}</span>
                        </div>
                      )}

                      <div className="pt-1">
                        <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                          <span>Progress</span>
                          <span>{task.progress ?? 0}%</span>
                        </div>
                        <ProgressBar value={task.progress ?? 0} color={ACCENT.intern} />
                      </div>

                      {task.mentorFeedback && (
                        <div className="p-1.5 bg-slate-50 dark:bg-slate-700/50 rounded text-[11px] text-slate-600 dark:text-slate-300 border-l-2 border-teal-500">
                          <span className="font-semibold block text-[10px] text-teal-700 dark:text-teal-400">
                            Mentor Feedback:
                          </span>
                          {task.mentorFeedback}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700">
                        <button
                          onClick={() => openFeedbackModal(task)}
                          className="p-1 text-slate-400 hover:text-teal-600 rounded flex items-center gap-1 text-[11px]"
                          title="Add Mentor Feedback & Update Progress"
                        >
                          <MessageSquare size={13} />
                          <span>Review</span>
                        </button>

                        {colIdx < TASK_STATUSES.length - 1 && (
                          <button
                            onClick={() => handleAdvanceStatus(task, TASK_STATUSES[colIdx + 1])}
                            className="p-1 text-teal-600 hover:text-teal-800 rounded hover:bg-teal-50 dark:hover:bg-teal-950/40 flex items-center gap-0.5 text-[11px] font-semibold"
                            title={`Move to ${TASK_STATUSES[colIdx + 1]}`}
                          >
                            <span>Next</span>
                            <ArrowRight size={13} />
                          </button>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* Assign Task Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Assign New Task to Intern"
        submitLabel={savingTask ? 'Assigning...' : 'Assign Task'}
        onSubmit={handleCreateTask}
        wide
      >
        {taskFormError && (
          <div className="col-span-1 sm:col-span-2 p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">
            {taskFormError}
          </div>
        )}
        <SelectField
          label="Select Intern"
          value={targetInternId}
          onChange={setTargetInternId}
          options={interns.map(i => ({ label: `${i.fullName || i.internCode || 'Intern'} (${i.internCode || 'No code'})`, value: i.id }))}
          required
        />
        <SelectField
          label="Priority Level"
          value={taskPriority}
          onChange={v => setTaskPriority(v as InternTask['priority'])}
          options={['Low', 'Medium', 'High', 'Critical']}
        />
        <div className="col-span-1 sm:col-span-2">
          <TextField
            label="Task Title"
            value={taskTitle}
            onChange={setTaskTitle}
            placeholder="e.g. Conduct beneficiary survey in Ward 4"
            required
          />
        </div>
        <TextField
          label="Due Date"
          type="date"
          value={taskDueDate}
          onChange={setTaskDueDate}
        />
        <div className="col-span-1 sm:col-span-2">
          <TextAreaField
            label="Task Instructions & Deliverables"
            value={taskDescription}
            onChange={setTaskDescription}
            placeholder="Detailed description of deliverables, guidelines, and expected results..."
          />
        </div>
      </Modal>

      {/* Mentor Feedback & Progress Modal */}
      <Modal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        title={`Review Task: ${feedbackTask?.title ?? ''}`}
        submitLabel={savingFeedback ? 'Saving...' : 'Save Review'}
        onSubmit={handleSaveFeedback}
      >
        <div className="col-span-1 sm:col-span-2 text-xs text-slate-500 mb-2">
          Intern: <strong>{feedbackTask ? internMap.get(feedbackTask.internId) : ''}</strong>
        </div>
        <TextField
          label="Progress Percentage (0 - 100)"
          type="number"
          value={taskProgressVal}
          onChange={setTaskProgressVal}
        />
        <div className="col-span-1 sm:col-span-2">
          <TextAreaField
            label="Mentor Feedback & Guidance"
            value={mentorFeedbackText}
            onChange={setMentorFeedbackText}
            placeholder="Evaluate quality, point out improvements, or provide encouragement..."
          />
        </div>
      </Modal>
    </div>
  );
}
