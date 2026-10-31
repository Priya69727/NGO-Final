/**
 * Project Management – service layer (live API).
 * Projects, tasks and expenses use their own tables, so Reports and Dashboard see the same data.
 * The rich plan, department checklists, documents, risks, impact log and activity feed are stored per project
 * through PUT /api/projects/:id/workspace (projects.plan_data).
 */
import type {
  ActivationInput, ActivityLog, ApprovedProposal, BudgetDetail, DepartmentChecklist, DepartmentKey, DocumentItem, DocStatus,
  Expense, ImpactEntry, ImpactSummary, ManagerOption, Milestone, NewExpense, NewImpactEntry, NewMilestone, NewRisk, NewTask,
  Project, ProjectFilters, ProjectListResult, ProjectTeamPatch, ReportData, ReportFilters, ReportType, ResourceItem, RiskIssue,
  Task, TeamMember, StageNo, ProjectStatus, ImpactKPI, Partner, ProjectPlan,
} from '../types/project';
import { buildChecklist, genDocs } from '../data/mockSeed';
import { MANAGERS } from '../data/mockProjects';
import { buildStages, nid } from '../data/mockBuilders';
import { DEPARTMENTS } from '../data/departmentTemplates';
import { inr } from '../lib/format';
import { apiRequest, apiList, apiCreate, apiUpdate, apiDelete } from './apiClient';
import { listProposals, getPlanning, type ProposalRecord } from './proposalApi';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

interface Workspace { checklists: DepartmentChecklist[]; documents: DocumentItem[]; risks: RiskIssue[]; impact: ImpactEntry[]; activity: ActivityLog[] }
interface Meta { managerId?: string; managerName?: string; durationMonths?: number; totalBudget?: number }
type Row = Record<string, any>;

const today = () => new Date().toISOString().slice(0, 10);
const fail = (status: number, msg: string): never => { throw new ApiError(status, msg); };
const num = (v: unknown): number => { const n = Number(String(v ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : 0; };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dedupeId = () => (crypto.randomUUID ? crypto.randomUUID() : nid('id'));

/* ═════════ Cache & persistence ═════════ */

const db = { projects: [] as Project[], tasks: [] as Task[], expenses: [] as Expense[], ws: new Map<string, Workspace>(), loaded: false };
let loading: Promise<void> | null = null;

const allKpis = (p: Project): ImpactKPI[] => [...p.plan.expectedImpact.direct.kpis, ...p.plan.expectedImpact.indirect.kpis, ...p.plan.expectedImpact.societal.kpis];
const CUMULATIVE_EXCLUDED = ['%', 'rate', 'metres', '₹'];

const emptyPlan = (start: string, end: string, managerName = '', over: Partial<{ direct: number; indirect: number }> = {}): ProjectPlan => ({
  expectedImpact: {
    projectDurationMonths: 12,
    direct: { description: '', kpis: [] }, indirect: { description: '', kpis: [] }, societal: { description: '', kpis: [] },
  },
  beneficiary: { directCategory: '', directNumber: over.direct ?? 0, indirectCategory: '', indirectNumber: over.indirect ?? 0, selectionProcess: '', dataSource: '', specialRemark: '' },
  stages: buildStages(start || today(), end || start || today(), 1, 0, false),
  milestones: [],
  team: { descriptions: { core: '', advisory: '', working: '' }, members: managerName ? [{ id: dedupeId(), name: managerName, role: 'Project Manager', group: 'Core' }] : [], stakeholders: [], partners: [], sameFieldNgos: [], volunteers: [], totalVolunteers: 0, staff: [], totalStaff: 0, totalSalariesA: 0 },
  operations: [], assets: [],
  funding: { assumedAnnualBudget: 0, priority1: [], priority2: [], priority3: [], publicCallOfAction: '', potentialDonors: [], sponsorship: { material: [], event: [], marketing: [] } },
  responsibility: Array.from({ length: 7 }, (_, i) => ({ rank: i + 1, department: null })),
});

const monthsBetween = (a: string, b: string): number => {
  if (!a || !b) return 12;
  const s = new Date(a), e = new Date(b);
  return Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + e.getMonth() - s.getMonth() + (e.getDate() >= s.getDate() ? 1 : 0));
};

const defaultWs = (p: Project): Workspace => {
  const checklists = DEPARTMENTS.map(d => buildChecklist(p.id, d.key, 0, p.managerName, p.plan.responsibility.find(r => r.department === d.key)?.rank ?? null));
  const admin = checklists.find(c => c.department === 'admin_legal')!;
  return { checklists, documents: genDocs(p, admin).map(d => ({ ...d, status: 'Pending', fileName: undefined, uploadedAt: undefined, uploadedBy: undefined })), risks: [], impact: [], activity: [] };
};

function projectFromRow(row: Row): Project {
  const pd: Row = row.planData ?? {};
  const meta: Meta = pd.meta ?? {};
  const start = row.startDate ?? '', end = row.endDate ?? '';
  const plan: ProjectPlan = pd.plan ?? emptyPlan(start, end, meta.managerName);
  const geo = row.geography && typeof row.geography === 'object' ? row.geography : {};
  const p: Project = {
    id: row.id, code: row.projectCode, proposalId: row.proposalId ?? '', name: row.name, sector: row.sector, why: row.why ?? '', problemStatement: row.problemStatement ?? '',
    sdgGoals: row.sdgGoals ?? [], currentStatus: row.currentStatus, activeSince: row.activeSince ?? '',
    geographics: { stage1: geo.stage1 ?? '', stage2: geo.stage2 ?? '', stage3: geo.stage3 ?? '' },
    status: row.status, currentStage: row.currentStage, progress: row.progress,
    managerId: meta.managerId ?? '', managerName: meta.managerName ?? 'Unassigned', startDate: start, endDate: end,
    durationMonths: meta.durationMonths ?? monthsBetween(start, end), totalBudget: 0, spent: 0, directBeneficiaries: plan.beneficiary.directNumber,
    archivedAt: row.archivedAt ? String(row.archivedAt).slice(0, 10) : undefined, plan,
  };
  p.totalBudget = plan.team.totalSalariesA + plan.operations.reduce((s, o) => s + o.total, 0) + plan.assets.reduce((s, a) => s + a.total, 0) || meta.totalBudget || 0;
  const w: Workspace | undefined = pd.workspace;
  db.ws.set(p.id, w ? { checklists: w.checklists ?? [], documents: w.documents ?? [], risks: w.risks ?? [], impact: w.impact ?? [], activity: w.activity ?? [] } : defaultWs(p));
  return p;
}
const taskFromRow = (r: Row): Task => ({
  id: r.id, projectId: r.projectId, title: r.title, description: r.description ?? '', owner: r.assigneeName ?? '', department: (r.departmentId ?? 'operations') as DepartmentKey,
  stage: r.stage as StageNo, priority: r.priority, dueDate: r.dueDate ?? '', status: r.status,
});
const taskBody = (t: Partial<NewTask>): Row => {
  const b: Row = {};
  if (t.title !== undefined) b.title = t.title.trim();
  if (t.description !== undefined) b.description = t.description;
  if (t.owner !== undefined) b.assigneeName = t.owner || null;
  if (t.department !== undefined) b.departmentId = t.department;
  if (t.stage !== undefined) b.stage = t.stage;
  if (t.priority !== undefined) b.priority = t.priority;
  if (t.status !== undefined) b.status = t.status;
  if (t.dueDate !== undefined) b.dueDate = t.dueDate || null;
  return b;
};
const expenseFromRow = (r: Row): Expense => ({
  id: r.id, projectId: r.projectId, date: r.expenseDate, section: r.section, head: r.head, description: r.description ?? '', amount: Number(r.amount), paidTo: r.paidTo, addedBy: r.addedByName ?? 'Team',
});

async function fetchAll(resource: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let offset = 0; offset < 5000; offset += 200) {
    const page = await apiList<Row>(resource, { limit: 200, offset });
    out.push(...page.items);
    if (out.length >= page.total) break;
  }
  return out;
}

async function load(force = false): Promise<void> {
  if (db.loaded && !force) return;
  if (!loading) {
    loading = (async () => {
      const [projects, tasks, expenses] = await Promise.all([fetchAll('projects'), fetchAll('tasks'), fetchAll('expenses')]);
      db.ws.clear();
      db.projects = projects.map(projectFromRow);
      db.tasks = tasks.map(taskFromRow);
      db.expenses = expenses.map(expenseFromRow);
      refreshSpent();
      db.loaded = true;
    })().finally(() => { loading = null; });
  }
  return loading;
}
/** Drop the cache (call on logout / login so one user's data never leaks to the next). */
export function resetProjectCache(): void { db.loaded = false; db.projects = []; db.tasks = []; db.expenses = []; db.ws.clear(); }

function refreshSpent(): void { db.projects.forEach(p => { p.spent = db.expenses.filter(e => e.projectId === p.id).reduce((s, e) => s + e.amount, 0); }); }
const proj = (id: string): Project => db.projects.find(p => p.id === id) ?? fail(404, `Project ${id} not found`);
const wsOf = (id: string): Workspace => { proj(id); return db.ws.get(id)!; };
const out = <T,>(v: T): T => structuredClone(v);

const saveQueue = new Map<string, Promise<unknown>>();
function save(projectId: string): Promise<void> {
  const p = proj(projectId);
  const body = { plan: p.plan, workspace: wsOf(projectId), meta: { managerId: p.managerId, managerName: p.managerName, durationMonths: p.durationMonths, totalBudget: p.totalBudget } as Meta };
  const prev = saveQueue.get(projectId) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(() => apiRequest(`/projects/${projectId}/workspace`, { method: 'PUT', body: JSON.stringify(body) }));
  saveQueue.set(projectId, next);
  return next.then(() => undefined);
}
function log(projectId: string, category: ActivityLog['category'], message: string, actor = 'You'): void {
  const a = wsOf(projectId).activity;
  a.unshift({ id: nid('al'), projectId, timestamp: new Date().toISOString(), actor, category, message });
  if (a.length > 200) a.length = 200;
}

/* ═════════ Projects ═════════ */

// GET /api/projects
export async function getProjects(f: ProjectFilters = {}): Promise<ProjectListResult> {
  await load();
  const tabStatus: Record<string, ProjectStatus | undefined> = { active: 'Active', upcoming: 'Upcoming', completed: 'Completed', archive: 'Archived' };
  const q = (f.search ?? '').trim().toLowerCase();
  let items = db.projects.filter(p => (f.tab && f.tab !== 'all' ? p.status === tabStatus[f.tab] : p.status !== 'Archived' || f.status === 'Archived'));
  if (f.status) items = items.filter(p => p.status === f.status);
  if (f.sector) items = items.filter(p => p.sector === f.sector);
  if (f.sdg) items = items.filter(p => p.sdgGoals.includes(Number(f.sdg)));
  if (f.stage !== undefined && f.stage !== '') items = items.filter(p => p.currentStage === Number(f.stage));
  if (f.lead) items = items.filter(p => p.managerName === f.lead);
  if (q) items = items.filter(p => [p.name, p.code, p.managerName, p.sector].some(s => s.toLowerCase().includes(q)));
  const c = (s: ProjectStatus) => db.projects.filter(p => p.status === s).length;
  return out({ items, total: items.length, stats: { total: db.projects.length - c('Archived'), active: c('Active'), upcoming: c('Upcoming'), completed: c('Completed'), archived: c('Archived'), onHold: c('On Hold') } });
}

export async function getProject(id: string): Promise<Project> { await load(); return out(proj(id)); }
export async function getManagers(): Promise<ManagerOption[]> { return out(MANAGERS); }

/* ═════════ Activation from an approved proposal ═════════ */

// Approved proposals whose detailed plan exists and that have not been activated yet.
export async function getEligibleProposals(): Promise<ApprovedProposal[]> {
  await load();
  const res = await listProposals({ status: 'Approved' });
  const used = new Set(db.projects.map(p => p.proposalId).filter(Boolean));
  const open = res.items.filter(p => !used.has(p.id));
  const plans = await Promise.all(open.map(p => (p.planningStatus === 'Complete' ? getPlanning(p.id).catch(() => null) : Promise.resolve(null))));
  return open.map((p, i) => {
    const months = monthsBetween(p.startDate ?? '', p.endDate ?? '');
    const done = p.planningStatus === 'Complete';
    const pl = plans[i];
    const b = pl ? buildPlanFromProposal(p, pl.sections, pl.departments, p.startDate ?? '', p.endDate ?? '', months, '').plan : null;
    return {
      id: p.id, title: p.title, sector: p.category, submittedBy: p.submittedByName ?? 'Project Manager',
      approvedOn: (p.reviewedAt ?? p.createdAt).slice(0, 10), planningStatus: p.planningStatus, planningCompletion: p.planningCompletion,
      missingSections: done ? [] : ['Detailed planning (finish it on the Planning page)'], suggestedManager: MANAGERS[0]?.id ?? '', budget: p.estimatedBudget,
      summary: {
        totalBudget: p.estimatedBudget, salariesA: b?.team.totalSalariesA ?? 0, operationsB: b?.operations.reduce((a, o) => a + o.total, 0) ?? 0, assetsC: 0,
        durationMonths: num(pl?.sections.overview?.duration) || months, totalStaff: num(pl?.sections.hr?.staffAssigned), totalVolunteers: b?.team.totalVolunteers ?? p.volunteersRequired ?? 0,
        directBeneficiaries: b?.beneficiary.directNumber ?? num(p.expectedBeneficiaries), indirectBeneficiaries: num(pl?.sections.beneficiary?.secondaryBeneficiaries), stages: 6, departments: 9,
      },
    } as ApprovedProposal;
  });
}

function buildPlanFromProposal(prop: ProposalRecord, sections: Record<string, Record<string, string>>, depts: { id: string; responsible: string; notes: string }[], start: string, end: string, months: number, managerName: string) {
  const s = (sec: string, f: string) => (sections[sec]?.[f] ?? '').trim();
  const plan = emptyPlan(start, end, managerName, { direct: num(s('beneficiary', 'estimatedCount')) || num(prop.expectedBeneficiaries) });
  plan.expectedImpact.projectDurationMonths = months;
  plan.expectedImpact.direct.description = s('impact', 'directImpact');
  plan.expectedImpact.indirect.description = s('impact', 'indirectImpact');
  plan.expectedImpact.societal.description = s('impact', 'societalImpact') || s('impact', 'longTermOutcomes');
  plan.beneficiary.directCategory = s('beneficiary', 'primaryBeneficiaries');
  plan.beneficiary.indirectCategory = s('beneficiary', 'secondaryBeneficiaries');
  plan.beneficiary.selectionProcess = s('beneficiary', 'selectionCriteria');
  plan.beneficiary.specialRemark = s('beneficiary', 'beneficiaryNeeds');
  if (plan.beneficiary.directNumber > 0) {
    plan.expectedImpact.direct.kpis.push({ id: dedupeId(), name: 'Direct beneficiaries reached', unit: 'people', target: plan.beneficiary.directNumber, actual: 0, category: 'Direct' });
  }
  const lead = s('hr', 'teamLead');
  if (lead && lead !== managerName) plan.team.members.push({ id: dedupeId(), name: lead, role: 'Team Lead', group: 'Core' });
  plan.team.totalVolunteers = num(s('hr', 'volunteersRequired')) || (prop.volunteersRequired ?? 0);
  if (plan.team.totalVolunteers) plan.team.volunteers = [{ id: dedupeId(), category: s('hr', 'volunteerRoles') || 'Volunteers', number: plan.team.totalVolunteers }];
  plan.team.totalSalariesA = num(s('budget', 'personnelCosts'));
  const money = (name: string, amt: number) => ({ id: dedupeId(), type: 'Infrequent' as const, name, frequencyPerYear: 1, costPerQty: amt, total: amt });
  if (num(s('budget', 'materialCosts'))) plan.operations.push(money('Material costs', num(s('budget', 'materialCosts'))));
  if (num(s('budget', 'operationalCosts'))) plan.operations.push(money('Operational costs', num(s('budget', 'operationalCosts'))));
  if (num(s('budget', 'contingencyReserve'))) plan.operations.push(money('Contingency reserve', num(s('budget', 'contingencyReserve'))));
  const planned = plan.team.totalSalariesA + plan.operations.reduce((a, o) => a + o.total, 0);
  if (prop.estimatedBudget > planned) plan.operations.push(money('Unallocated (approved budget balance)', prop.estimatedBudget - planned));
  plan.funding.assumedAnnualBudget = prop.estimatedBudget;
  if (s('budget', 'fundingSources')) plan.funding.priority1.push({ id: dedupeId(), name: s('budget', 'fundingSources').slice(0, 120), amount: prop.estimatedBudget, status: 'Identified' });
  const pri = s('overview', 'implementingTeam');
  if (pri) plan.team.descriptions.core = pri;
  return { plan, deptResp: Object.fromEntries(depts.map(d => [d.id, d.responsible])) as Record<string, string> };
}

// POST /api/projects/from-proposal/:proposalId
export async function createProjectFromProposal(proposalId: string, input: ActivationInput): Promise<Project> {
  await load();
  if (db.projects.some(p => p.proposalId === proposalId)) fail(409, 'This proposal has already been activated.');
  const prop = await apiRequest<ProposalRecord>(`/proposals/${proposalId}`);
  if (prop.planningStatus !== 'Complete') fail(409, 'Final Project Plan is not complete – project cannot be activated.');
  const planning = await getPlanning(proposalId);
  const mgr = MANAGERS.find(m => m.id === input.managerId) ?? fail(422, 'Select a valid project manager');
  if (!input.startDate) fail(422, 'Start date is required');
  const s = (sec: string, f: string) => (planning.sections[sec]?.[f] ?? '').trim();
  const months = num(s('overview', 'duration')) || monthsBetween(prop.startDate ?? '', prop.endDate ?? '');
  const e = new Date(input.startDate); e.setMonth(e.getMonth() + months); e.setDate(e.getDate() - 1);
  const end = e.toISOString().slice(0, 10);
  const { plan, deptResp } = buildPlanFromProposal(prop, planning.sections, planning.departments, input.startDate, end, months, mgr.name);
  const totalBudget = plan.team.totalSalariesA + plan.operations.reduce((a, o) => a + o.total, 0);
  const sdg = Array.from(new Set((s('overview', 'sdgGoals').match(/\d{1,2}/g) ?? []).map(Number).filter(n => n >= 1 && n <= 17)));
  const year = new Date().getFullYear();
  let created: Row | null = null;
  for (let n = db.projects.length + 1; n < db.projects.length + 25 && !created; n++) {
    try {
      created = await apiCreate<Row>('projects', {
        projectCode: `PRJ-${year}-${String(n).padStart(3, '0')}`, proposalId, name: s('overview', 'projectName') || prop.title, sector: prop.category, summary: prop.summary ?? '',
        why: s('overview', 'visionMission'), problemStatement: s('beneficiary', 'beneficiaryNeeds'), status: input.startDate > today() ? 'Upcoming' : 'Active', currentStatus: 'Ideation',
        currentStage: 1, progress: 0, sdgGoals: sdg, activeSince: input.startDate, startDate: input.startDate, endDate: end,
        geography: { stage1: s('overview', 'location') || prop.geography || '', stage2: '', stage3: '' },
        planData: { plan, meta: { managerId: mgr.id, managerName: mgr.name, durationMonths: months, totalBudget } },
      });
    } catch (err) {
      if (!(err instanceof Error) || !/exist|duplicate|unique|conflict|already/i.test(err.message)) throw err;
      if (/proposal/i.test(err.message)) throw err;
    }
  }
  if (!created) fail(409, 'Could not allocate a project code. Please retry.');
  const projectId = created!.id as string;
  // Mirror the plan into the relational tables the Reports / Dashboard read, and reuse their ids so later edits stay in sync.
  for (const k of [...plan.expectedImpact.direct.kpis, ...plan.expectedImpact.indirect.kpis, ...plan.expectedImpact.societal.kpis]) {
    const r = await apiCreate<Row>('impact-indicators', { projectId, name: k.name, category: k.category === 'Societal' ? 'Indirect' : k.category, unit: k.unit, target: k.target, currentValue: 0 });
    k.id = r.id;
  }
  for (const m of plan.team.members) {
    const r = await apiCreate<Row>('team-members', { projectId, name: m.name, roleTitle: m.role, memberGroup: m.group });
    m.id = r.id;
  }
  if (plan.team.totalSalariesA > 0) await apiCreate('budget-items', { projectId, section: 'Salaries', itemName: 'Personnel costs', quantity: 1, unitCost: plan.team.totalSalariesA });
  for (const o of plan.operations) await apiCreate('budget-items', { projectId, section: 'Operations', itemName: o.name, itemType: o.type, quantity: o.frequencyPerYear || 1, unitCost: o.costPerQty });
  await apiUpdate('projects', projectId, { planData: { plan, meta: { managerId: mgr.id, managerName: mgr.name, durationMonths: months, totalBudget } } });
  created = { ...created!, planData: { plan, meta: { managerId: mgr.id, managerName: mgr.name, durationMonths: months, totalBudget } } };
  const p = projectFromRow(created!);
  p.managerId = mgr.id; p.managerName = mgr.name;
  db.projects.unshift(p);
  const w = wsOf(p.id);
  w.checklists.forEach(c => { const r = deptResp[c.department]; if (r) c.responsible = r; });
  log(p.id, 'Status', `Project activated from proposal ${prop.proposalCode} (${input.checklist.length} checklist items confirmed)`, mgr.name);
  await save(p.id);
  return out(p);
}

// PATCH /api/projects/:id
export async function updateProject(id: string, patch: Partial<Pick<Project, 'name' | 'sector' | 'why' | 'problemStatement' | 'sdgGoals' | 'currentStatus' | 'geographics' | 'status' | 'currentStage' | 'progress' | 'managerId' | 'startDate' | 'endDate'>>): Promise<Project> {
  await load();
  const p = proj(id);
  if (patch.name !== undefined && !patch.name.trim()) fail(422, 'Name is required');
  const body: Row = {};
  for (const k of ['name', 'sector', 'why', 'problemStatement', 'sdgGoals', 'currentStatus', 'status', 'currentStage', 'progress', 'startDate', 'endDate'] as const) {
    if (patch[k] !== undefined) body[k] = patch[k] === '' && (k === 'startDate' || k === 'endDate') ? null : patch[k];
  }
  if (patch.geographics) body.geography = patch.geographics;
  if (patch.status === 'Archived') body.archivedAt = new Date().toISOString();
  else if (patch.status) body.archivedAt = null;
  if (Object.keys(body).length) await apiUpdate('projects', id, body);
  Object.assign(p, patch);
  if (patch.managerId) p.managerName = MANAGERS.find(m => m.id === patch.managerId)?.name ?? p.managerName;
  p.archivedAt = patch.status === 'Archived' ? today() : patch.status ? undefined : p.archivedAt;
  if (patch.currentStage !== undefined) {
    p.plan.stages.forEach(s => { s.status = s.stage < p.currentStage ? 'Completed' : s.stage === p.currentStage ? 'In Progress' : 'Upcoming'; s.progress = s.status === 'Completed' ? 100 : s.status === 'Upcoming' ? 0 : s.progress; });
    log(id, 'Status', `Stage moved to Stage ${p.currentStage}`);
  }
  if (patch.status) log(id, 'Status', `Status changed to ${patch.status}`);
  await save(id);
  return out(p);
}
export async function archiveProject(id: string): Promise<Project> { return updateProject(id, { status: 'Archived' }); }

/* ═════════ Timeline ═════════ */

export async function addMilestone(projectId: string, m: NewMilestone): Promise<Milestone> {
  await load();
  if (!m.title.trim()) fail(422, 'Title is required');
  const ms: Milestone = { ...m, id: nid('ms') + dedupeId().slice(0, 4) };
  proj(projectId).plan.milestones.push(ms);
  log(projectId, 'Task', `Milestone added: ${m.title}`);
  await save(projectId);
  return out(ms);
}
export async function updateMilestone(projectId: string, milestoneId: string, patch: Partial<Milestone>): Promise<Milestone> {
  await load();
  const ms = proj(projectId).plan.milestones.find(x => x.id === milestoneId) ?? fail(404, 'Milestone not found');
  Object.assign(ms, patch);
  if (patch.status) log(projectId, 'Task', `Milestone "${ms.title}" marked ${patch.status}`);
  await save(projectId);
  return out(ms);
}
export async function updateStageProgress(projectId: string, stage: StageNo, progress: number): Promise<Project> {
  await load();
  const p = proj(projectId);
  const s = p.plan.stages.find(x => x.stage === stage) ?? fail(404, 'Stage not found');
  s.progress = Math.max(0, Math.min(100, progress));
  await save(projectId);
  return out(p);
}

/* ═════════ Team ═════════ */

export async function assignTeamMember(projectId: string, m: ProjectTeamPatch): Promise<TeamMember> {
  await load();
  if (!m.name.trim() || !m.role.trim()) fail(422, 'Name and role are required');
  proj(projectId);
  const row = await apiCreate<Row>('team-members', { projectId, name: m.name.trim(), roleTitle: m.role.trim(), memberGroup: m.group, organization: m.organisation || null, email: m.email || null });
  const tm: TeamMember = { ...m, id: row.id };
  proj(projectId).plan.team.members.push(tm);
  log(projectId, 'Team', `${m.name} assigned as ${m.role} (${m.group} team)`);
  await save(projectId);
  return out(tm);
}
export async function unassignTeamMember(projectId: string, memberId: string): Promise<void> {
  await load();
  const t = proj(projectId).plan.team;
  const m = t.members.find(x => x.id === memberId) ?? fail(404, 'Member not found');
  if (UUID.test(memberId)) await apiDelete('team-members', memberId);
  t.members = t.members.filter(x => x.id !== memberId);
  log(projectId, 'Team', `${m.name} unassigned from project`);
  await save(projectId);
}
export async function addPartner(projectId: string, p: Omit<Partner, 'id'>): Promise<Partner> {
  await load();
  if (!p.name.trim()) fail(422, 'Partner name is required');
  const partner: Partner = { ...p, id: dedupeId() };
  proj(projectId).plan.team.partners.push(partner);
  log(projectId, 'Team', `Working partner added: ${p.name}`);
  await save(projectId);
  return out(partner);
}
export async function removePartner(projectId: string, partnerId: string): Promise<void> {
  await load();
  const t = proj(projectId).plan.team;
  t.partners = t.partners.filter(x => x.id !== partnerId);
  await save(projectId);
}

/* ═════════ Tasks (project_tasks table) ═════════ */

export async function getTasks(projectId: string): Promise<Task[]> { await load(); proj(projectId); return out(db.tasks.filter(t => t.projectId === projectId)); }
export async function createTask(projectId: string, t: NewTask): Promise<Task> {
  await load();
  if (!t.title.trim()) fail(422, 'Title is required');
  proj(projectId);
  const row = await apiCreate<Row>('tasks', { projectId, ...taskBody(t) });
  const task = taskFromRow(row);
  db.tasks.push(task);
  log(projectId, 'Task', `Task created: ${t.title}`);
  await save(projectId);
  return out(task);
}
export async function updateTask(projectId: string, taskId: string, patch: Partial<NewTask>): Promise<Task> {
  await load();
  const t = db.tasks.find(x => x.id === taskId && x.projectId === projectId) ?? fail(404, 'Task not found');
  const prev = t.status;
  if (patch.title !== undefined && !patch.title.trim()) fail(422, 'Title is required');
  const row = await apiUpdate<Row>('tasks', taskId, taskBody(patch));
  Object.assign(t, taskFromRow(row));
  if (patch.status && patch.status !== prev) { log(projectId, 'Task', `Task "${t.title}" moved to ${patch.status}`); await save(projectId); }
  return out(t);
}
export async function deleteTask(projectId: string, taskId: string): Promise<void> {
  await load();
  await apiDelete('tasks', taskId);
  db.tasks = db.tasks.filter(t => !(t.id === taskId && t.projectId === projectId));
}

/* ═════════ Budget & expenses (project_expenses table) ═════════ */

export async function getBudget(projectId: string) {
  await load();
  const p = proj(projectId);
  const ex = db.expenses.filter(e => e.projectId === projectId);
  const by = (s: Expense['section']) => ex.filter(e => e.section === s).reduce((a, e) => a + e.amount, 0);
  const A = p.plan.team.totalSalariesA, B = p.plan.operations.reduce((s, o) => s + o.total, 0), C = p.plan.assets.reduce((s, a) => s + a.total, 0);
  const spent = by('Salaries') + by('Operations') + by('Assets');
  const detail: BudgetDetail = {
    summary: { salariesA: A, operationsB: B, assetsC: C, total: A + B + C, spent, remaining: A + B + C - spent, spentBySection: { salaries: by('Salaries'), operations: by('Operations'), assets: by('Assets') } },
    staff: p.plan.team.staff, totalStaff: p.plan.team.totalStaff, operations: p.plan.operations, assets: p.plan.assets, funding: p.plan.funding,
  };
  return out(detail);
}
export async function getExpenses(projectId: string): Promise<Expense[]> {
  await load(); proj(projectId);
  return out(db.expenses.filter(e => e.projectId === projectId).sort((a, b) => b.date.localeCompare(a.date)));
}
export async function addExpense(projectId: string, e: NewExpense): Promise<Expense> {
  await load();
  if (!(e.amount > 0)) fail(422, 'Amount must be greater than zero');
  if (!e.head.trim()) fail(422, 'Expense head is required');
  proj(projectId);
  const row = await apiCreate<Row>('expenses', { projectId, expenseDate: e.date, section: e.section, head: e.head.trim(), description: e.description ?? '', amount: e.amount, paidTo: e.paidTo?.trim() || 'N/A' });
  const ex = expenseFromRow(row);
  db.expenses.push(ex); refreshSpent();
  log(projectId, 'Budget', `Expense logged: ${inr(ex.amount)} – ${ex.head}`);
  await save(projectId);
  return out(ex);
}
export async function deleteExpense(projectId: string, expenseId: string): Promise<void> {
  await load();
  const ex = db.expenses.find(e => e.id === expenseId && e.projectId === projectId) ?? fail(404, 'Expense not found');
  await apiDelete('expenses', expenseId);
  db.expenses = db.expenses.filter(e => e.id !== expenseId); refreshSpent();
  log(projectId, 'Budget', `Expense deleted: ${inr(ex.amount)} – ${ex.head}`);
  await save(projectId);
}

/* ═════════ Departments ═════════ */

const recalc = (c: DepartmentChecklist): void => {
  const all = c.groups.flatMap(g => g.items);
  c.completion = all.length ? Math.round((all.filter(i => i.done).length / all.length) * 100) : 0;
};
export async function getDepartmentChecklist(projectId: string): Promise<DepartmentChecklist[]> { await load(); return out(wsOf(projectId).checklists); }
export async function updateChecklistItem(projectId: string, department: DepartmentKey, itemId: string, done: boolean): Promise<DepartmentChecklist> {
  await load();
  const c = wsOf(projectId).checklists.find(x => x.department === department) ?? fail(404, 'Department not found');
  const it = c.groups.flatMap(g => g.items).find(i => i.id === itemId) ?? fail(404, 'Checklist item not found');
  it.done = done; it.updatedAt = new Date().toISOString();
  recalc(c);
  log(projectId, 'Department', `${c.name}: "${it.label}" ${done ? 'completed' : 'reopened'}`);
  await save(projectId);
  return out(c);
}
export async function updateDepartment(projectId: string, department: DepartmentKey, patch: { responsible?: string; priority?: number | null }): Promise<DepartmentChecklist[]> {
  await load();
  const list = wsOf(projectId).checklists;
  const c = list.find(x => x.department === department) ?? fail(404, 'Department not found');
  if (patch.responsible !== undefined) c.responsible = patch.responsible;
  if (patch.priority !== undefined) {
    if (patch.priority !== null) { const other = list.find(x => x.priority === patch.priority && x.department !== department); if (other) other.priority = c.priority; }
    c.priority = patch.priority;
    proj(projectId).plan.responsibility = Array.from({ length: 7 }, (_, i) => ({ rank: i + 1, department: list.find(x => x.priority === i + 1)?.department ?? null }));
    log(projectId, 'Department', `${c.name} priority set to ${patch.priority ?? 'none'}`);
  }
  await save(projectId);
  return out(list);
}

/* ═════════ Documents & resources ═════════ */

export async function getDocuments(projectId: string): Promise<DocumentItem[]> { await load(); return out(wsOf(projectId).documents); }
export async function uploadDocument(projectId: string, docId: string, fileName: string): Promise<DocumentItem> {
  await load();
  const d = wsOf(projectId).documents.find(x => x.id === docId) ?? fail(404, 'Document not found');
  d.fileName = fileName; d.status = 'Uploaded'; d.uploadedAt = today(); d.uploadedBy = proj(projectId).managerName;
  log(projectId, 'Document', `Document uploaded: ${d.name}`);
  await save(projectId);
  return out(d);
}
export async function setDocumentStatus(projectId: string, docId: string, status: DocStatus): Promise<DocumentItem> {
  await load();
  const d = wsOf(projectId).documents.find(x => x.id === docId) ?? fail(404, 'Document not found');
  if (status !== 'Pending' && !d.fileName) fail(409, 'Upload a file before changing status');
  d.status = status;
  if (status === 'Pending') { d.fileName = undefined; d.uploadedAt = undefined; d.uploadedBy = undefined; }
  log(projectId, 'Document', `Document "${d.name}" marked ${status}`);
  await save(projectId);
  return out(d);
}
export async function getResources(projectId: string): Promise<ResourceItem[]> {
  await load();
  const p = proj(projectId);
  return out(p.plan.assets.map(a => ({ id: a.id, name: a.name, kind: a.type === 'Small' ? 'Small Asset' : 'Big Asset', qty: a.qty, location: p.geographics.stage1, custodian: p.managerName } as ResourceItem)));
}

/* ═════════ Impact ═════════ */

export async function getImpact(projectId: string): Promise<ImpactSummary> {
  await load();
  const p = proj(projectId);
  const b = p.plan.beneficiary;
  const entries = wsOf(projectId).impact.slice().sort((a, c) => c.date.localeCompare(a.date));
  const reached = (cat: 'Direct' | 'Indirect') => {
    const ks = allKpis(p).filter(k => k.category === cat && !CUMULATIVE_EXCLUDED.includes(k.unit));
    return ks.length ? Math.max(...ks.map(k => k.actual)) : 0;
  };
  return out({
    kpis: allKpis(p),
    beneficiaries: { directTarget: b.directNumber, directReached: Math.min(b.directNumber, reached('Direct')), indirectTarget: b.indirectNumber, indirectReached: Math.min(b.indirectNumber, reached('Indirect') * 4) },
    selectionProcess: b.selectionProcess, dataSource: b.dataSource, specialRemark: b.specialRemark, entries,
  });
}
export async function addImpactEntry(projectId: string, e: NewImpactEntry): Promise<ImpactEntry> {
  await load();
  const p = proj(projectId);
  const k = allKpis(p).find(x => x.id === e.kpiId) ?? fail(422, 'Select a KPI');
  if (!Number.isFinite(e.value) || e.value < 0) fail(422, 'Enter a valid value');
  const actual = CUMULATIVE_EXCLUDED.includes(k.unit) ? e.value : k.actual + e.value;
  if (UUID.test(k.id)) await apiUpdate('impact-indicators', k.id, { currentValue: actual });
  k.actual = actual;
  const entry: ImpactEntry = { ...e, id: dedupeId(), projectId, kpiName: k.name, addedBy: 'You' };
  wsOf(projectId).impact.push(entry);
  log(projectId, 'Impact', `Impact entry: ${k.name} → ${e.value} ${k.unit}`);
  await save(projectId);
  return out(entry);
}

/* ═════════ Monitoring ═════════ */

export async function getActivityLog(projectId: string): Promise<ActivityLog[]> { await load(); return out(wsOf(projectId).activity); }
export async function getRisks(projectId: string): Promise<RiskIssue[]> { await load(); return out(wsOf(projectId).risks); }
export async function addRisk(projectId: string, r: NewRisk): Promise<RiskIssue> {
  await load();
  if (!r.title.trim()) fail(422, 'Title is required');
  const risk: RiskIssue = { ...r, id: dedupeId(), projectId, raisedOn: today() };
  wsOf(projectId).risks.push(risk);
  log(projectId, 'Risk', `${r.type} raised: ${r.title} (${r.severity})`);
  await save(projectId);
  return out(risk);
}
export async function updateRisk(projectId: string, riskId: string, patch: Partial<NewRisk>): Promise<RiskIssue> {
  await load();
  const r = wsOf(projectId).risks.find(x => x.id === riskId) ?? fail(404, 'Risk not found');
  Object.assign(r, patch);
  if (patch.status) log(projectId, 'Risk', `"${r.title}" marked ${patch.status}`);
  await save(projectId);
  return out(r);
}

/* ═════════ Reports ═════════ */

// GET /api/reports/:type?projectId=&from=&to=
export async function getReport(type: ReportType, f: ReportFilters = {}): Promise<ReportData> {
  const params = new URLSearchParams();
  if (f.projectId && /^[0-9a-f-]{36}$/i.test(f.projectId)) params.set('projectId', f.projectId);
  if (f.from) params.set('from', f.from);
  if (f.to) params.set('to', f.to);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest<ReportData>(`/reports/${type}${query}`);
}
