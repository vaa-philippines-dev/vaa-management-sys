import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { getViewScope, isTeamScoped, type Scope } from '@/lib/scope'
import { DEPARTMENT_SCOPED_ROLES, type getCurrentUser } from '@/lib/auth'

// The Staff Masterlist is people, not sheet rows: a promotion or transfer
// gives one person several StaffRecords (one per engagement, same as the
// sheet). A person is every record sharing a userId, or — for the few rows
// with no account — sharing a name. Their *latest* record (newest start date)
// carries their current position/status and is what /staff/[id] addresses.

const personSelect = {
  id: true,
  userId: true,
  staffId: true,
  hireDate: true,
  startDate: true,
  department: true,
  subdepartment: true,
  firstName: true,
  lastName: true,
  position: true,
  level: true,
  workEmail: true,
  remarks: true,
  generalStatus: true,
  statusDate: true,
  employmentStatus: true,
  eocDate: true,
  sheetRow: true,
  createdAt: true,
  user: { select: { id: true, email: true, userType: true, systemRole: true, isActive: true } },
} as const

async function loadRecords(where = {}) {
  return prisma.staffRecord.findMany({ where, select: personSelect })
}

export type StaffRecordRow = Awaited<ReturnType<typeof loadRecords>>[number]

export type StaffPerson = {
  id: string // latest record's id — the /staff/[id] key
  name: string
  latest: StaffRecordRow
  records: StaffRecordRow[] // newest first
  // When they joined as staff: the earliest START DATE across engagements.
  // Not the VAA hire date — staff upskilled from VA were hired at VAA years
  // before they joined staff; direct recruits have the two (nearly) equal.
  staffHireDate: Date | null
  // Earliest VAA hire date across engagements; the sheet repeats it per row.
  vaaHireDate: Date | null
}

const DAY_MS = 24 * 60 * 60 * 1000

// True when the VAA hire date is meaningfully earlier than the staff hire
// date (e.g. upskilled from VA). Sheet dates within 36h are the same day —
// the original import wrote some at local UTC+8 midnight.
export const hiredBeforeStaff = (p: Pick<StaffPerson, 'staffHireDate' | 'vaaHireDate'>) =>
  !!p.vaaHireDate && (!p.staffHireDate || p.staffHireDate.getTime() - p.vaaHireDate.getTime() > 1.5 * DAY_MS)

const earliest = (dates: (Date | null)[]) => {
  const ts = dates.filter((d): d is Date => !!d).map((d) => d.getTime())
  return ts.length ? new Date(Math.min(...ts)) : null
}

const normName = (first: string, last: string | null) => `${first} ${last ?? ''}`.toLowerCase().replace(/\s+/g, ' ').trim()

export const personKey = (r: Pick<StaffRecordRow, 'userId' | 'firstName' | 'lastName'>) =>
  r.userId ? `u:${r.userId}` : `n:${normName(r.firstName, r.lastName)}`

const byNewest = (a: StaffRecordRow, b: StaffRecordRow) =>
  (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0) ||
  (b.sheetRow ?? Number.MAX_SAFE_INTEGER) - (a.sheetRow ?? Number.MAX_SAFE_INTEGER) ||
  b.createdAt.getTime() - a.createdAt.getTime()

function toPeople(records: StaffRecordRow[]): StaffPerson[] {
  const groups = new Map<string, StaffRecordRow[]>()
  for (const r of records) groups.set(personKey(r), [...(groups.get(personKey(r)) ?? []), r])
  return [...groups.values()].map((rs) => {
    rs.sort(byNewest)
    const latest = rs[0]
    return {
      id: latest.id,
      name: [latest.firstName, latest.lastName].filter(Boolean).join(' '),
      latest,
      records: rs,
      staffHireDate: earliest(rs.map((r) => r.startDate)),
      vaaHireDate: earliest(rs.map((r) => r.hireDate)),
    }
  })
}

// Per-request memo: the Masterlist reads it for both its scorecards and the
// Staff table.
export const getStaffPeople = cache(async (): Promise<StaffPerson[]> => toPeople(await loadRecords()))

// Any of a person's record ids resolves to the whole person.
export async function getStaffPerson(recordId: string): Promise<StaffPerson | null> {
  const record = await prisma.staffRecord.findUnique({ where: { id: recordId }, select: personSelect })
  if (!record) return null
  const siblings = await loadRecords(
    record.userId
      ? { userId: record.userId }
      : { userId: null, firstName: { equals: record.firstName, mode: 'insensitive' }, lastName: record.lastName ? { equals: record.lastName, mode: 'insensitive' } : null }
  )
  return toPeople(siblings).find((p) => p.records.some((r) => r.id === recordId)) ?? null
}

// ── Department scoping ─────────────────────────────────────────────────
// The app department a staff record belongs to: its sheet Service line
// ("Service" / "Amazon" → "Amazon"), which matches the app's department
// names. Staff outside Service (Executive, HR, Finance, …) map to no app
// department, so only unrestricted viewers (admins/HR/EXECUTIVE) see them.
// Deliberately not DepartmentMembership: staff accounts' memberships are
// unreliable (Finance and Top Management staff carry "Amazon").
const normDept = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim()

export function staffServiceLine(r: Pick<StaffRecordRow, 'department' | 'subdepartment'>): string | null {
  if (!r.department || !r.subdepartment) return null
  const d = normDept(r.department)
  return d === 'service' || d === 'service department' ? r.subdepartment : null
}

// lib/scope.ts's Scope, resolved to a per-person test. A Team Leader's scope
// (userIds set) further limits it to the people on the teams they lead.
export async function staffScopeFilter(scope: Scope): Promise<(p: StaffPerson) => boolean> {
  if (scope === null) return () => true
  const departments = await prisma.department.findMany({ where: { id: { in: scope.departmentIds } }, select: { name: true } })
  const names = new Set(departments.map((d) => normDept(d.name)))
  return (p) => {
    const line = staffServiceLine(p.latest)
    if (!line || !names.has(normDept(line))) return false
    return scope.userIds === null || (!!p.latest.userId && scope.userIds.includes(p.latest.userId))
  }
}

// Whose staff view is limited to their own departments: Dept/Ops Managers and
// a staff-account Team Leader (lib/scope.ts). Everyone else who can open the
// staff directory sees all of it — admins/HR/EXECUTIVE by design, and
// STAFF-role accounts because HR specialists and the founders hold that role
// with no department membership, which would leave them an empty list.
export async function getStaffViewScope(user: Awaited<ReturnType<typeof getCurrentUser>>): Promise<Scope> {
  if (!user) return { departmentIds: [], userIds: [] }
  return DEPARTMENT_SCOPED_ROLES.includes(user.systemRole) || isTeamScoped(user) ? getViewScope(user) : null
}

export async function getVisibleStaffPeople(scope: Scope): Promise<StaffPerson[]> {
  const [people, inScope] = await Promise.all([getStaffPeople(), staffScopeFilter(scope)])
  return people.filter(inScope)
}
