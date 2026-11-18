import type { AuthUser } from '../context/AuthContext';

export type AppRole = AuthUser['role'];

const OPS: AppRole[] = ['Admin', 'Project Manager', 'Staff'];

/**
 * Route access matrix (longest matching prefix wins).
 * Mirrors the server-side rules in backend/app/api — the API remains the source of truth.
 */
const RULES: [prefix: string, roles: AppRole[]][] = [
  ['/dashboard', OPS],
  ['/home', ['Volunteer', 'Board']],
  ['/projects', OPS],
  ['/projects/activate', ['Admin']],
  ['/projects/proposals', ['Admin', 'Project Manager']],
  ['/projects/planning', ['Admin', 'Project Manager']],
  ['/events', OPS],
  ['/beneficiaries', OPS],
  ['/resources', OPS],
  ['/reports', OPS],
  ['/people-management', OPS],
  ['/occasions', ['Admin', 'Staff']],
  ['/engagement', ['Admin', 'Staff']],
  ['/outcomes', ['Admin', 'Staff']],
  ['/communication', ['Admin', 'Staff']],
  ['/birthday-project', ['Admin', 'Staff']],
  ['/donor-management', ['Admin', 'Staff']],
  ['/people-management/tasks', ['Admin', 'Project Manager', 'Staff', 'Volunteer']],
  ['/admin', ['Admin']],
];

export function canAccess(role: AppRole | undefined, path: string): boolean {
  if (!role) return false;
  let best: [string, AppRole[]] | null = null;
  for (const rule of RULES) {
    const [prefix] = rule;
    if ((path === prefix || path.startsWith(prefix + '/')) && (!best || prefix.length > best[0].length)) best = rule;
  }
  return best ? best[1].includes(role) : false;
}

export function homeFor(role: AppRole | undefined): string {
  if (role === 'Member') return '/access-pending';
  if (role === 'Volunteer' || role === 'Board') return '/home';
  return '/dashboard';
}
