
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { apiRequest } from "../../services/apiClient"

type Tab = "messages" | "announcements" | "external" | "followups" | "community"
type Composer = "message" | "announcement" | "external" | "followup" | null

type User = {
  id: string
  fullName: string
  email: string
  role: string
}

type Message = {
  id: string
  parentId: string | null
  subject: string
  body: string
  createdAt: string
  read: boolean
  senderId: string
  senderName: string
  senderEmail: string
  recipientId: string
  recipientName: string
  recipientEmail: string
}

type Announcement = {
  id: string
  title: string
  body: string
  audience: string
  priority: string
  publishedAt: string
}

type RelatedType = "Donor" | "Beneficiary" | "Project"

type RelatedRecord = {
  id: string
  displayName?: string
  fullName?: string
  name?: string
  email?: string | null
  phone?: string | null
  projectCode?: string
}

type ExternalMessage = {
  id: string
  subject: string
  channel: string
  body: string
  status: string
  createdAt: string
  recipientName?: string | null
  recipientEmail?: string | null
  recipientPhone?: string | null
  relatedType: RelatedType
  relatedId: string
  relatedName: string
  createdByName: string
}

type Followup = {
  id: string
  title: string
  description: string
  dueDate: string
  status: string
  isOverdue: boolean
  relatedType: RelatedType
  relatedId: string
  relatedName: string
  assignedToName: string
  createdByName: string
}

type CommunityPost = {
  id: string
  name: string
  place: string
  text: string
  createdAt: string
  likesCount: number
  likedByMe: boolean
  comments: { id: string; authorName: string; body: string }[]
}

type CommunityPerson = {
  id: string
  name: string
  place: string
  skills: string[]
  connectionStatus: string
  connectionId?: string
}

type CommunityNotice = {
  id: string
  title: string
  body: string
  actorName: string
  createdAt: string
  isRead: boolean
}

type CommunityReport = {
  id: string
  reason: string
  reporterName: string
  post: CommunityPost
}

const tabs: { id: Tab; label: string }[] = [
  { id: "messages", label: "Internal Messages" },
  { id: "announcements", label: "Announcements" },
  { id: "external", label: "External Messages" },
  { id: "followups", label: "Follow-ups" },
  { id: "community", label: "Volunteer Community" },
]

const inputClass = "form-input w-full"
const primary = "btn-primary"
const secondary = "btn-secondary"
const formatDate = (value: string) => new Date(value).toLocaleString()
const staffRoles = ["Admin", "Project Manager", "Staff"]

function recordLabel(record: RelatedRecord, type: RelatedType) {
  if (type === "Donor") return record.displayName || record.name || record.id
  if (type === "Beneficiary") return record.fullName || record.name || record.id
  return record.name || record.projectCode || record.id
}

export default function CommunicationPage() {
  const [tab, setTab] = useState<Tab>("messages")
  const [composer, setComposer] = useState<Composer>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [users, setUsers] = useState<User[]>([])
  const [lookupsLoaded, setLookupsLoaded] = useState(false)

  const [messages, setMessages] = useState<Message[]>([])
  const [folder, setFolder] = useState<"inbox" | "sent">("inbox")
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [threadMessages, setThreadMessages] = useState<Message[]>([])

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [externalMessages, setExternalMessages] = useState<ExternalMessage[]>([])
  const [followups, setFollowups] = useState<Followup[]>([])

  const [donors, setDonors] = useState<RelatedRecord[]>([])
  const [beneficiaries, setBeneficiaries] = useState<RelatedRecord[]>([])
  const [projects, setProjects] = useState<RelatedRecord[]>([])

  const [search, setSearch] = useState("")
  const [externalRelatedType, setExternalRelatedType] = useState<RelatedType>("Donor")
  const [followupRelatedType, setFollowupRelatedType] = useState<RelatedType>("Project")

  // Volunteer Community state
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [people, setPeople] = useState<CommunityPerson[]>([])
  const [notices, setNotices] = useState<CommunityNotice[]>([])
  const [reports, setReports] = useState<CommunityReport[]>([])
  const [postText, setPostText] = useState("")
  const [commentText, setCommentText] = useState<Record<string, string>>({})

  const loadLookups = useCallback(async () => {
    const [userData, donorData, beneficiaryData, projectData] = await Promise.all([
      apiRequest<{ items: User[] }>("/communications/users"),
      apiRequest<{ items: RelatedRecord[] }>("/donors?limit=200&sort=display_name&order=asc"),
      apiRequest<{ items: RelatedRecord[] }>("/beneficiaries?limit=200&sort=full_name&order=asc"),
      apiRequest<{ items: RelatedRecord[] }>("/projects?limit=200&sort=name&order=asc"),
    ])

    setUsers(userData.items)
    setDonors(donorData.items)
    setBeneficiaries(beneficiaryData.items)
    setProjects(projectData.items)
    setLookupsLoaded(true)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      if (tab === "messages") {
        const [messageData, userData] = await Promise.all([
          apiRequest<{ items: Message[] }>(
            `/communications/messages?folder=${folder}`
          ),
          apiRequest<{ items: User[] }>("/communications/users"),
        ])

        setMessages(messageData.items)
        setUsers(userData.items)

      } else if (tab === "announcements") {
        const data = await apiRequest<{ items: Announcement[] }>(
          "/communications/announcements"
        )
        setAnnouncements(data.items)

      } else if (tab === "external") {
        const [messageData] = await Promise.all([
          apiRequest<{ items: ExternalMessage[] }>("/communications/external"),
          loadLookups(),
        ])
        setExternalMessages(messageData.items)

      } else if (tab === "followups") {
        const [followupData] = await Promise.all([
          apiRequest<{ items: Followup[] }>("/communications/followups"),
          loadLookups(),
        ])
        setFollowups(followupData.items)

      } else {
        const [postResult, peopleResult, noticeResult, reportResult] =
          await Promise.allSettled([
            apiRequest<{ items: CommunityPost[] }>("/community/posts"),
            apiRequest<{ items: CommunityPerson[] }>("/community/people"),
            apiRequest<{ items: CommunityNotice[] }>("/community/notifications"),
            apiRequest<{ items: CommunityReport[] }>("/community/admin/reports"),
          ])

        setPosts(postResult.status === "fulfilled" ? postResult.value.items : [])
        setPeople(peopleResult.status === "fulfilled" ? peopleResult.value.items : [])
        setNotices(noticeResult.status === "fulfilled" ? noticeResult.value.items : [])
        setReports(reportResult.status === "fulfilled" ? reportResult.value.items : [])

        if (
          [postResult, peopleResult, noticeResult, reportResult]
            .every(result => result.status === "rejected")
        ) {
          throw new Error(
            "Your account does not have access to volunteer community features."
          )
        }
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to load communication data."
      )
    } finally {
      setLoading(false)
    }
  }, [tab, folder, loadLookups])

  useEffect(() => {
    void load()
  }, [load])

  const unreadCount = useMemo(
    () => folder === "inbox"
      ? messages.filter(message => !message.read).length
      : 0,
    [messages, folder]
  )

  const relatedOptions = useMemo(() => {
    if (externalRelatedType === "Donor") return donors
    if (externalRelatedType === "Beneficiary") return beneficiaries
    return projects
  }, [externalRelatedType, donors, beneficiaries, projects])

  const followupOptions = useMemo(() => {
    if (followupRelatedType === "Donor") return donors
    if (followupRelatedType === "Beneficiary") return beneficiaries
    return projects
  }, [followupRelatedType, donors, beneficiaries, projects])

  const filteredExternal = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return externalMessages

    return externalMessages.filter(item =>
      [
        item.subject,
        item.body,
        item.channel,
        item.status,
        item.relatedName,
        item.recipientName,
        item.recipientEmail,
      ].some(value => value?.toLowerCase().includes(term))
    )
  }, [externalMessages, search])

  const filteredFollowups = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return followups

    return followups.filter(item =>
      [
        item.title,
        item.description,
        item.relatedName,
        item.assignedToName,
        item.status,
      ].some(value => value?.toLowerCase().includes(term))
    )
  }, [followups, search])

  const openComposer = async (next: Exclude<Composer, null>) => {
    setError("")
    setSuccess("")
    setComposer(next)

    if (
      (next === "external" || next === "followup")
      && !lookupsLoaded
    ) {
      try {
        await loadLookups()
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Unable to load related records."
        )
      }
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setSuccess("")
    setSaving(true)

    const form = new FormData(event.currentTarget)

    try {
      if (composer === "message") {
        await apiRequest("/communications/messages", {
          method: "POST",
          body: JSON.stringify({
            recipientEmail: form.get("recipientEmail"),
            subject: form.get("subject"),
            body: form.get("body"),
          }),
        })

        setSuccess("Message sent in the recipient's inbox.")

      } else if (composer === "announcement") {
        await apiRequest("/communications/announcements", {
          method: "POST",
          body: JSON.stringify({
            title: form.get("title"),
            body: form.get("body"),
            audience: form.get("audience"),
            priority: form.get("priority"),
          }),
        })

        setSuccess("Announcement published and stored.")

      } else if (composer === "external") {
        await apiRequest("/communications/external", {
          method: "POST",
          body: JSON.stringify({
            relatedType: form.get("relatedType"),
            relatedId: form.get("relatedId"),
            recipientName: form.get("recipientName") || null,
            recipientEmail: form.get("recipientEmail") || null,
            recipientPhone: form.get("recipientPhone") || null,
            subject: form.get("subject"),
            body: form.get("body"),
            channel: form.get("channel"),
            status: form.get("status"),
          }),
        })

        setSuccess(
          "External message saved in the communication history. It was not sent."
        )

      } else if (composer === "followup") {
        await apiRequest("/communications/followups", {
          method: "POST",
          body: JSON.stringify({
            title: form.get("title"),
            description: form.get("description"),
            relatedType: form.get("relatedType"),
            relatedId: form.get("relatedId"),
            assignedTo: form.get("assignedTo") || null,
            dueDate: form.get("dueDate"),
          }),
        })

        setSuccess("Follow-up task created and assigned.")
      }

      setComposer(null)
      await load()

    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to save this communication item."
      )
    } finally {
      setSaving(false)
    }
  }

  const selectMessage = async (message: Message) => {
    setSelectedMessage(message)
    setError("")

    try {
      const data = await apiRequest<{ items: Message[] }>(
        `/communications/messages/${message.id}/thread`
      )

      setThreadMessages(data.items)

      if (folder === "inbox") {
        const threadIds = new Set(data.items.map(item => item.id))

        setMessages(items =>
          items.map(item =>
            threadIds.has(item.id)
              ? { ...item, read: true }
              : item
          )
        )
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to open this message thread."
      )
      setThreadMessages([message])
    }
  }

  const reply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedMessage) return

    const formElement = event.currentTarget
    const form = new FormData(formElement)

    const recipientEmail = folder === "inbox"
      ? selectedMessage.senderEmail
      : selectedMessage.recipientEmail

    setError("")
    setSaving(true)

    try {
      await apiRequest("/communications/messages", {
        method: "POST",
        body: JSON.stringify({
          recipientEmail,
          subject: `Re: ${selectedMessage.subject}`,
          body: form.get("body"),
          parentId: selectedMessage.id,
        }),
      })

      setSuccess("Reply saved in the other participant's inbox.")
      formElement.reset()

      const threadData = await apiRequest<{ items: Message[] }>(
        `/communications/messages/${selectedMessage.id}/thread`
      )

      setThreadMessages(threadData.items)
      await load()

    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to save reply."
      )
    } finally {
      setSaving(false)
    }
  }

  const updateFollowup = async (
    item: Followup,
    nextStatus: "Pending" | "Completed" | "Cancelled"
  ) => {
    setError("")
    setSuccess("")

    try {
      await apiRequest(`/communications/followups/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      })

      setSuccess(`Follow-up marked ${nextStatus.toLowerCase()}.`)
      await load()

    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to update follow-up."
      )
    }
  }

  // Volunteer Community actions
  const createPost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")

    try {
      await apiRequest("/community/posts", {
        method: "POST",
        body: JSON.stringify({ text: postText }),
      })

      setPostText("")
      setSuccess("Community post published.")
      await load()

    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to publish post.")
    }
  }

  const toggleLike = async (post: CommunityPost) => {
    try {
      await apiRequest(`/community/posts/${post.id}/likes`, {
        method: post.likedByMe ? "DELETE" : "POST",
      })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update like.")
    }
  }

  const addComment = async (
    event: FormEvent<HTMLFormElement>,
    postId: string
  ) => {
    event.preventDefault()

    const body = commentText[postId]?.trim()
    if (!body) return

    try {
      await apiRequest(`/community/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ text: body }),
      })

      setCommentText(value => ({ ...value, [postId]: "" }))
      await load()

    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to add comment.")
    }
  }

  const connect = async (person: CommunityPerson) => {
    try {
      if (
        person.connectionStatus === "pending_received"
        && person.connectionId
      ) {
        await apiRequest(
          `/community/connections/${person.connectionId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ action: "accept" }),
          }
        )
      } else {
        await apiRequest("/community/connections", {
          method: "POST",
          body: JSON.stringify({ profileId: person.id }),
        })
      }

      await load()

    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update connection.")
    }
  }

  const markNotificationsRead = async () => {
    const ids = notices
      .filter(item => !item.isRead)
      .map(item => item.id)

    if (!ids.length) return

    try {
      await apiRequest("/community/notifications/read", {
        method: "PATCH",
        body: JSON.stringify({ ids, isRead: true }),
      })

      await load()

    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update notifications.")
    }
  }

  const moderate = async (
    reportId: string,
    action: "remove" | "dismiss"
  ) => {
    try {
      await apiRequest(
        `/community/admin/reports/${reportId}/decision`,
        {
          method: "POST",
          body: JSON.stringify({
            action,
            note: "Reviewed by administrator",
          }),
        }
      )

      await load()

    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to moderate report.")
    }
  }

  const changeTab = (next: Tab) => {
    setTab(next)
    setComposer(null)
    setError("")
    setSuccess("")
    setSearch("")

    if (next !== "messages") {
      setSelectedMessage(null)
      setThreadMessages([])
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Communication</h1>
          <p className="page-subtitle">
            Manage internal messages, announcements, external drafts,
            follow-ups and volunteer community.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {tab === "messages" && (
            <button className={primary} onClick={() => void openComposer("message")}>
              + New Message
            </button>
          )}

          {tab === "announcements" && (
            <button className={primary} onClick={() => void openComposer("announcement")}>
              + New Announcement
            </button>
          )}

          {tab === "external" && (
            <button className={primary} onClick={() => void openComposer("external")}>
              + Prepare External Message
            </button>
          )}

          {tab === "followups" && (
            <button className={primary} onClick={() => void openComposer("followup")}>
              + Add Follow-up
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {tabs.map(item => (
          <button
            key={item.id}
            className={tab === item.id ? primary : secondary}
            onClick={() => changeTab(item.id)}
          >
            {item.label}
            {item.id === "messages" && unreadCount > 0
              ? ` (${unreadCount} unread)`
              : ""}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* COMPOSER */}
      {composer && (
        <form
          onSubmit={submit}
          className="card card-body grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          <div className="md:col-span-2 flex items-center justify-between gap-3">
            <h2 className="card-title">
              {composer === "message"
                ? "Compose internal message"
                : composer === "announcement"
                  ? "Publish announcement"
                  : composer === "external"
                    ? "Prepare external message"
                    : "Create follow-up task"}
            </h2>

            <button
              type="button"
              className={secondary}
              onClick={() => setComposer(null)}
            >
              Close
            </button>
          </div>

          {composer === "message" && (
            <>
              <label className="text-sm md:col-span-2">
                Send to registered user
                <select
                  className={inputClass}
                  name="recipientEmail"
                  required
                  defaultValue=""
                >
                  <option value="">Select recipient</option>
                  {users.map(person => (
                    <option key={person.id} value={person.email}>
                      {person.fullName} — {person.role} ({person.email})
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm md:col-span-2">
                Subject
                <input
                  className={inputClass}
                  name="subject"
                  maxLength={160}
                  required
                />
              </label>
            </>
          )}

          {composer === "announcement" && (
            <>
              <label className="text-sm md:col-span-2">
                Title
                <input
                  className={inputClass}
                  name="title"
                  maxLength={160}
                  required
                />
              </label>

              <label className="text-sm">
                Audience
                <select className={inputClass} name="audience">
                  <option>All</option>
                  <option>Staff</option>
                  <option>Volunteers</option>
                </select>
              </label>

              <label className="text-sm">
                Priority
                <select className={inputClass} name="priority">
                  <option>Normal</option>
                  <option>High</option>
                </select>
              </label>
            </>
          )}

          {composer === "external" && (
            <>
              <label className="text-sm">
                Related record type
                <select
                  className={inputClass}
                  name="relatedType"
                  value={externalRelatedType}
                  onChange={event =>
                    setExternalRelatedType(event.target.value as RelatedType)
                  }
                >
                  <option value="Donor">Donor</option>
                  <option value="Beneficiary">Beneficiary</option>
                  <option value="Project">Project</option>
                </select>
              </label>

              <label className="text-sm">
                Link to record
                <select
                  className={inputClass}
                  name="relatedId"
                  required
                  defaultValue=""
                >
                  <option value="">
                    Select {externalRelatedType.toLowerCase()}
                  </option>
                  {relatedOptions.map(record => (
                    <option key={record.id} value={record.id}>
                      {recordLabel(record, externalRelatedType)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                Recipient name
                <input
                  className={inputClass}
                  name="recipientName"
                  maxLength={160}
                />
              </label>

              <label className="text-sm">
                Recipient email
                <input
                  className={inputClass}
                  name="recipientEmail"
                  type="email"
                />
              </label>

              <label className="text-sm">
                Recipient phone
                <input
                  className={inputClass}
                  name="recipientPhone"
                  maxLength={40}
                />
              </label>

              <label className="text-sm">
                Channel
                <select className={inputClass} name="channel">
                  <option>Email</option>
                  <option>WhatsApp</option>
                  <option>SMS</option>
                  <option>Phone</option>
                  <option>In Person</option>
                  <option>Other</option>
                </select>
              </label>

              <label className="text-sm md:col-span-2">
                Subject
                <input
                  className={inputClass}
                  name="subject"
                  maxLength={250}
                  required
                />
              </label>

              <label className="text-sm">
                Record status
                <select className={inputClass} name="status">
                  <option value="Draft">Draft — prepared, not sent</option>
                  <option value="Logged">
                    Logged — communication already happened
                  </option>
                </select>
              </label>

              <p className="self-end text-xs text-amber-700">
                Saving a draft does not send an email, SMS or WhatsApp message.
              </p>
            </>
          )}

          {composer === "followup" && (
            <>
              <label className="text-sm">
                Task title
                <input
                  className={inputClass}
                  name="title"
                  maxLength={160}
                  required
                />
              </label>

              <label className="text-sm">
                Due date
                <input
                  className={inputClass}
                  name="dueDate"
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  required
                />
              </label>

              <label className="text-sm">
                Related record type
                <select
                  className={inputClass}
                  name="relatedType"
                  value={followupRelatedType}
                  onChange={event =>
                    setFollowupRelatedType(event.target.value as RelatedType)
                  }
                >
                  <option value="Donor">Donor</option>
                  <option value="Beneficiary">Beneficiary</option>
                  <option value="Project">Project</option>
                </select>
              </label>

              <label className="text-sm">
                Related record
                <select
                  className={inputClass}
                  name="relatedId"
                  required
                  defaultValue=""
                >
                  <option value="">
                    Select {followupRelatedType.toLowerCase()}
                  </option>
                  {followupOptions.map(record => (
                    <option key={record.id} value={record.id}>
                      {recordLabel(record, followupRelatedType)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                Assign to
                <select
                  className={inputClass}
                  name="assignedTo"
                  defaultValue=""
                >
                  <option value="">Assign to me</option>
                  {users
                    .filter(person => staffRoles.includes(person.role))
                    .map(person => (
                      <option key={person.id} value={person.id}>
                        {person.fullName} — {person.role}
                      </option>
                    ))}
                </select>
              </label>

              <label className="text-sm md:col-span-2">
                Description
                <textarea
                  className={`${inputClass} min-h-20`}
                  name="description"
                  maxLength={2000}
                />
              </label>
            </>
          )}

          {(composer === "message"
            || composer === "announcement"
            || composer === "external") && (
            <label className="text-sm md:col-span-2">
              {composer === "announcement" ? "Announcement" : "Message body"}
              <textarea
                className={`${inputClass} min-h-28`}
                name="body"
                maxLength={5000}
                required
              />
            </label>
          )}

          <div className="md:col-span-2 flex gap-2">
            <button className={primary} type="submit" disabled={saving}>
              {saving
                ? "Saving…"
                : composer === "announcement"
                  ? "Publish"
                  : composer === "message"
                    ? "Send Message"
                    : composer === "external"
                      ? "Save External Message"
                      : "Create Follow-up"}
            </button>

            <button
              className={secondary}
              type="button"
              onClick={() => setComposer(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && (
        <p className="text-sm text-slate-500">
          Loading communication records…
        </p>
      )}

      {/* INTERNAL MESSAGES */}
      {tab === "messages" && !loading && (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="card overflow-hidden lg:col-span-1">
            <div className="card-header flex items-center justify-between">
              <h2 className="card-title">Mailbox</h2>
              <span className="text-xs text-slate-500">
                {folder === "inbox" ? `${unreadCount} unread` : "Sent items"}
              </span>
            </div>

            <div className="flex gap-2 p-3">
              <button
                className={folder === "inbox" ? primary : secondary}
                onClick={() => {
                  setFolder("inbox")
                  setSelectedMessage(null)
                  setThreadMessages([])
                }}
              >
                Inbox
              </button>

              <button
                className={folder === "sent" ? primary : secondary}
                onClick={() => {
                  setFolder("sent")
                  setSelectedMessage(null)
                  setThreadMessages([])
                }}
              >
                Sent
              </button>
            </div>

            {messages.map(message => (
              <button
                key={message.id}
                onClick={() => void selectMessage(message)}
                className={`block w-full border-t p-3 text-left hover:bg-slate-50 ${
                  selectedMessage?.id === message.id ? "bg-teal-50" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {folder === "inbox"
                      ? message.senderName
                      : message.recipientName}
                  </span>

                  {folder === "inbox" && !message.read && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                      Unread
                    </span>
                  )}
                </div>

                <div className="text-sm">{message.subject}</div>
                <div className="truncate text-xs text-slate-500">
                  {message.body}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {formatDate(message.createdAt)}
                </div>
              </button>
            ))}

            {!messages.length && (
              <p className="p-4 text-sm text-slate-500">
                No messages in this folder.
              </p>
            )}
          </section>

          <section className="card card-body lg:col-span-2">
            {selectedMessage ? (
              <>
                <h2 className="card-title">{selectedMessage.subject}</h2>

                <p className="text-xs text-slate-500">
                  From {selectedMessage.senderName} ({selectedMessage.senderEmail})
                  {" · "}
                  To {selectedMessage.recipientName} ({selectedMessage.recipientEmail})
                  {" · "}
                  {formatDate(selectedMessage.createdAt)}
                </p>

                <div className="my-4 space-y-3">
                  {threadMessages.map(item => (
                    <article
                      key={item.id}
                      className={`rounded-lg p-3 ${
                        item.senderId === selectedMessage.senderId
                          && item.id === selectedMessage.id
                          ? "bg-teal-50"
                          : "bg-slate-50"
                      }`}
                    >
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold">
                          {item.senderName} → {item.recipientName}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatDate(item.createdAt)}
                        </span>
                      </div>

                      <p className="whitespace-pre-wrap text-sm">
                        {item.body}
                      </p>
                    </article>
                  ))}
                </div>

                <div className="border-t pt-4">
                  <form onSubmit={reply} className="space-y-2">
                    <label className="text-sm">
                      Reply
                      <textarea
                        className={`${inputClass} min-h-24`}
                        name="body"
                        maxLength={5000}
                        required
                      />
                    </label>

                    <button
                      className={primary}
                      type="submit"
                      disabled={saving}
                    >
                      {saving ? "Saving…" : "Send Reply"}
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <p className="m-auto text-sm text-slate-500">
                Select a message to read it or reply.
              </p>
            )}
          </section>
        </div>
      )}

      {/* ANNOUNCEMENTS */}
      {tab === "announcements" && !loading && (
        <div className="grid gap-3">
          {announcements.map(item => (
            <article key={item.id} className="card card-body">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold">{item.title}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                    {item.body}
                  </p>
                </div>

                <span className={`rounded-full px-3 py-1 text-xs ${
                  item.priority === "High"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-600"
                }`}>
                  {item.priority}
                </span>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Audience: {item.audience} · Published {formatDate(item.publishedAt)}
              </p>
            </article>
          ))}

          {!announcements.length && (
            <div className="card p-6 text-center text-sm text-slate-500">
              No announcements have been published yet.
            </div>
          )}
        </div>
      )}

      {/* EXTERNAL MESSAGES */}
      {tab === "external" && !loading && (
        <section className="card overflow-hidden">
          <div className="card-header flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="card-title">External Communication History</h2>
              <p className="text-xs text-slate-500">
                Prepared drafts and logged interactions linked to donors,
                beneficiaries or projects.
              </p>
            </div>

            <input
              className={`${inputClass} max-w-xs`}
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search messages…"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="data-table w-full min-w-[900px]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Subject / Message</th>
                  <th>Recipient</th>
                  <th>Related to</th>
                  <th>Channel</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredExternal.map(item => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap">
                      {formatDate(item.createdAt)}
                    </td>

                    <td>
                      <div className="font-semibold">{item.subject}</div>
                      <div className="max-w-sm truncate text-xs text-slate-500">
                        {item.body}
                      </div>
                    </td>

                    <td>
                      {item.recipientName || "—"}
                      <div className="text-xs text-slate-500">
                        {item.recipientEmail || item.recipientPhone || ""}
                      </div>
                    </td>

                    <td>{item.relatedType}: {item.relatedName}</td>
                    <td>{item.channel}</td>

                    <td>
                      <span className={`rounded-full px-2 py-1 text-xs ${
                        item.status === "Draft"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-700"
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!filteredExternal.length && (
            <p className="p-6 text-center text-sm text-slate-500">
              No external messages found. Prepare a draft or log a completed interaction.
            </p>
          )}

          <p className="border-t p-3 text-xs text-amber-700">
            External messages are stored only. Actual email, SMS and WhatsApp
            delivery is not enabled.
          </p>
        </section>
      )}

      {/* FOLLOW-UPS */}
      {tab === "followups" && !loading && (
        <section className="card overflow-hidden">
          <div className="card-header flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="card-title">Follow-up Tracker</h2>
              <p className="text-xs text-slate-500">
                Track actions, ownership and due dates for donors,
                beneficiaries and projects.
              </p>
            </div>

            <input
              className={`${inputClass} max-w-xs`}
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search follow-ups…"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="data-table w-full min-w-[850px]">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Related to</th>
                  <th>Assigned to</th>
                  <th>Due date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredFollowups.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div className="font-semibold">{item.title}</div>
                      <div className="max-w-sm text-xs text-slate-500">
                        {item.description}
                      </div>
                    </td>

                    <td>{item.relatedType}: {item.relatedName}</td>
                    <td>{item.assignedToName}</td>

                    <td className={item.isOverdue ? "font-semibold text-red-600" : ""}>
                      {new Date(`${item.dueDate}T00:00:00`).toLocaleDateString()}
                      {item.isOverdue ? " · Overdue" : ""}
                    </td>

                    <td>{item.status}</td>

                    <td className="whitespace-nowrap">
                      {item.status === "Pending" ? (
                        <>
                          <button
                            className="text-sm text-emerald-700 hover:underline"
                            onClick={() => void updateFollowup(item, "Completed")}
                          >
                            Mark complete
                          </button>

                          <button
                            className="ml-3 text-sm text-slate-500 hover:underline"
                            onClick={() => void updateFollowup(item, "Cancelled")}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="text-sm text-blue-700 hover:underline"
                          onClick={() => void updateFollowup(item, "Pending")}
                        >
                          Reopen
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!filteredFollowups.length && (
            <p className="p-6 text-center text-sm text-slate-500">
              No follow-up tasks found.
            </p>
          )}
        </section>
      )}

      {/* VOLUNTEER COMMUNITY — existing functionality retained */}
      {tab === "community" && !loading && (
        <div className="grid gap-4 xl:grid-cols-3">
          <section className="space-y-3 xl:col-span-2">
            <form onSubmit={createPost} className="card card-body">
              <h2 className="card-title">Share with the volunteer community</h2>

              <textarea
                className={`${inputClass} mt-2 min-h-24`}
                value={postText}
                onChange={event => setPostText(event.target.value)}
                maxLength={3000}
                placeholder="Share an update with volunteers…"
                required
              />

              <button className={`${primary} mt-2 self-start`}>
                Publish Post
              </button>
            </form>

            {posts.map(post => (
              <article key={post.id} className="card card-body">
                <h3 className="font-semibold">{post.name}</h3>
                <p className="text-xs text-slate-500">
                  {post.place} · {formatDate(post.createdAt)}
                </p>

                <p className="whitespace-pre-wrap py-3 text-sm">
                  {post.text}
                </p>

                <button
                  className={`${secondary} self-start`}
                  onClick={() => void toggleLike(post)}
                >
                  {post.likedByMe ? "Unlike" : "Like"} · {post.likesCount}
                </button>

                <div className="mt-3 space-y-2">
                  {post.comments.map(comment => (
                    <p
                      key={comment.id}
                      className="rounded bg-slate-50 p-2 text-xs"
                    >
                      <b>{comment.authorName}:</b> {comment.body}
                    </p>
                  ))}
                </div>

                <form
                  onSubmit={event => void addComment(event, post.id)}
                  className="mt-3 flex gap-2"
                >
                  <input
                    className={inputClass}
                    value={commentText[post.id] || ""}
                    onChange={event =>
                      setCommentText(value => ({
                        ...value,
                        [post.id]: event.target.value,
                      }))
                    }
                    placeholder="Write a comment…"
                  />

                  <button className={primary}>Comment</button>
                </form>
              </article>
            ))}

            {!posts.length && (
              <p className="text-sm text-slate-500">
                No community posts yet.
              </p>
            )}
          </section>

          <aside className="space-y-4">
            <section className="card card-body">
              <div className="flex items-center justify-between gap-2">
                <h2 className="card-title">Notifications</h2>

                <button
                  className={secondary}
                  onClick={() => void markNotificationsRead()}
                >
                  Mark all read
                </button>
              </div>

              {notices.map(notice => (
                <div key={notice.id} className="border-t py-2">
                  <p className="text-sm font-semibold">{notice.title}</p>
                  <p className="text-xs text-slate-600">{notice.body}</p>
                  <p className="text-xs text-slate-400">
                    {formatDate(notice.createdAt)}
                    {notice.isRead ? " · Read" : " · New"}
                  </p>
                </div>
              ))}

              {!notices.length && (
                <p className="text-xs text-slate-500">No notifications.</p>
              )}
            </section>

            <section className="card card-body">
              <h2 className="card-title">Volunteer Network</h2>

              {people.map(person => (
                <div key={person.id} className="border-t py-2">
                  <p className="text-sm font-semibold">{person.name}</p>
                  <p className="text-xs text-slate-500">
                    {person.place} · {person.skills.join(", ")}
                  </p>

                  <button
                    className={`${secondary} mt-1`}
                    disabled={
                      person.connectionStatus === "connected"
                      || person.connectionStatus === "pending_sent"
                    }
                    onClick={() => void connect(person)}
                  >
                    {person.connectionStatus === "connected"
                      ? "Connected"
                      : person.connectionStatus === "pending_sent"
                        ? "Request sent"
                        : person.connectionStatus === "pending_received"
                          ? "Accept request"
                          : "Connect"}
                  </button>
                </div>
              ))}

              {!people.length && (
                <p className="text-xs text-slate-500">
                  No other volunteer profiles available.
                </p>
              )}
            </section>
          </aside>

          {reports.length > 0 && (
            <section className="card card-body xl:col-span-3">
              <h2 className="card-title">Community moderation queue</h2>

              {reports.map(report => (
                <div
                  key={report.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-t py-3"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      Report by {report.reporterName}
                    </p>
                    <p className="text-sm">{report.reason}</p>
                    <p className="text-xs text-slate-500">
                      Post: {report.post.text}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      className={secondary}
                      onClick={() => void moderate(report.id, "dismiss")}
                    >
                      Dismiss
                    </button>

                    <button
                      className="btn-danger"
                      onClick={() => void moderate(report.id, "remove")}
                    >
                      Remove Post
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
