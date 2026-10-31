import type { AppRole } from './access';

/** Built-in demo logins. Must match backend/scripts/seed_users.py. */
export const DEMO_ACCOUNTS: { role: AppRole; email: string; password: string; blurb: string }[] = [
  { role: 'Admin', email: 'admin@hopefoundation.org', password: 'Admin@Hope2026', blurb: 'Full access, approvals & user roles' },
  { role: 'Project Manager', email: 'manager@hopefoundation.org', password: 'Manager@Hope2026', blurb: 'Proposals, planning & projects' },
  { role: 'Staff', email: 'staff@hopefoundation.org', password: 'Staff@Hope2026', blurb: 'Operations, donors & communication' },
  { role: 'Volunteer', email: 'volunteer@hopefoundation.org', password: 'Volunteer@Hope2026', blurb: 'My tasks & upcoming events' },
  { role: 'Board', email: 'board@hopefoundation.org', password: 'Board@Hope2026', blurb: 'Read-only organisation overview' },
];
