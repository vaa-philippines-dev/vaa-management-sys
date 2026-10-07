// Client-safe labels and option lists for the Staff Masterlist. Prisma reads
// live in lib/staff.ts — kept apart so 'use client' components can import this
// without Turbopack following Prisma into `pg`.

export type Tone = 'success' | 'warning' | 'destructive' | 'info' | 'neutral'

// StaffRecord statuses are the sheet's own text, not GeneralStatus.
export const STAFF_STATUS_OPTIONS = ['ACTIVE', 'ON HOLD', 'TRANSFERRED', 'RESIGNED', 'REMOVED', 'INACTIVE'] as const
export const STAFF_EMPLOYMENT_OPTIONS = ['EMPLOYED', 'PROMOTED', 'TRANSFERRED', 'END OF CONTRACT'] as const
// Statuses that mean the person is no longer working as staff.
export const STAFF_OFFBOARDED_STATUSES = new Set(['RESIGNED', 'REMOVED', 'TRANSFERRED', 'INACTIVE'])

export const STAFF_STATUS_TONE: Record<string, Tone> = {
  ACTIVE: 'success',
  'ON HOLD': 'warning',
  TRANSFERRED: 'info',
  RESIGNED: 'destructive',
  REMOVED: 'destructive',
  INACTIVE: 'neutral',
}

export const STAFF_EMPLOYMENT_TONE: Record<string, Tone> = {
  EMPLOYED: 'success',
  PROMOTED: 'info',
  TRANSFERRED: 'warning',
  'END OF CONTRACT': 'warning',
}

// Offboarding outcomes. RETURN_TO_VA ends the staff engagement and moves the
// person back onto the VA Masterlist (their account becomes a VA account).
export const STAFF_OFFBOARD_OUTCOMES = [
  { value: 'RESIGNED', label: 'Resigned (voluntary)' },
  { value: 'REMOVED', label: 'Removed (involuntary)' },
  { value: 'RETURN_TO_VA', label: 'Back to VA — demote to the VA Masterlist' },
] as const

export const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

// Active, then On Hold, above every inactive status — the VA Masterlist's
// ordering when no status filter is set.
export const staffStatusTier = (status: string | null) => (status === 'ACTIVE' ? 0 : status === 'ON HOLD' ? 1 : 2)

// ── Masterlist grouping ────────────────────────────────────────────────
// The Masterlist's Staff table is sectioned by department in the company's
// own order, with Service split per service line ("Service (Amazon)" …).
// Leadership sections (Executive, Top Management, Business Operations, HR)
// keep the HR sheet's row order, the HR head first; every other section
// lists its most recent hires first.

export type StaffGroup = {
  key: string
  label: string
  rank: number
  // 'sheet' = HR sheet row order; 'recent' = newest staff hire date first.
  order: 'sheet' | 'recent'
}

// Sheet department text varies ("Legal and Finance" / "Legal & Finance").
const normDept = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim()

const STAFF_GROUP_ORDER: { names: string[]; label: string; order: StaffGroup['order'] }[] = [
  { names: ['executive'], label: 'Executive', order: 'sheet' },
  { names: ['top management'], label: 'Top Management', order: 'sheet' },
  { names: ['business operations'], label: 'Business Operations', order: 'sheet' },
  { names: ['human resources and people', 'human resources'], label: 'Human Resources', order: 'sheet' },
  { names: ['legal and finance'], label: 'Legal & Finance', order: 'recent' },
  { names: ['customer success'], label: 'Customer Success', order: 'recent' },
  { names: ['academy and knowledge'], label: 'Academy & Knowledge', order: 'recent' },
  { names: ['marketing'], label: 'Marketing', order: 'recent' },
  { names: ['sales'], label: 'Sales', order: 'recent' },
]
const SERVICE_RANK = STAFF_GROUP_ORDER.length

// Leads their section regardless of sheet order.
export const STAFF_GROUP_HEADS: Record<string, string> = {
  'Human Resources': 'joanna kris de ocampo',
}

export function staffGroupOf(department: string | null, subdepartment: string | null): StaffGroup {
  if (!department) return { key: 'none', label: 'No Department', rank: SERVICE_RANK + 2, order: 'recent' }
  const d = normDept(department)
  const i = STAFF_GROUP_ORDER.findIndex((g) => g.names.includes(d))
  if (i >= 0) return { key: STAFF_GROUP_ORDER[i].label, label: STAFF_GROUP_ORDER[i].label, rank: i, order: STAFF_GROUP_ORDER[i].order }
  // Service lines sort alphabetically among themselves (Amazon, Creatives,
  // Executive Assistant, PPC, Social Media, Walmart, Wholesale), so a new
  // one slots in without a code change.
  if (d === 'service' || d === 'service department') {
    const sub = subdepartment && normDept(subdepartment) !== d ? subdepartment.trim() : null
    const label = sub ? `Service (${sub})` : 'Service'
    return { key: label, label, rank: SERVICE_RANK, order: 'recent' }
  }
  return { key: department, label: department, rank: SERVICE_RANK + 1, order: 'recent' }
}

// Section order: rank, then label (Service lines, unlisted departments).
// Plain "Service" sits after its named lines.
export function compareStaffGroups(a: StaffGroup, b: StaffGroup): number {
  if (a.rank !== b.rank) return a.rank - b.rank
  if (a.label === b.label) return 0
  if (a.label === 'Service') return 1
  if (b.label === 'Service') return -1
  return a.label.localeCompare(b.label)
}
