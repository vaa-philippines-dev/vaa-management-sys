import { prisma } from '@/lib/prisma'

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
  // Earliest VAA hire date across engagements; the sheet repeats it per row.
  hireDate: Date | null
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
    const hireDates = rs.map((r) => r.hireDate).filter((d): d is Date => !!d)
    return {
      id: latest.id,
      name: [latest.firstName, latest.lastName].filter(Boolean).join(' '),
      latest,
      records: rs,
      hireDate: hireDates.length ? new Date(Math.min(...hireDates.map((d) => d.getTime()))) : null,
    }
  })
}

export async function getStaffPeople(): Promise<StaffPerson[]> {
  return toPeople(await loadRecords())
}

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
