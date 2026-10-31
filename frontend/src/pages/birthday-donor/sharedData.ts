export interface DonorProfileItem {
  id: number | string;
  code?: string;
  name: string;
  type: 'Individual' | 'Corporate' | 'Foundation' | 'Government';
  city: string;
  state?: string;
  email?: string;
  phone?: string;
  status: 'Active' | 'Engaged' | 'Retention' | 'Lapsed' | 'New';
  relation: string;
  cause: string;
  amount: string; // e.g. "₹2.4L"
  amountNumeric?: number;
  lastContact: string;
  connectionSource?: string;
  birthDate?: string;
  notes?: string;
}

export interface BirthdayProfileItem {
  id: number | string;
  name: string;
  relation: 'Individual' | 'Corporate' | 'Volunteer' | 'Partner' | 'Advisor';
  interest: string;
  status: 'Warm' | 'Engaged' | 'Conversion' | 'Active' | 'Retention';
  nextAction: string;
  city: string;
  birthDate?: string;
  email?: string;
  phone?: string;
  notes?: string;
  donorId?: number | string;
}

export interface OccasionItem {
  id: string;
  title: string;
  donorName?: string;
  date: string;
  tag: 'Priority' | 'Campaign' | 'Corporate' | 'Individual';
  occasionType?: 'Birthday' | 'Anniversary' | 'Foundation Day' | 'Volunteer Day' | 'Appreciation';
  reminderDays?: number;
  notes?: string;
}

export interface BirthdayTaskItem {
  id?: string;
  title: string;
  type: 'Gift' | 'Call' | 'Visit' | 'Email' | 'WhatsApp';
  assignee: string;
  donorName?: string;
  status: 'Pending' | 'Scheduled' | 'In progress' | 'Completed';
  priority?: 'High' | 'Medium' | 'Low';
  dueDate?: string;
  remarks?: string;
}

export interface ContributionItem {
  id?: string;
  donor: string;
  category: string;
  amount: number;
  date: string;
  group?: 'Public & Small' | 'Corporate & Large' | 'Self-Funding';
  paymentMethod?: string;
  reference?: string;
  notes?: string;
}

export interface CampaignItem {
  id?: string;
  name: string;
  progress: number;
  amount: string;
  target?: string;
  status: 'Active' | 'Upcoming' | 'Completed';
  cause?: string;
  donorsCount?: number;
}

export interface CommunicationLogItem {
  id?: string;
  date: string;
  donorName?: string;
  action: string;
  type: 'Call' | 'Email' | 'Meeting' | 'Visit' | 'Gift' | 'WhatsApp';
  staff?: string;
  summary?: string;
}

export interface PipelineLaneItem {
  lane: string;
  items: string[];
}

export interface DepartmentWorkspaceTask {
  id: string;
  dept: string;
  title: string;
  stage: 'To do' | 'Doing' | 'Done';
  priority: 'High' | 'Medium' | 'Low';
  assignee: string;
  dueDate: string;
}

export const donorProfiles: DonorProfileItem[] = [
  { id: 1, code: 'DON-101', name: 'Asha Nair', type: 'Individual', city: 'Bengaluru', state: 'Karnataka', email: 'asha.nair@example.com', phone: '+91 98765 43210', status: 'Active', relation: 'Regular Donor', cause: 'Education', amount: '₹2,40,000', amountNumeric: 240000, lastContact: '2 days ago', connectionSource: 'Community Referral', birthDate: '1989-10-12', notes: 'Interested in sponsoring scholarships for girl students.' },
  { id: 2, code: 'DON-102', name: 'Sparsh Foods Pvt Ltd', type: 'Corporate', city: 'Pune', state: 'Maharashtra', email: 'csr@sparshfoods.in', phone: '+91 98230 11223', status: 'Engaged', relation: 'Corporate Partner', cause: 'Nutrition', amount: '₹12,80,000', amountNumeric: 1280000, lastContact: '5 days ago', connectionSource: 'CSR Summit 2024', birthDate: '2015-04-18', notes: 'Key supporter of our school mid-day meal kitchens.' },
  { id: 3, code: 'DON-103', name: 'Rural Impact Collective', type: 'Corporate', city: 'Delhi', state: 'Delhi NCR', email: 'contact@ruralimpact.org', phone: '+91 98110 55443', status: 'New', relation: 'Network', cause: 'Women Empowerment', amount: '₹8,10,000', amountNumeric: 810000, lastContact: '1 week ago', connectionSource: 'Inbound Web Inquiry', birthDate: '2018-09-05', notes: 'Exploring artisan self-help group funding.' },
  { id: 4, code: 'DON-104', name: 'Nitin Mehta', type: 'Individual', city: 'Jaipur', state: 'Rajasthan', email: 'nitin.mehta@example.com', phone: '+91 94140 77889', status: 'Retention', relation: 'Recurring', cause: 'Health', amount: '₹3,70,000', amountNumeric: 370000, lastContact: '3 days ago', connectionSource: 'Hospital Outreach Campaign', birthDate: '1975-11-04', notes: 'Donates monthly towards rural mobile health clinics.' },
  { id: 5, code: 'DON-105', name: 'Kirana Foundation', type: 'Corporate', city: 'Ahmedabad', state: 'Gujarat', email: 'grants@kiranafdn.org', phone: '+91 97250 99001', status: 'Active', relation: 'Grant Partner', cause: 'Climate', amount: '₹15,20,000', amountNumeric: 1520000, lastContact: '9 days ago', connectionSource: 'Foundation Grant', birthDate: '2012-07-20', notes: 'Multi-year agroforestry and solar irrigation grant partner.' },
  { id: 6, code: 'DON-106', name: 'Vihaan Group', type: 'Corporate', city: 'Hyderabad', state: 'Telangana', email: 'sponsorships@vihaangroup.com', phone: '+91 99890 33445', status: 'Active', relation: 'Sponsorship', cause: 'Livelihood', amount: '₹19,50,000', amountNumeric: 1950000, lastContact: '4 days ago', connectionSource: 'Leadership Board', birthDate: '2010-02-14', notes: 'Sponsors vocational skilling centers for youth.' },
];

export const birthdayProfiles: BirthdayProfileItem[] = [
  { id: 1, name: 'Rajesh Kumar', relation: 'Individual', interest: 'Education, Women support', status: 'Warm', nextAction: 'Call and gift bouquet', city: 'Patna', birthDate: '1985-10-12', phone: '+91 94310 12345', email: 'rajesh.k@example.com', notes: 'Celebrates birthday with village children every year.' },
  { id: 2, name: 'Lakshmi & Co.', relation: 'Corporate', interest: 'Healthcare & Nutrition', status: 'Engaged', nextAction: 'CSR milestone check-in', city: 'Chennai', birthDate: '2011-10-18', phone: '+91 98400 98765', email: 'csr@lakshmico.com', notes: 'Foundation Day celebration this month.' },
  { id: 3, name: 'Shailja Verma', relation: 'Volunteer', interest: 'Community outreach', status: 'Conversion', nextAction: 'Send thank-you certificate', city: 'Lucknow', birthDate: '1992-10-22', phone: '+91 99350 44556', email: 'shailja.v@example.com', notes: 'Active volunteer in literacy drives.' },
  { id: 4, name: 'Uday Foundation', relation: 'Partner', interest: 'School nutrition & sanitation', status: 'Active', nextAction: 'Occasion reminder & calendar', city: 'Nagpur', birthDate: '2016-10-25', phone: '+91 98900 66778', email: 'director@udayfoundation.org', notes: 'Partner anniversary celebration.' },
];

export const initialOccasionsList: OccasionItem[] = [
  { id: 'OCC-1', title: 'Rajesh Kumar birthday celebration', donorName: 'Rajesh Kumar', date: '12 Oct', tag: 'Priority', occasionType: 'Birthday', reminderDays: 7, notes: 'Deliver personalized handwritten card.' },
  { id: 'OCC-2', title: 'Lakshmi & Co. Foundation Day', donorName: 'Lakshmi & Co.', date: '18 Oct', tag: 'Corporate', occasionType: 'Foundation Day', reminderDays: 5, notes: 'Deliver annual CSR impact packet.' },
  { id: 'OCC-3', title: 'Shailja Verma volunteer anniversary', donorName: 'Shailja Verma', date: '22 Oct', tag: 'Campaign', occasionType: 'Volunteer Day', reminderDays: 3, notes: 'Share community volunteer photo collage.' },
  { id: 'OCC-4', title: 'Uday Foundation partnership celebration', donorName: 'Uday Foundation', date: '25 Oct', tag: 'Priority', occasionType: 'Anniversary', reminderDays: 7, notes: 'Leadership call from Managing Trustee.' },
];

export const initialDepartmentTasks: DepartmentWorkspaceTask[] = [
  { id: 'DT-1', dept: 'Project Management', title: 'Compile mid-quarter milestone tracker', stage: 'Doing', priority: 'High', assignee: 'Priya', dueDate: '2026-11-05' },
  { id: 'DT-2', dept: 'Project Management', title: 'Audit resource dispatch for relief camps', stage: 'To do', priority: 'Medium', assignee: 'Vivek', dueDate: '2026-11-10' },
  { id: 'DT-3', dept: 'Project Management', title: 'Publish project progress dashboard', stage: 'Done', priority: 'High', assignee: 'Priya', dueDate: '2026-10-28' },
  { id: 'DT-4', dept: 'Finance', title: 'Reconcile 80G tax receipt batch for Q2', stage: 'Done', priority: 'High', assignee: 'Ritu', dueDate: '2026-10-30' },
  { id: 'DT-5', dept: 'Finance', title: 'Issue CSR utilization certificate for Sparsh Foods', stage: 'Doing', priority: 'High', assignee: 'Ritu', dueDate: '2026-11-02' },
  { id: 'DT-6', dept: 'Marketing', title: 'Launch Diwali matching gift campaign creatives', stage: 'Doing', priority: 'High', assignee: 'Arun', dueDate: '2026-11-04' },
  { id: 'DT-7', dept: 'Administration', title: 'Review staff security and access permissions', stage: 'Done', priority: 'Medium', assignee: 'Admin Team', dueDate: '2026-10-29' },
  { id: 'DT-8', dept: 'HR', title: 'Conduct quarterly volunteer recognition round', stage: 'To do', priority: 'Medium', assignee: 'Nisha', dueDate: '2026-11-12' },
  { id: 'DT-9', dept: 'Research & Innovation', title: 'Draft longitudinal child nutrition impact report', stage: 'Doing', priority: 'Low', assignee: 'Raj', dueDate: '2026-11-15' },
];

export const contributionData = [
  { month: 'Jan', amount: 120000 },
  { month: 'Feb', amount: 145000 },
  { month: 'Mar', amount: 131000 },
  { month: 'Apr', amount: 160000 },
  { month: 'May', amount: 176000 },
  { month: 'Jun', amount: 182000 },
  { month: 'Jul', amount: 205000 },
  { month: 'Aug', amount: 214000 },
  { month: 'Sep', amount: 198000 },
];

export const revenueByCategory = [
  { name: 'Public', value: 42, color: '#1AACB8' },
  { name: 'Corporate', value: 31, color: '#3B82F6' },
  { name: 'Self-funding', value: 19, color: '#10B981' },
  { name: 'Grants', value: 8, color: '#F59E0B' },
];

export const donorTasks = [
  { title: 'Call donor Asha Nair', type: 'Call', assignee: 'Priya', status: 'Pending' },
  { title: 'Visit Lakshmi & Co. team', type: 'Visit', assignee: 'Vivek', status: 'In progress' },
  { title: 'Send thank-you note to Veena', type: 'Gift', assignee: 'Raj', status: 'Completed' },
];

export const birthdayTasks: BirthdayTaskItem[] = [
  { id: 'BT-1', title: 'Prepare birthday gift packet for Rajesh Kumar', type: 'Gift', assignee: 'Ritu', donorName: 'Rajesh Kumar', status: 'Pending', priority: 'High', dueDate: '12 Oct', remarks: 'Handmade card and organic tea box' },
  { id: 'BT-2', title: 'Call donor for occasion reminder & greetings', type: 'Call', assignee: 'Nisha', donorName: 'Lakshmi & Co.', status: 'Scheduled', priority: 'Medium', dueDate: '18 Oct', remarks: 'Check for CSR director availability' },
  { id: 'BT-3', title: 'Document outreach feedback & photos', type: 'Visit', assignee: 'Arun', donorName: 'Shailja Verma', status: 'Completed', priority: 'Low', dueDate: '22 Oct', remarks: 'Captured volunteer testimonials' },
];

export const campaignData: CampaignItem[] = [
  { id: 'CMP-1', name: 'School Meals', progress: 78, amount: '₹18.5L', target: '₹24L', status: 'Active', cause: 'Education Access', donorsCount: 142 },
  { id: 'CMP-2', name: 'Women Skill Up', progress: 61, amount: '₹14.2L', target: '₹23L', status: 'Active', cause: 'Women Empowerment', donorsCount: 98 },
  { id: 'CMP-3', name: 'Health Outreach', progress: 44, amount: '₹9.3L', target: '₹21L', status: 'Upcoming', cause: 'Healthcare Outreach', donorsCount: 65 },
  { id: 'CMP-4', name: 'Forest Guardians', progress: 92, amount: '₹21.1L', target: '₹23L', status: 'Completed', cause: 'Climate Resilience', donorsCount: 184 },
];

export const causeData = [
  { name: 'Education Access', donors: 240, budget: '₹42L' },
  { name: 'Women Empowerment', donors: 164, budget: '₹38L' },
  { name: 'Healthcare Outreach', donors: 132, budget: '₹29L' },
  { name: 'Climate Resilience', donors: 118, budget: '₹24L' },
];

export const deptWorkspaces = [
  'Project Management', 'Administration', 'Data & Tech', 'Finance', 'HR', 'Risk Management', 'Research & Innovation', 'Marketing', 'Networking',
];

export const departmentMetrics = [
  { dept: 'Project Management', tasks: 42, completion: '84%' },
  { dept: 'Finance', tasks: 28, completion: '91%' },
  { dept: 'Marketing', tasks: 37, completion: '76%' },
  { dept: 'Research & Innovation', tasks: 18, completion: '68%' },
  { dept: 'Administration', tasks: 15, completion: '93%' },
  { dept: 'HR', tasks: 22, completion: '82%' },
];

export const monthlyTrend = [
  { month: 'Jan', donors: 120, contributions: 180000 },
  { month: 'Feb', donors: 134, contributions: 213500 },
  { month: 'Mar', donors: 146, contributions: 192000 },
  { month: 'Apr', donors: 155, contributions: 248000 },
  { month: 'May', donors: 164, contributions: 261000 },
  { month: 'Jun', donors: 180, contributions: 282000 },
  { month: 'Jul', donors: 195, contributions: 310000 },
  { month: 'Aug', donors: 210, contributions: 345000 },
  { month: 'Sep', donors: 228, contributions: 378000 },
];

export const cityDistribution = [
  { place: 'Bengaluru', count: 42 },
  { place: 'Mumbai', count: 38 },
  { place: 'Delhi', count: 29 },
  { place: 'Hyderabad', count: 24 },
  { place: 'Ahmedabad', count: 21 },
  { place: 'Pune', count: 19 },
  { place: 'Jaipur', count: 14 },
];

export const donorSegments = [
  { name: 'New', value: 18, color: '#14b8a6' },
  { name: 'Existing', value: 52, color: '#3b82f6' },
  { name: 'Lapsed', value: 21, color: '#f59e0b' },
  { name: 'High value', value: 9, color: '#8b5cf6' },
];

export const communicationTimeline: CommunicationLogItem[] = [
  { id: 'COM-1', date: '09 Oct 2026', donorName: 'Asha Nair', action: 'Confirmed annual education scholarship sponsorship pledge', type: 'Call', staff: 'Priya', summary: 'Donor agreed to renew ₹25,000 online support for upcoming term.' },
  { id: 'COM-2', date: '08 Oct 2026', donorName: 'Sparsh Foods Pvt Ltd', action: 'CSR milestone impact video and photos shared', type: 'Email', staff: 'Vivek', summary: 'Shared footage from newly commissioned mid-day meal kitchen in Pune.' },
  { id: 'COM-3', date: '06 Oct 2026', donorName: 'Kirana Foundation', action: 'Semi-annual grant review conference held', type: 'Meeting', staff: 'Managing Trustee', summary: 'Reviewed nursery sapling plantation targets across 12 villages.' },
  { id: 'COM-4', date: '04 Oct 2026', donorName: 'Nitin Mehta', action: 'WhatsApp greeting and monthly health camp schedule sent', type: 'WhatsApp', staff: 'Nisha', summary: 'Donor acknowledged receipt and requested copy of patient diagnosis register.' },
];

export const donorPipeline: PipelineLaneItem[] = [
  { lane: 'Identify', items: ['Asha Nair', 'Kiran Sharma', 'Dr. Arvind Joshi'] },
  { lane: 'Profile', items: ['Vihaan Group', 'Rural Impact Collective'] },
  { lane: 'Connect', items: ['Sparsh Foods Pvt Ltd', 'Anand Milk Producers'] },
  { lane: 'Inspire Donation', items: ['Nitin Mehta', 'Green Horizon Trust'] },
  { lane: 'Engage', items: ['Kirana Foundation', 'Meera Swaminathan'] },
  { lane: 'Maintain Relationship', items: ['Rajesh Kumar', 'Lakshmi & Co.'] },
];

export const activityLog = [
  { label: 'System occasion alert sent to assigned field officer', done: true },
  { label: 'Previous donor relationship & gift history reviewed', done: true },
  { label: 'Cause interests and campaign alignment validated', done: true },
  { label: 'Staff assignment confirmed & phone outreach initiated', done: false },
  { label: 'Follow-up pledge schedule logged in CRM', done: false },
];

export const rolePermissions = [
  { role: 'Admin', routes: 'All routes', actions: 'Full control (create, read, update, delete, role assignment)', data: 'All organisation records, payroll, audit logs' },
  { role: 'Staff / Project Manager', routes: 'Dashboard, Donors, Birthday Project, Reports', actions: 'Create & update donors, log calls, complete tasks, record pledges', data: 'Assigned programs, active donors, communication history' },
  { role: 'Volunteer', routes: 'Birthday Project Task Cards & Action Workspace', actions: 'View assigned task cards, complete outreach checklists, upload proof', data: 'Assigned contacts and basic profile notes only' },
  { role: 'Board', routes: 'Executive Reports, Financial summaries, Analytics', actions: 'Read-only report viewing and data export', data: 'Aggregated analytics and governance summaries' },
  { role: 'Member', routes: 'Access pending verification page only', actions: 'Awaiting admin approval for team assignment', data: 'No donor or financial records access' },
];

export const greetingTemplates = [
  {
    id: 'tpl-bday-ind',
    name: 'Birthday – Individual Supporter',
    category: 'Birthday',
    template: 'Dear {name}, Wishing you a very Happy Birthday from all of us at Hope Foundation! On your special day, we celebrate the hope and kindness you bring to children and families across our communities. May this year bring you boundless joy and good health.',
  },
  {
    id: 'tpl-anniv-corp',
    name: 'Corporate Milestone / Foundation Day',
    category: 'Anniversary',
    template: 'Dear Team {name}, Heartiest congratulations on your anniversary milestone! We deeply value our partnership and the transformative social impact we achieve together through your generous CSR backing.',
  },
  {
    id: 'tpl-grat-festive',
    name: 'Gratitude & Festive Greetings',
    category: 'Gratitude',
    template: 'Warm greetings {name}! As we celebrate this joyous season, we pause to extend our deepest gratitude for your enduring faith in our mission. Because of your support, thousands find light and opportunity.',
  },
  {
    id: 'tpl-volunteer-milestone',
    name: 'Volunteer Appreciation Day',
    category: 'Milestone',
    template: 'Dear {name}, On this celebration of service, thank you for sharing your time, passion, and spirit with our children. You are the beating heart of our ground outreach.',
  },
];
