import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CornerDownLeft, Search } from "lucide-react"
import { navConfig } from "../lib/navConfig"
import { canAccess, type AppRole } from "../lib/access"

interface Entry {
  label: string
  group: string
  path: string
  icon: React.ReactNode
}

/** Global "jump to" search: Ctrl/⌘+K or "/" opens it; searches every page the person can access. */
export default function CommandSearch({
  open,
  onClose,
  role,
}: {
  open: boolean
  onClose: () => void
  role: AppRole | undefined
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = []
    if (role === "Volunteer" || role === "Board")
      list.push({ label: "My Workspace", group: "Home", path: "/home", icon: navConfig[0].icon })
    for (const item of navConfig) {
      if (item.path && canAccess(role, item.path))
        list.push({ label: item.label, group: "Main", path: item.path, icon: item.icon })
      for (const c of item.children ?? [])
        if (canAccess(role, c.path))
          list.push({ label: c.label, group: item.label, path: c.path, icon: c.icon ?? item.icon })
    }
    return list
  }, [role])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => `${e.label} ${e.group}`.toLowerCase().includes(q))
  }, [entries, query])

  useEffect(() => {
    if (open) {
      setQuery("")
      setActive(0)
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])
  useEffect(() => setActive(0), [query])

  if (!open) return null

  const go = (entry?: Entry) => {
    if (!entry) return
    onClose()
    navigate(entry.path)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === "Enter") {
      event.preventDefault()
      go(results[active])
    } else if (event.key === "Escape") {
      onClose()
    }
  }

  let lastGroup = ""
  return (
    <div
      className="command-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="command-panel" role="dialog" aria-modal="true" aria-label="Search pages" onKeyDown={onKeyDown}>
        <div className="command-input-row">
          <Search size={18} aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Jump to a page or module…"
            aria-label="Search pages"
          />
          <kbd className="rounded-md border px-1.5 text-[10px] font-semibold">Esc</kbd>
        </div>
        <div className="command-list" role="listbox">
          {results.length === 0 ? (
            <p className="command-empty">No pages match “{query}”.</p>
          ) : (
            results.map((entry, index) => {
              const header = entry.group !== lastGroup ? entry.group : null
              lastGroup = entry.group
              return (
                <div key={`${entry.path}-${index}`}>
                  {header && <div className="command-group">{header}</div>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    className="command-item"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(entry)}
                  >
                    <span className="command-item-icon">{entry.icon}</span>
                    <span className="flex-1">
                      {entry.label}
                      <small>{entry.path}</small>
                    </span>
                    {index === active && <CornerDownLeft size={14} aria-hidden />}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
