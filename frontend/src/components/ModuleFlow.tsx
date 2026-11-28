import { Link, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { canAccess } from "../lib/access"
import { matchChild, resolveLocation } from "../lib/navConfig"

/**
 * Sits above page content for every module that has sibling pages so the whole app reads as a flow:
 *  - Projects: numbered lifecycle (Proposals → Planning → Activate → All Projects → Reports)
 *  - Other modules: pill tabs to jump between sibling pages
 */
export default function ModuleFlow() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const resolved = resolveLocation(pathname)
  const group = resolved?.group
  if (!group?.children) return null
  const children = group.children.filter((c) => canAccess(user?.role, c.path))
  if (children.length < 2) return null
  const current = matchChild({ ...group, children }, pathname)
  const isProjects = group.label === "Projects"
  const currentIndex = children.findIndex((c) => c.path === current?.path)

  if (isProjects) {
    return (
      <nav className="module-flow" aria-label="Project lifecycle">
        <div className="flow-steps">
          {children.map((c, i) => {
            const active = i === currentIndex
            return (
              <Link
                key={c.path}
                to={c.path}
                aria-current={active ? "page" : undefined}
                className={`flow-step ${active ? "active" : ""}`}
              >
                <span className="flow-step-dot">{i + 1}</span>
                <span>
                  <strong>{c.label}</strong>
                  <small>{c.hint}</small>
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    )
  }

  return (
    <nav className="module-flow" aria-label={`${group.label} pages`}>
      <div className="module-nav">
        {children.map((c) => (
          <Link
            key={c.path}
            to={c.path}
            aria-current={c.path === current?.path ? "page" : undefined}
            className={c.path === current?.path ? "active" : ""}
          >
            {c.icon}
            {c.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
