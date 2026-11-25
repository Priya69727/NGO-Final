import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import {
  Plus,
  Search,
  MapPin,
  Eye,
  Edit2,
  Upload,
  Download,
  Users,
  UserCheck,
  FolderKanban,
  MapPinned,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  HeartHandshake,
  Loader2,
  FileCheck2,
} from "lucide-react"
import {
  apiList,
  apiCreate,
  apiUpdate,
  apiRequest,
} from "../../services/apiClient"

type Beneficiary = {
  id: string
  createdAt?: string | null
  referenceCode?: string | null
  fullName: string
  dateOfBirth?: string | null
  gender?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  district?: string | null
  state?: string | null
  consentToDataUse?: boolean
  status: "Active" | "Inactive"
}

type Enrollment = {
  id: string
  beneficiaryId: string
  projectId: string
  category?: string | null
  enrolledOn?: string | null
  status?: string | null
  notes?: string | null
}

type Service = {
  id: string
  enrollmentId: string
  serviceName: string
  providedOn: string
  notes?: string
}

type Project = {
  id: string
  name?: string
  title?: string
  projectName?: string
}

type BeneficiaryView = Beneficiary & {
  age: number | null
  location: string
  category: string
  project: string
  enrolled: string
  services: Service[]
  enrollment?: Enrollment
}

type ImportPreview = {
  total: number
  valid: number
  duplicates: number
  invalid: number
  rows: {
    row: number
    name: string | null
    valid: boolean
    duplicate: boolean
    errors: string[]
  }[]
}

type ImportResult = {
  message: string
  total: number
  imported: number
  skipped: number
  failed: {
    row: number
    name: string | null
    errors: string[]
  }[]
}

const categories = [
  "All",
  "Health",
  "Education",
  "Water",
  "Elderly",
  "Livelihood",
  "Nutrition",
]

const categoryColors: Record<string, string> = {
  Health: "bg-rose-50 text-rose-700 border-rose-100",
  Education: "bg-blue-50 text-blue-700 border-blue-100",
  Water: "bg-cyan-50 text-cyan-700 border-cyan-100",
  Elderly: "bg-violet-50 text-violet-700 border-violet-100",
  Livelihood: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Nutrition: "bg-amber-50 text-amber-700 border-amber-100",
}

const categoryIcons: Record<string, string> = {
  Health: "🏥",
  Education: "📚",
  Water: "💧",
  Nutrition: "🥗",
  Livelihood: "💼",
  Elderly: "👵",
}

const inputClass =
  "form-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"

function getAge(dob?: string | null): number | null {
  if (!dob) return null

  const birth = new Date(`${dob.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()

  const birthdayNotReached =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() &&
      today.getDate() < birth.getDate())

  if (birthdayNotReached) age--

  return age >= 0 ? age : null
}

function formatDate(value?: string | null): string {
  if (!value) return "—"

  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function projectName(project?: Project): string {
  return project?.name || project?.title || project?.projectName || "Project"
}

function downloadTemplate() {
  const headers = [
    "reference_code",
    "full_name",
    "date_of_birth",
    "gender",
    "phone",
    "email",
    "address",
    "city",
    "district",
    "state",
    "consent_to_data_use",
    "status",
    "project_id",
    "category",
    "enrolled_on",
    "enrollment_status",
    "enrollment_notes",
    "service_name",
    "service_date",
    "service_notes",
  ]

  const example = [
    "BNF-001",
    "Example Beneficiary",
    "1995-04-15",
    "Female",
    "+919876543210",
    "example@email.com",
    "House 12, Main Road",
    "Pune",
    "Pune",
    "Maharashtra",
    "Yes",
    "Active",
    "",
    "Education",
    "2026-11-23",
    "Active",
    "",
    "School Supplies",
    "2026-11-23",
    "Books and stationery provided",
  ]

  const csv = [headers, example]
    .map((row) =>
      row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
    )
    .join("\r\n")

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;",
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = "beneficiary_import_template.csv"
  link.click()
  URL.revokeObjectURL(url)
}

export default function BeneficiariesPage() {
  const [records, setRecords] = useState<BeneficiaryView[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [search, setSearch] = useState("")
  const [catFilter, setCatFilter] = useState("All")
  const [statusFilter, setStatusFilter] = useState("All")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<BeneficiaryView | null>(null)
  const [selected, setSelected] = useState<BeneficiaryView | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadData = async () => {
    setLoading(true)
    setError("")

    try {
      const [beneficiaryResponse, enrollmentResponse, serviceResponse, projectResponse] =
        await Promise.all([
          apiList<Beneficiary>("beneficiaries", {
            limit: 200,
            sort: "createdAt",
            order: "desc",
          }),
          apiList<Enrollment>("beneficiary-enrollments", {
            limit: 200,
          }),
          apiList<Service>("beneficiary-services", {
            limit: 200,
          }),
          apiList<Project>("projects", {
            limit: 200,
          }),
        ])

      const projectMap = new Map(
        projectResponse.items.map((project) => [
          project.id,
          projectName(project),
        ]),
      )

      const servicesByEnrollment = new Map<string, Service[]>()

      serviceResponse.items.forEach((service) => {
        const current = servicesByEnrollment.get(service.enrollmentId) || []
        current.push(service)
        servicesByEnrollment.set(service.enrollmentId, current)
      })

      const enrollmentByBeneficiary = new Map<string, Enrollment[]>()

      enrollmentResponse.items.forEach((enrollment) => {
        const current =
          enrollmentByBeneficiary.get(enrollment.beneficiaryId) || []
        current.push(enrollment)
        enrollmentByBeneficiary.set(enrollment.beneficiaryId, current)
      })

      const views: BeneficiaryView[] = beneficiaryResponse.items.map(
        (beneficiary) => {
          const beneficiaryEnrollments =
            enrollmentByBeneficiary.get(beneficiary.id) || []

          const activeEnrollment =
            beneficiaryEnrollments.find(
              (item) => item.status === "Active",
            ) || beneficiaryEnrollments[0]

          const beneficiaryServices = activeEnrollment
            ? servicesByEnrollment.get(activeEnrollment.id) || []
            : []

          return {
            ...beneficiary,
            age: getAge(beneficiary.dateOfBirth),
            location: [
              beneficiary.address,
              beneficiary.city,
              beneficiary.district,
              beneficiary.state,
            ]
              .filter(Boolean)
              .join(", "),
            category: activeEnrollment?.category || "Unassigned",
            project: activeEnrollment
              ? projectMap.get(activeEnrollment.projectId) || "Project"
              : "Not assigned",
            enrolled: activeEnrollment?.enrolledOn || "",
            services: beneficiaryServices,
            enrollment: activeEnrollment,
          }
        },
      )

      setRecords(views)
      setProjects(projectResponse.items)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load beneficiary records.",
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()

    return records.filter((beneficiary) => {
      const matchesCategory =
        catFilter === "All" || beneficiary.category === catFilter

      const matchesStatus =
        statusFilter === "All" || beneficiary.status === statusFilter

      const searchable = [
        beneficiary.fullName,
        beneficiary.referenceCode,
        beneficiary.phone,
        beneficiary.email,
        beneficiary.location,
        beneficiary.project,
        beneficiary.category,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return (
        matchesCategory &&
        matchesStatus &&
        (!term || searchable.includes(term))
      )
    })
  }, [records, search, catFilter, statusFilter])

  const activeCount = records.filter(
    (record) => record.status === "Active",
  ).length

  const newThisMonth = records.filter((record) => {
    const enrolled = record.createdAt
    if (!enrolled) return false

    const created = new Date(enrolled)
    const now = new Date()

    return (
      created.getMonth() === now.getMonth() &&
      created.getFullYear() === now.getFullYear()
    )
  }).length

  const stateCount = new Set(
    records.map((record) => record.state).filter(Boolean),
  ).size

  const categoryCounts = categories.slice(1).map((category) => ({
    category,
    count: records.filter(
      (record) => record.category === category,
    ).length,
  }))

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
  }

  const saveBeneficiary = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError("")

    const data = new FormData(event.currentTarget)

    const fullName = String(data.get("fullName") || "").trim()
    const dateOfBirth = String(data.get("dateOfBirth") || "")
    const projectId = String(data.get("projectId") || "")
    const category = String(data.get("category") || "")
    const serviceNames = String(data.get("services") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)

    const beneficiaryPayload = {
      referenceCode: String(data.get("referenceCode") || "").trim() || null,
      fullName,
      dateOfBirth: dateOfBirth || null,
      gender: String(data.get("gender") || "") || null,
      phone: String(data.get("phone") || "").trim() || null,
      email: String(data.get("email") || "").trim() || null,
      address: String(data.get("address") || "").trim() || null,
      city: String(data.get("city") || "").trim() || null,
      district: String(data.get("district") || "").trim() || null,
      state: String(data.get("state") || "").trim() || null,
      consentToDataUse: data.get("consent") === "on",
      status: editing?.status || "Active",
    }

    try {
      let saved: Beneficiary

      if (editing) {
        saved = await apiUpdate<Beneficiary>(
          "beneficiaries",
          editing.id,
          beneficiaryPayload,
        )
      } else {
        saved = await apiCreate<Beneficiary>(
          "beneficiaries",
          beneficiaryPayload,
        )
      }

      if (projectId) {
        const enrollmentPayload = {
          beneficiaryId: saved.id,
          projectId,
          category,
          enrolledOn: String(data.get("enrolledOn") || new Date().toISOString().slice(0, 10)),
          status: "Active",
          notes: String(data.get("enrollmentNotes") || ""),
        }

        if (editing?.enrollment) {
          await apiUpdate(
            "beneficiary-enrollments",
            editing.enrollment.id,
            enrollmentPayload,
          )
        } else {
          const enrollment = await apiCreate<Enrollment>(
            "beneficiary-enrollments",
            enrollmentPayload,
          )

          for (const serviceName of serviceNames) {
            await apiCreate("beneficiary-services", {
              enrollmentId: enrollment.id,
              serviceName,
              providedOn: new Date().toISOString().slice(0, 10),
              notes: "",
            })
          }
        }
      }

      closeForm()
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save beneficiary.",
      )
    } finally {
      setSaving(false)
    }
  }

  const openImport = () => {
    setShowImport(true)
    setImportFile(null)
    setPreview(null)
    setImportResult(null)
    setImportError("")
  }

  const closeImport = () => {
    if (importing) return
    setShowImport(false)
    setImportFile(null)
    setPreview(null)
    setImportResult(null)
    setImportError("")
  }

  const previewImport = async () => {
    if (!importFile) {
      setImportError("Please select a CSV or Excel file first.")
      return
    }

    setImporting(true)
    setImportError("")
    setPreview(null)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append("file", importFile)

      const result = await apiRequest<ImportPreview>(
        "/beneficiaries/import/preview",
        {
          method: "POST",
          body: formData,
        },
      )

      setPreview(result)
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Could not preview this file.",
      )
    } finally {
      setImporting(false)
    }
  }

  const confirmImport = async () => {
    if (!importFile || !preview || preview.valid === 0) return

    const confirmed = window.confirm(
      `Import ${preview.valid} valid beneficiary records into the database? Duplicate and invalid rows will be skipped.`,
    )

    if (!confirmed) return

    setImporting(true)
    setImportError("")

    try {
      const formData = new FormData()
      formData.append("file", importFile)

      const result = await apiRequest<ImportResult>(
        "/beneficiaries/import",
        {
          method: "POST",
          body: formData,
        },
      )

      setImportResult(result)
      setPreview(null)
      await loadData()
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Import could not be completed.",
      )
    } finally {
      setImporting(false)
    }
  }

  const editBeneficiary = (beneficiary: BeneficiaryView) => {
    setEditing(beneficiary)
    setSelected(null)
    setShowForm(true)
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Page heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal-600">
            <HeartHandshake size={15} />
            People & Community
          </div>
          <h1 className="page-title">Beneficiaries</h1>
          <p className="page-subtitle">
            Manage beneficiary profiles, project enrolments and support services
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openImport}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-2.5 text-sm font-semibold text-teal-700 shadow-sm transition hover:border-teal-400 hover:bg-teal-50"
          >
            <Upload size={16} />
            Import CSV / Excel
          </button>

          <button
            type="button"
            onClick={() => {
              setEditing(null)
              setSelected(null)
              setShowForm(true)
            }}
            className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 shadow-sm"
          >
            <Plus size={16} />
            Add Beneficiary
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total Beneficiaries",
            value: records.length.toLocaleString("en-IN"),
            note: "Registered profiles",
            icon: Users,
            color: "text-teal-600",
            bg: "bg-teal-50",
          },
          {
            label: "Active Beneficiaries",
            value: activeCount.toLocaleString("en-IN"),
            note: "Currently receiving support",
            icon: UserCheck,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            label: "New This Month",
            value: newThisMonth.toLocaleString("en-IN"),
            note: "Recently registered",
            icon: FileCheck2,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "Geographic Reach",
            value: `${stateCount}`,
            note: "States represented",
            icon: MapPinned,
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
        ].map((stat) => {
          const Icon = stat.icon

          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500">
                    {stat.label}
                  </p>
                  <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-800">
                    {loading ? "—" : stat.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{stat.note}</p>
                </div>
                <div className={`rounded-xl p-3 ${stat.bg} ${stat.color}`}>
                  <Icon size={21} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Category cards */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              Beneficiary Categories
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Select a category to filter the records
            </p>
          </div>
          {catFilter !== "All" && (
            <button
              onClick={() => setCatFilter("All")}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700"
            >
              Clear filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {categoryCounts.map((item) => (
            <button
              type="button"
              key={item.category}
              onClick={() =>
                setCatFilter(
                  catFilter === item.category ? "All" : item.category,
                )
              }
              className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
                catFilter === item.category
                  ? "border-teal-400 bg-teal-50 ring-2 ring-teal-100"
                  : "border-slate-100 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">
                  {categoryIcons[item.category]}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Category
                </span>
              </div>
              <p className="mt-3 text-2xl font-extrabold text-slate-800">
                {loading ? "—" : item.count.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {item.category}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Add/edit form */}
      {showForm && (
        <section className="overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-teal-50 to-white px-5 py-4">
            <div>
              <h2 className="font-bold text-slate-800">
                {editing ? "Edit Beneficiary" : "Register Beneficiary"}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Enter personal details and project enrolment information
              </p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700"
              aria-label="Close form"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={saveBeneficiary} className="space-y-5 p-5">
            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-teal-700">
                Personal Information
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="text-xs font-semibold text-slate-600">
                  Full Name *
                  <input
                    name="fullName"
                    required
                    maxLength={120}
                    className={`${inputClass} mt-1.5`}
                    defaultValue={editing?.fullName}
                    placeholder="Enter beneficiary name"
                  />
                </label>

                <label className="text-xs font-semibold text-slate-600">
                  Reference Code
                  <input
                    name="referenceCode"
                    className={`${inputClass} mt-1.5`}
                    defaultValue={editing?.referenceCode || ""}
                    placeholder="e.g. BNF-001"
                  />
                </label>

                <label className="text-xs font-semibold text-slate-600">
                  Date of Birth
                  <input
                    name="dateOfBirth"
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    className={`${inputClass} mt-1.5`}
                    defaultValue={editing?.dateOfBirth?.slice(0, 10) || ""}
                  />
                </label>

                <label className="text-xs font-semibold text-slate-600">
                  Gender
                  <select
                    name="gender"
                    className={`${inputClass} mt-1.5`}
                    defaultValue={editing?.gender || ""}
                  >
                    <option value="">Select gender</option>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other</option>
                    <option>Prefer not to say</option>
                  </select>
                </label>

                <label className="text-xs font-semibold text-slate-600">
                  Phone Number
                  <input
                    name="phone"
                    type="tel"
                    className={`${inputClass} mt-1.5`}
                    defaultValue={editing?.phone || ""}
                    placeholder="+91 98765 43210"
                  />
                </label>

                <label className="text-xs font-semibold text-slate-600">
                  Email Address
                  <input
                    name="email"
                    type="email"
                    className={`${inputClass} mt-1.5`}
                    defaultValue={editing?.email || ""}
                    placeholder="name@example.com"
                  />
                </label>

                <label className="text-xs font-semibold text-slate-600 md:col-span-2 xl:col-span-3">
                  Address
                  <input
                    name="address"
                    className={`${inputClass} mt-1.5`}
                    defaultValue={editing?.address || ""}
                    placeholder="House number, street, village or area"
                  />
                </label>

                <label className="text-xs font-semibold text-slate-600">
                  City
                  <input
                    name="city"
                    className={`${inputClass} mt-1.5`}
                    defaultValue={editing?.city || ""}
                    placeholder="City"
                  />
                </label>

                <label className="text-xs font-semibold text-slate-600">
                  District
                  <input
                    name="district"
                    className={`${inputClass} mt-1.5`}
                    defaultValue={editing?.district || ""}
                    placeholder="District"
                  />
                </label>

                <label className="text-xs font-semibold text-slate-600">
                  State
                  <input
                    name="state"
                    className={`${inputClass} mt-1.5`}
                    defaultValue={editing?.state || ""}
                    placeholder="State"
                  />
                </label>
              </div>

              <label className="mt-4 flex items-center gap-2 text-xs text-slate-600">
                <input
                  name="consent"
                  type="checkbox"
                  defaultChecked={editing?.consentToDataUse ?? false}
                  className="h-4 w-4 rounded border-slate-300 accent-teal-600"
                />
                Consent obtained for storing and using beneficiary data
              </label>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-teal-700">
                Project Enrolment
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="text-xs font-semibold text-slate-600">
                  Assigned Project
                  <select
                    name="projectId"
                    className={`${inputClass} mt-1.5`}
                    defaultValue={editing?.enrollment?.projectId || ""}
                  >
                    <option value="">No project assigned</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {projectName(project)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-semibold text-slate-600">
                  Category
                  <select
                    name="category"
                    className={`${inputClass} mt-1.5`}
                    defaultValue={editing?.category || ""}
                  >
                    <option value="">Select category</option>
                    {categories.slice(1).map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-semibold text-slate-600">
                  Enrolment Date
                  <input
                    name="enrolledOn"
                    type="date"
                    className={`${inputClass} mt-1.5`}
                    defaultValue={
                      editing?.enrolled?.slice(0, 10) ||
                      new Date().toISOString().slice(0, 10)
                    }
                  />
                </label>

                <label className="text-xs font-semibold text-slate-600">
                  Services Provided
                  <input
                    name="services"
                    className={`${inputClass} mt-1.5`}
                    defaultValue={
                      editing?.services.map((service) => service.serviceName).join(", ") || ""
                    }
                    placeholder="Medical checkup, medicine, training..."
                  />
                  <span className="mt-1 block font-normal text-slate-400">
                    Separate multiple services with commas
                  </span>
                </label>

                <label className="text-xs font-semibold text-slate-600 md:col-span-2">
                  Enrolment Notes
                  <textarea
                    name="enrollmentNotes"
                    rows={2}
                    className={`${inputClass} mt-1.5 resize-y`}
                    defaultValue={editing?.enrollment?.notes || ""}
                    placeholder="Additional project enrolment information"
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={closeForm}
                className="btn-secondary rounded-xl px-4 py-2.5"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 disabled:opacity-60"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                {editing ? "Save Changes" : "Register Beneficiary"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Beneficiary profile */}
      {selected && (
        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">
                Beneficiary Profile
              </p>
              <h2 className="mt-1 font-bold text-slate-800">
                {selected.fullName}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700"
              aria-label="Close profile"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
            <div className="space-y-3 text-sm">
              <p><strong>Reference:</strong> {selected.referenceCode || "—"}</p>
              <p><strong>Age:</strong> {selected.age ?? "Not provided"}</p>
              <p><strong>Gender:</strong> {selected.gender || "—"}</p>
              <p><strong>Phone:</strong> {selected.phone || "—"}</p>
              <p><strong>Email:</strong> {selected.email || "—"}</p>
              <p><strong>Location:</strong> {selected.location || "—"}</p>
              <p><strong>Consent:</strong> {selected.consentToDataUse ? "Yes" : "No"}</p>
            </div>

            <div className="space-y-3 text-sm">
              <p><strong>Project:</strong> {selected.project}</p>
              <p><strong>Category:</strong> {selected.category}</p>
              <p><strong>Enrolled:</strong> {formatDate(selected.enrolled)}</p>
              <p>
                <strong>Status:</strong>{" "}
                <span className={selected.status === "Active" ? "text-emerald-600" : "text-slate-500"}>
                  {selected.status}
                </span>
              </p>
              <div>
                <strong>Services</strong>
                {selected.services.length ? (
                  <ul className="mt-2 space-y-1">
                    {selected.services.map((service) => (
                      <li key={service.id} className="rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-800">
                        {service.serviceName} · {formatDate(service.providedOn)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">No services recorded.</p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 px-5 py-3">
            <button
              type="button"
              onClick={() => editBeneficiary(selected)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-800"
            >
              <Edit2 size={15} />
              Edit beneficiary
            </button>
          </div>
        </section>
      )}

      {/* Search and filters */}
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-md">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className={`${inputClass} pl-10`}
              placeholder="Search by name, reference, phone, project or location..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-teal-400"
            >
              <option value="All">All statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>

            <button
              type="button"
              onClick={() => void loadData()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              type="button"
              key={category}
              onClick={() => setCatFilter(category)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                catFilter === category
                  ? "border-teal-500 bg-teal-500 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      {/* Records table */}
      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-800">Beneficiary Directory</h2>
            <p className="mt-1 text-xs text-slate-400">
              Profiles and their current project enrolments
            </p>
          </div>
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
            {filtered.length} records
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
            <Loader2 size={18} className="animate-spin" />
            Loading beneficiary records...
          </div>
        ) : error ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Could not load records. Check the backend connection and refresh.
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-14 text-center">
            <div className="rounded-2xl bg-slate-50 p-4 text-slate-400">
              <Users size={28} />
            </div>
            <h3 className="mt-3 font-semibold text-slate-700">
              No beneficiaries found
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Try changing your search or filters, or register a beneficiary.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full min-w-[1050px]">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Beneficiary</th>
                  <th>Age / Gender</th>
                  <th>Location</th>
                  <th>Category</th>
                  <th>Project</th>
                  <th>Enrolled</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((beneficiary) => (
                  <tr key={beneficiary.id}>
                    <td className="text-xs font-medium text-slate-400">
                      {beneficiary.referenceCode || beneficiary.id.slice(0, 8)}
                    </td>
                    <td>
                      <div className="font-semibold text-slate-800">
                        {beneficiary.fullName}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {beneficiary.phone || beneficiary.email || "No contact details"}
                      </div>
                    </td>
                    <td className="text-xs text-slate-600">
                      {beneficiary.age === null ? "—" : `${beneficiary.age}y`}
                      {" · "}
                      {beneficiary.gender || "—"}
                    </td>
                    <td className="max-w-[190px]">
                      <div className="flex items-start gap-1 text-xs text-slate-600">
                        <MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" />
                        <span className="truncate">{beneficiary.location || "—"}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${categoryColors[beneficiary.category] || "border-slate-100 bg-slate-50 text-slate-600"}`}>
                        {beneficiary.category}
                      </span>
                    </td>
                    <td className="max-w-[170px] truncate text-xs text-slate-600">
                      {beneficiary.project}
                    </td>
                    <td className="text-xs text-slate-500">
                      {formatDate(beneficiary.enrolled)}
                    </td>
                    <td>
                      <span className={beneficiary.status === "Active" ? "badge badge-green" : "badge badge-gray"}>
                        {beneficiary.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`View ${beneficiary.fullName}`}
                          onClick={() => setSelected(beneficiary)}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-teal-50 hover:text-teal-700"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Edit ${beneficiary.fullName}`}
                          onClick={() => editBeneficiary(beneficiary)}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Edit2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
          Showing {filtered.length} of {records.length} beneficiaries
        </div>
      </section>

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6">
          <div className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-teal-50 to-white px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-teal-100 p-2.5 text-teal-700">
                  <FileSpreadsheet size={22} />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">
                    Import Beneficiaries
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Upload a CSV or Excel spreadsheet
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeImport}
                disabled={importing}
                className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700"
                aria-label="Close import window"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 p-5">
              {!importResult ? (
                <>
                  <div className="rounded-xl border border-teal-100 bg-teal-50/70 p-4">
                    <div className="flex items-start gap-3">
                      <Download size={19} className="mt-0.5 shrink-0 text-teal-700" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-800">
                          Start with the import template
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          Use the provided column names to organise your beneficiary
                          data. You can open the CSV template in Excel and save it
                          as an Excel workbook if required.
                        </p>
                        <button
                          type="button"
                          onClick={downloadTemplate}
                          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-800"
                        >
                          <Download size={14} />
                          Download CSV Template
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold text-slate-700">
                      Select spreadsheet
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(event) => {
                        setImportFile(event.target.files?.[0] || null)
                        setPreview(null)
                        setImportError("")
                      }}
                      className="block w-full cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-100 file:px-3 file:py-2 file:text-xs file:font-bold file:text-teal-800 hover:border-teal-400"
                    />
                    <p className="mt-2 text-[11px] text-slate-400">
                      Supported formats: CSV, XLSX and XLS. Maximum file size: 10 MB.
                    </p>
                    {importFile && (
                      <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                        <FileSpreadsheet size={16} className="text-teal-600" />
                        <span className="flex-1 truncate font-semibold">
                          {importFile.name}
                        </span>
                        <span className="text-slate-400">
                          {(importFile.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                    <strong>Before importing:</strong> Full name is required.
                    Existing beneficiaries are checked using reference code,
                    email, and matching name plus phone.  To assign a beneficiary
                    to a project, enter its unique Project Code, such as
                    PRJ-2026-001. You do not need to enter a Project UUID.
                  </div>

                  {importError && (
                    <div className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                      <AlertCircle size={16} className="shrink-0" />
                      {importError}
                    </div>
                  )}

                  {preview && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">
                          Import Preview
                        </h3>
                        <p className="mt-1 text-xs text-slate-400">
                          Review the rows before saving them to PostgreSQL.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          { label: "Total rows", value: preview.total, color: "text-slate-800", bg: "bg-slate-50" },
                          { label: "Ready to import", value: preview.valid, color: "text-emerald-700", bg: "bg-emerald-50" },
                          { label: "Duplicates", value: preview.duplicates, color: "text-amber-700", bg: "bg-amber-50" },
                          { label: "Invalid", value: preview.invalid, color: "text-rose-700", bg: "bg-rose-50" },
                        ].map((item) => (
                          <div key={item.label} className={`rounded-xl p-3 ${item.bg}`}>
                            <p className={`text-xl font-extrabold ${item.color}`}>
                              {item.value}
                            </p>
                            <p className="mt-1 text-[10px] font-semibold text-slate-500">
                              {item.label}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="max-h-56 overflow-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left text-xs">
                          <thead className="sticky top-0 bg-slate-50 text-slate-500">
                            <tr>
                              <th className="px-3 py-2">Row</th>
                              <th className="px-3 py-2">Beneficiary</th>
                              <th className="px-3 py-2">Result</th>
                              <th className="px-3 py-2">Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.rows.map((row) => (
                              <tr key={row.row} className="border-t border-slate-100">
                                <td className="px-3 py-2 text-slate-400">
                                  {row.row}
                                </td>
                                <td className="px-3 py-2 font-semibold text-slate-700">
                                  {row.name || "Unnamed"}
                                </td>
                                <td className="px-3 py-2">
                                  {row.valid ? (
                                    <span className="font-bold text-emerald-700">Valid</span>
                                  ) : row.duplicate ? (
                                    <span className="font-bold text-amber-700">Duplicate</span>
                                  ) : (
                                    <span className="font-bold text-rose-700">Invalid</span>
                                  )}
                                </td>
                                <td className="max-w-[220px] px-3 py-2 text-slate-500">
                                  {row.errors.join(" ") || (row.duplicate ? "Already exists or repeated in this file." : "Ready")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <CheckCircle2 size={30} />
                    </div>
                    <h3 className="mt-3 text-lg font-extrabold text-emerald-800">
                      Import Completed
                    </h3>
                    <p className="mt-1 text-xs text-emerald-700">
                      {importResult.message}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-slate-50 p-3 text-center">
                      <p className="text-2xl font-extrabold text-slate-800">
                        {importResult.total}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">Total</p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-3 text-center">
                      <p className="text-2xl font-extrabold text-emerald-700">
                        {importResult.imported}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">Imported</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-3 text-center">
                      <p className="text-2xl font-extrabold text-amber-700">
                        {importResult.skipped}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">Skipped</p>
                    </div>
                  </div>

                  {importResult.failed.length > 0 && (
                    <div className="max-h-48 overflow-auto rounded-xl border border-rose-100">
                      <div className="border-b border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                        Rows that could not be imported
                      </div>
                      {importResult.failed.map((item) => (
                        <div key={item.row} className="border-b border-slate-100 px-3 py-2 text-xs">
                          <p className="font-semibold text-slate-700">
                            Row {item.row}: {item.name || "Unnamed"}
                          </p>
                          <p className="mt-1 text-rose-600">
                            {item.errors.join(" ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
              {!importResult ? (
                <>
                  <button
                    type="button"
                    onClick={closeImport}
                    disabled={importing}
                    className="btn-secondary rounded-xl px-4 py-2.5"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={previewImport}
                    disabled={!importFile || importing}
                    className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {importing ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Eye size={15} />
                    )}
                    Preview File
                  </button>
                  {preview && (
                    <button
                      type="button"
                      onClick={confirmImport}
                      disabled={importing || preview.valid === 0}
                      className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {importing && <Loader2 size={15} className="animate-spin" />}
                      Import {preview.valid} Records
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={closeImport}
                  className="btn-primary rounded-xl px-5 py-2.5"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}