import { useEffect, useRef, useState } from "react"
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import {
  Home,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Bell,
  Search,
  Menu,
  X,
  LogOut,
  Sun,
  Moon,
  CalendarClock,
  Check,
  RefreshCw,
  AlertCircle,
} from "lucide-react"
import logoUrl from "../assets/hope-logo.svg"
import markUrl from "../assets/hope-mark.svg"
import { useAuth } from "../context/AuthContext"
import usePersistentState from "../hooks/usePersistentState"
import { apiRequest } from "../services/apiClient"
import { canAccess } from "../lib/access"
import { navConfig, resolveLocation, type NavItem } from "../lib/navConfig"
import ChartGradients from "./ChartGradients"
import CommandSearch from "./CommandSearch"
import ModuleFlow from "./ModuleFlow"

interface DashboardReminders {
  upcomingEvents: { title: string; date: string; location: string; type: string }[]
  pendingTasks: { task: string; priority: string; due: string }[]
}

interface Reminder {
  id: string
  title: string
  detail: string
  type: "event" | "task"
  important: boolean
}

function NavGroup({ item: rawItem, collapsed }: { item: NavItem; collapsed: boolean }) {
  const location = useLocation()
  const { user } = useAuth()
  // Only Admins can activate projects.
  const item: NavItem = rawItem.children
    ? { ...rawItem, children: rawItem.children.filter((c) => canAccess(user?.role, c.path)) }
    : rawItem
  const isAnyChildActive =
    item.children?.some((c) => location.pathname.startsWith(c.path)) ?? false
  const isEnd = (path: string) =>
    path === "/projects" ||
    path === "/people-management" ||
    path === "/events" ||
    path === "/reports"
  const [open, setOpen] = useState(isAnyChildActive)
  if (item.children ? item.children.length === 0 : !canAccess(user?.role, item.path ?? "")) return null

  useEffect(() => {
    if (isAnyChildActive) setOpen(true)
  }, [isAnyChildActive])

  if (!item.children) {
    return (
      <NavLink
        to={item.path!}
        className={({ isActive }) =>
          `sidebar-nav-item ${isActive ? "active" : ""}`
        }
        title={collapsed ? item.label : undefined}
      >
        {item.icon}
        {!collapsed && <span>{item.label}</span>}
      </NavLink>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={collapsed ? item.label : undefined}
        className={`sidebar-nav-item w-full ${
          isAnyChildActive ? "has-active" : ""
        }`}
        title={collapsed ? item.label : undefined}
      >
        {item.icon}
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{item.label}</span>
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </>
        )}
      </button>
      {open && !collapsed && (
        <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-slate-700 pl-3">
          {item.children.map((child) => (
            <NavLink
              key={child.path}
              to={child.path}
              end={isEnd(child.path)}
              className={({ isActive }) =>
                `sidebar-nav-item text-[13px] py-1.5 ${
                  isActive ? "active" : ""
                }`
              }
            >
              {child.icon}
              <span>{child.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notice, setNotice] = useState("")
  const { user, logout } = useAuth()
  const [theme, setTheme] = usePersistentState<"light" | "dark">(
    "ngo-theme",
    "light",
  )
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [reminderData, setReminderData] = useState<DashboardReminders | null>(
    null,
  )
  const [remindersLoading, setRemindersLoading] = useState(false)
  const [remindersError, setRemindersError] = useState("")
  const [readReminders, setReadReminders] = usePersistentState<string[]>(
    `ngo-read-reminders-${user?.id ?? "guest"}`,
    [],
  )
  const location = useLocation()
  const navigate = useNavigate()
  const isOps = user?.role === "Admin" || user?.role === "Project Manager" || user?.role === "Staff"
  const headerActionsRef = useRef<HTMLDivElement>(null)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        !!target &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setSearchOpen(true)
      } else if (event.key === "/" && !typing) {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener("keydown", onShortcut)
    return () => document.removeEventListener("keydown", onShortcut)
  }, [])

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !headerActionsRef.current?.contains(event.target)
      ) {
        setProfileOpen(false)
        setNotificationsOpen(false)
      }
    }
    const closeMenusOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileOpen(false)
        setNotificationsOpen(false)
      }
    }
    document.addEventListener("mousedown", closeMenus)
    document.addEventListener("keydown", closeMenusOnEscape)
    return () => {
      document.removeEventListener("mousedown", closeMenus)
      document.removeEventListener("keydown", closeMenusOnEscape)
    }
  }, [])

  const onLogout = async () => {
    await logout()
    navigate("/login", { replace: true })
  }

  const loadReminders = async () => {
    setRemindersLoading(true)
    setRemindersError("")
    try {
      setReminderData(await apiRequest<DashboardReminders>("/dashboard/reminders"))
    } catch (error) {
      setRemindersError(
        error instanceof Error ? error.message : "Could not load reminders.",
      )
    } finally {
      setRemindersLoading(false)
    }
  }

  const reminders: Reminder[] = [
    ...(reminderData?.pendingTasks ?? []).map((task) => ({
      id: `task:${task.task}:${task.due}`,
      title: task.task,
      detail:
        task.due === "No due date"
          ? `${task.priority} priority · No due date`
          : `Due ${task.due} · ${task.priority} priority`,
      type: "task" as const,
      important: task.priority === "Critical" || task.priority === "High",
    })),
    ...(reminderData?.upcomingEvents ?? []).map((event) => ({
      id: `event:${event.title}:${event.date}`,
      title: event.title,
      detail: `${new Date(event.date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}${
        event.location ? ` · ${event.location}` : ""
      }`,
      type: "event" as const,
      important: false,
    })),
  ]
  const unreadCount = reminders.filter(
    (reminder) => !readReminders.includes(reminder.id),
  ).length

  const toggleNotifications = () => {
    const willOpen = !notificationsOpen
    setNotificationsOpen(willOpen)
    setProfileOpen(false)
    if (willOpen && !reminderData && !remindersLoading) void loadReminders()
  }

  const markAllRead = () => {
    setReadReminders((current) =>
      Array.from(
        new Set([...current, ...reminders.map((reminder) => reminder.id)]),
      ),
    )
  }

  useEffect(() => {
    const handleNotice = (event: Event) => {
      const message = (event as CustomEvent<string>).detail
      setNotice(message)
      window.setTimeout(() => setNotice(""), 2800)
    }
    window.addEventListener("ngo:notify", handleNotice)
    return () => window.removeEventListener("ngo:notify", handleNotice)
  }, [])

  const crumbs: { label: string; to?: string }[] = (() => {
    const path = location.pathname
    if (path === "/home") return [{ label: "My Workspace" }]
    const resolved = resolveLocation(path)
    if (!resolved) return [{ label: "Hope Foundation" }]
    if (!resolved.group) return [{ label: resolved.leaf }]
    const trail: { label: string; to?: string }[] = [
      { label: resolved.group.label },
    ]
    const childPath = resolved.child!.path
    if (path === "/projects/activate" || path.startsWith("/projects/")) {
      // Project detail pages sit under "All Projects"
      if (path !== "/projects/activate" && !["/projects/reports", "/projects/proposals", "/projects/planning"].includes(path)) {
        trail.push({ label: "All Projects", to: "/projects" }, { label: "Project Details" })
        return trail
      }
    }
    trail.push({ label: resolved.leaf, to: path === childPath ? undefined : childPath })
    return trail
  })()

  return (
    <div
      className="app-shell flex h-screen overflow-hidden"
      style={{ background: "var(--app-background)" }}
    >
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:relative z-50 lg:z-auto h-full flex flex-col
          transition-all duration-300 ease-in-out
          ${collapsed ? "w-[60px]" : "w-[240px]"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        style={{
          background: "var(--color-sidebar)",
          boxShadow: "2px 0 20px rgba(0,0,0,0.15)",
        }}
      >
        {/* Logo */}
        <div
          className={`flex items-center justify-center px-3 py-3 border-b border-slate-700/60 ${
            collapsed ? "" : "min-h-[104px]"
          }`}
        >
          <img
            src={collapsed ? markUrl : logoUrl}
            alt="Hope Foundation"
            className={`${
              collapsed ? "h-10 w-10" : "h-[80px] w-full max-w-[200px]"
            } flex-shrink-0 object-contain`}
          />
        </div>

        {/* Collapse toggle (desktop) */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden lg:flex absolute -right-3 top-16 w-6 h-6 rounded-full items-center justify-center z-10 border border-slate-600 shadow-sm"
          style={{ background: "var(--color-primary)", color: "#fff" }}
        >
          {collapsed ? (
            <ChevronRight size={12} />
          ) : (
            <ChevronDown size={12} style={{ transform: "rotate(90deg)" }} />
          )}
        </button>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-0.5">
          <NavGroup item={{ label: "My Workspace", icon: <Home size={17} />, path: "/home" }} collapsed={collapsed} />
          {!collapsed && isOps && <span className="sidebar-group-label">Main Menu</span>}
          {navConfig.slice(0, 6).map((item) => (
            <NavGroup key={item.label} item={item} collapsed={collapsed} />
          ))}
          {!collapsed && isOps && <span className="sidebar-group-label">Programs</span>}
          {navConfig.slice(6, 8).map((item) => (
            <NavGroup key={item.label} item={item} collapsed={collapsed} />
          ))}
          {!collapsed && isOps && <span className="sidebar-group-label">Modules</span>}
          {navConfig.slice(8, -1).map((item) => (
            <NavGroup key={item.label} item={item} collapsed={collapsed} />
          ))}
          {!collapsed && user?.role === "Admin" && <span className="sidebar-group-label">System</span>}
          {navConfig.slice(-1).map((item) => (
            <NavGroup key={item.label} item={item} collapsed={collapsed} />
          ))}
        </nav>

      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top header */}
        <header
          className="app-header flex items-center gap-3 px-5 py-3 border-b"
          style={{
            background: "var(--surface)",
            borderColor: "var(--surface-border)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          }}
        >
          <button
            type="button"
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <nav className="breadcrumb min-w-0 flex-1" aria-label="Breadcrumb">
            {crumbs.map((crumb, index) => {
              const last = index === crumbs.length - 1
              return (
                <span key={`${crumb.label}-${index}`} className="inline-flex min-w-0 items-center gap-1.5">
                  {index > 0 && (
                    <ChevronRight size={13} aria-hidden className={index === 1 ? "hidden sm:block" : ""} />
                  )}
                  {last ? (
                    <span className="crumb-current" aria-current="page">{crumb.label}</span>
                  ) : crumb.to ? (
                    <Link to={crumb.to}>{crumb.label}</Link>
                  ) : (
                    <span className={index === 0 && crumbs.length > 1 ? "hidden sm:inline" : ""}>{crumb.label}</span>
                  )}
                </span>
              )
            })}
          </nav>

          <div
            ref={headerActionsRef}
            className="relative flex shrink-0 items-center gap-1 sm:gap-2"
          >
            <button
              type="button"
              className="command-trigger"
              onClick={() => setSearchOpen(true)}
              aria-label="Search pages"
            >
              <Search size={15} aria-hidden />
              <span>Search pages…</span>
              <kbd>Ctrl K</kbd>
            </button>
            <button
              type="button"
              className="header-icon-button lg:!hidden"
              onClick={() => setSearchOpen(true)}
              aria-label="Search pages"
              title="Search pages"
            >
              <Search size={18} />
            </button>
            <button
              type="button"
              onClick={toggleNotifications}
              aria-label={`Notifications${
                unreadCount ? `, ${unreadCount} unread` : ""
              }`}
              aria-expanded={notificationsOpen}
              className="header-icon-button relative"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="notification-count">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              aria-label={`Switch to ${
                theme === "light" ? "dark" : "light"
              } mode`}
              title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              className="header-icon-button"
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              type="button"
              onClick={() => {
                setProfileOpen((open) => !open)
                setNotificationsOpen(false)
              }}
              aria-label="Open user profile"
              aria-expanded={profileOpen}
              className="profile-trigger"
            >
              <span className="profile-trigger-avatar" aria-hidden="true">
                {(user?.fullName ?? "U")
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </span>
              <span className="profile-trigger-text">
                <strong>{user?.fullName || "User"}</strong>
                <small>{user?.role}</small>
              </span>
            </button>

            {profileOpen && (
              <section
                className="header-popover profile-popover"
                aria-label="User profile"
              >
                <div className="profile-popover-cover" />
                <div className="profile-popover-content">
                  <div className="profile-avatar" aria-hidden="true">
                    {(user?.fullName ?? "U")
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  <h2 className="profile-name">{user?.fullName || "User"}</h2>
                  <p className="profile-email">{user?.email}</p>
                  <div className="profile-role">{user?.role}</div>
                  <div className="profile-divider" />
                  <button
                    type="button"
                    onClick={() => void onLogout()}
                    className="profile-signout"
                  >
                    <LogOut size={16} />
                    Sign out
                  </button>
                </div>
              </section>
            )}

            {notificationsOpen && (
              <section
                className="header-popover notifications-popover"
                aria-label="Notifications and reminders"
              >
                <div className="popover-heading">
                  <div>
                    <h2>Notifications</h2>
                    <p>Important updates and reminders</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadReminders()}
                    aria-label="Refresh notifications"
                    className="popover-icon-button"
                    disabled={remindersLoading}
                  >
                    <RefreshCw
                      size={16}
                      className={remindersLoading ? "animate-spin" : ""}
                    />
                  </button>
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="mark-read-button"
                  >
                    <Check size={14} /> Mark all as read
                  </button>
                )}
                <div className="notification-list">
                  {remindersLoading && !reminderData ? (
                    <p className="notification-state" role="status">
                      Loading reminders…
                    </p>
                  ) : remindersError ? (
                    <div className="notification-error" role="alert">
                      <AlertCircle size={18} />
                      <span>{remindersError}</span>
                      <button
                        type="button"
                        onClick={() => void loadReminders()}
                      >
                        Try again
                      </button>
                    </div>
                  ) : reminders.length ? (
                    reminders.map((reminder) => (
                      <button
                        type="button"
                        key={reminder.id}
                        className={`notification-item ${
                          readReminders.includes(reminder.id) ? "" : "unread"
                        }`}
                        onClick={() => {
                          setReadReminders((current) =>
                            current.includes(reminder.id)
                              ? current
                              : [...current, reminder.id],
                          )
                          setNotificationsOpen(false)
                          if (user?.role !== "Volunteer" && user?.role !== "Board") {
                            navigate(
                              reminder.type === "event"
                                ? "/events"
                                : "/projects/planning",
                            )
                          }
                        }}
                      >
                        <span
                          className={`notification-symbol ${
                            reminder.important ? "important" : ""
                          }`}
                        >
                          {reminder.type === "event" ? (
                            <CalendarDays size={17} />
                          ) : (
                            <CalendarClock size={17} />
                          )}
                        </span>
                        <span className="notification-copy">
                          <span className="notification-title">
                            {reminder.title}
                          </span>
                          <span className="notification-detail">
                            {reminder.detail}
                          </span>
                          <span className="notification-category">
                            {reminder.important
                              ? "Important task"
                              : reminder.type === "event"
                                ? "Upcoming event"
                                : "Task reminder"}
                          </span>
                        </span>
                        {!readReminders.includes(reminder.id) && (
                          <span className="notification-unread-dot" />
                        )}
                      </button>
                    ))
                  ) : (
                    <p className="notification-state">
                      {reminderData
                        ? "You’re all caught up. No upcoming events or pending tasks."
                        : "No reminders to show."}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="notification-footer"
                  onClick={() => {
                    setNotificationsOpen(false)
                    navigate("/")
                  }}
                >
                  {user?.role === "Volunteer" || user?.role === "Board" ? "Open my workspace" : "Open dashboard"}
                </button>
              </section>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="app-content min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {notice && (
            <div
              role="status"
              className="fixed right-5 top-20 z-[110] flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl"
            >
              <span className="h-2 w-2 rounded-full bg-teal-400" />
              {notice}
            </div>
          )}
          <ModuleFlow />
          <Outlet />
        </main>
        <ChartGradients />
        <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} role={user?.role} />
      </div>
    </div>
  )
}
