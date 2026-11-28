import type { ReactNode } from "react"
import {
  LayoutDashboard,
  Home,
  FolderKanban,
  CalendarDays,
  Users,
  Heart,
  DollarSign,
  BarChart3,
  MessageSquare,
  Settings,
  ChevronDown,
  ChevronRight,
  Bell,
  Search,
  UserCircle,
  Menu,
  X,
  Gift,
  Target,
  Warehouse,
  FileText,
  BookUser,
  Briefcase,
  GraduationCap,
  UserCheck,
  Star,
  TrendingUp,
  Building2,
  Rocket,
  FileBarChart,
  HeartHandshake,
  UsersRound,
  LogOut,
  Sun,
  Moon,
  CalendarClock,
  Check,
  RefreshCw,
  AlertCircle,
} from "lucide-react"

export interface NavItem {
  label: string
  icon: ReactNode
  path?: string
  children?: { label: string; path: string; icon?: ReactNode; hint?: string }[]
}

export const navConfig: NavItem[] = [
  {
    label: "Dashboard",
    icon: <LayoutDashboard size={17} />,
    path: "/dashboard",
  },
  {
    label: "Projects",
    icon: <FolderKanban size={17} />,
    children: [
      {
        label: "Proposals",
        path: "/projects/proposals",
        icon: <FileText size={14} />,
        hint: "Draft & submit",
      },
      {
        label: "Planning",
        path: "/projects/planning",
        icon: <Target size={14} />,
        hint: "Detail the plan",
      },
      {
        label: "Activate",
        path: "/projects/activate",
        icon: <Rocket size={14} />,
        hint: "Admin go-live",
      },
      {
        label: "All Projects",
        path: "/projects",
        icon: <FolderKanban size={14} />,
        hint: "Track delivery",
      },
      {
        label: "Project Reports",
        path: "/projects/reports",
        icon: <FileBarChart size={14} />,
        hint: "Measure impact",
      },
    ],
  },
  {
    label: "Events",
    icon: <CalendarDays size={17} />,
    children: [
      {
        label: "Events",
        path: "/events",
        icon: <CalendarDays size={14} />,
      },
      {
        label: "Events Calendar",
        path: "/events/calendar",
        icon: <CalendarDays size={14} />,
      },
    ],
  },
  { label: "Beneficiaries", icon: <Heart size={17} />, path: "/beneficiaries" },
  {
    label: "Resources & Budget",
    icon: <Warehouse size={17} />,
    path: "/resources",
  },
  {
    label: "Occasions",
    icon: <Gift size={17} />,
    children: [
      {
        label: "Occasions Calendar",
        path: "/occasions",
        icon: <CalendarDays size={14} />,
      },
      { label: "Engagement", path: "/engagement", icon: <Target size={14} /> },
      { label: "Outcomes", path: "/outcomes", icon: <TrendingUp size={14} /> },
    ],
  },
  {
    label: "Reports",
    icon: <BarChart3 size={17} />,
    children: [
      { label: "Analytics", path: "/reports", icon: <BarChart3 size={14} /> },
      {
        label: "Department",
        path: "/reports/department",
        icon: <Building2 size={14} />,
      },
    ],
  },
  {
    label: "Communication",
    icon: <MessageSquare size={17} />,
    path: "/communication",
  },
  {
    label: "Birthday Project",
    icon: <Gift size={17} />,
    children: [
      {
        label: "Overview",
        path: "/birthday-project/dashboard",
        icon: <LayoutDashboard size={14} />,
      },
      {
        label: "Profiles",
        path: "/birthday-project/profiles",
        icon: <Users size={14} />,
      },
      {
        label: "Occasions",
        path: "/birthday-project/occasions",
        icon: <CalendarDays size={14} />,
      },
      {
        label: "Engagement",
        path: "/birthday-project/engagement",
        icon: <MessageSquare size={14} />,
      },
      {
        label: "Outcomes",
        path: "/birthday-project/outcomes",
        icon: <TrendingUp size={14} />,
      },
      {
        label: "Departments & RBAC",
        path: "/birthday-project/departments",
        icon: <Building2 size={14} />,
      },
      {
        label: "Reports",
        path: "/birthday-project/reports",
        icon: <BarChart3 size={14} />,
      },
      {
        label: "Action Workspace",
        path: "/birthday-project/action-workspace",
        icon: <Target size={14} />,
      },
    ],
  },
  {
    label: "Donor Management",
    icon: <HeartHandshake size={17} />,
    children: [
      {
        label: "Dashboard",
        path: "/donor-management/admin/dashboard",
        icon: <LayoutDashboard size={14} />,
      },
      {
        label: "Directory",
        path: "/donor-management/admin/directory",
        icon: <BookUser size={14} />,
      },
      {
        label: "Contributions",
        path: "/donor-management/admin/contributions",
        icon: <DollarSign size={14} />,
      },
      {
        label: "Campaigns",
        path: "/donor-management/admin/campaigns",
        icon: <Star size={14} />,
      },
      {
        label: "Communications",
        path: "/donor-management/admin/communications",
        icon: <MessageSquare size={14} />,
      },
      {
        label: "Follow-Up",
        path: "/donor-management/admin/followup",
        icon: <Target size={14} />,
      },
      {
        label: "Reports",
        path: "/donor-management/admin/reports",
        icon: <BarChart3 size={14} />,
      },
    ],
  },
  {
    label: "People Management",
    icon: <UsersRound size={17} />,
    children: [
      {
        label: "Overview",
        path: "/people-management",
        icon: <UsersRound size={14} />,
      },
      {
        label: "People Calendar",
        path: "/people-management/calendar",
        icon: <CalendarDays size={14} />,
      },
      {
        label: "People Tasks",
        path: "/people-management/tasks",
        icon: <Check size={14} />,
      },
      {
        label: "Attendance Overview",
        path: "/people-management/attendance",
        icon: <CalendarClock size={14} />,
      },
      {
        label: "HR Management",
        path: "/people-management/hr",
        icon: <Briefcase size={14} />,
      },
      {
        label: "Interns",
        path: "/people-management/interns",
        icon: <GraduationCap size={14} />,
      },
      {
        label: "Volunteers",
        path: "/people-management/volunteers",
        icon: <UserCheck size={14} />,
      },
    ],
  },
  { label: "Admin & Settings", icon: <Settings size={17} />, path: "/admin" },
]

/** Longest-prefix match of a pathname against a nav group's children. */
export function matchChild(item: NavItem, pathname: string) {
  let best: NonNullable<NavItem["children"]>[number] | null = null
  for (const c of item.children ?? []) {
    if (
      (pathname === c.path || pathname.startsWith(c.path + "/")) &&
      (!best || c.path.length > best.path.length)
    )
      best = c
  }
  return best
}

/** Resolve the module (nav group) and page the current URL belongs to. */
export function resolveLocation(pathname: string) {
  for (const item of navConfig) {
    if (item.path && (pathname === item.path || pathname.startsWith(item.path + "/")))
      return { group: undefined as NavItem | undefined, leaf: item.label, item }
  }
  let found: { group: NavItem; child: NonNullable<NavItem["children"]>[number] } | null = null
  for (const item of navConfig) {
    const child = matchChild(item, pathname)
    if (child && (!found || child.path.length > found.child.path.length)) found = { group: item, child }
  }
  return found
    ? { group: found.group, leaf: found.child.label, item: found.group, child: found.child }
    : null
}
