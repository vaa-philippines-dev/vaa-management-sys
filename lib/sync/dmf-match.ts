import { prisma } from '@/lib/prisma'

// Name-matching for the DMF import. The sheet has no internal ID that maps
// onto anything in this app (VA ID like "20-0002" matches no field; only 9
// of 2,026 VAs even have an employeeId, in a different format entirely) —
// so VA NAME is the only usable join key, checked against 292 unique sheet
// names vs. 699 Amazon VAs before building this: 271 exact matches (93%).
// The rest are intentionally left unmatched rather than fuzzy-guessed.

export function normalizeName(raw: string | undefined | null): string {
  return (raw ?? '')
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// Maps a normalized name to every id that has it — a length > 1 means the
// name is ambiguous within this index and must not be auto-matched.
export type NameIndex = Map<string, string[]>

function addToIndex(index: NameIndex, key: string, id: string) {
  if (!key) return
  const existing = index.get(key)
  if (existing) existing.push(id)
  else index.set(key, [id])
}

export type MatchResult = { id: string | null; ambiguous: boolean }

export function matchName(index: NameIndex, rawName: string | undefined | null): MatchResult {
  const key = normalizeName(rawName)
  if (!key) return { id: null, ambiguous: false }
  const ids = index.get(key)
  if (!ids || ids.length === 0) return { id: null, ambiguous: false }
  if (ids.length > 1) return { id: null, ambiguous: true }
  return { id: ids[0], ambiguous: false }
}

export type DmfIndexes = {
  vaByName: NameIndex // VAProfile.id, scoped to VIRTUAL_ASSISTANT in the department
  staffByFullName: NameIndex // User.id, any type, department member
  staffByFirstName: NameIndex // same Users, keyed by first name alone — for
  // PERSON IN-CHARGE / SHADOW TRAINER columns, which the sheet records as a
  // bare first name; only useful where that first name is unique in-dept
  clientByName: NameIndex // Client.id, scoped to the department
  assignmentsByVaAndClient: Map<string, { id: string; startDate: Date }[]>
}

export async function buildDmfIndexes(departmentId: string): Promise<DmfIndexes> {
  const [vas, memberships, clients, assignments] = await Promise.all([
    prisma.vAProfile.findMany({
      where: { user: { memberships: { some: { departmentId, endedAt: null } }, userType: 'VIRTUAL_ASSISTANT' } },
      select: { id: true, user: { select: { firstName: true, lastName: true } } },
    }),
    prisma.departmentMembership.findMany({
      where: { departmentId, endedAt: null },
      select: { user: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.client.findMany({
      where: { departmentId },
      select: { id: true, name: true },
    }),
    prisma.assignment.findMany({
      where: { client: { departmentId } },
      select: { id: true, startDate: true, vaProfileId: true, clientId: true },
    }),
  ])

  const vaByName: NameIndex = new Map()
  for (const v of vas) addToIndex(vaByName, normalizeName(`${v.user.firstName} ${v.user.lastName}`), v.id)

  const staffByFullName: NameIndex = new Map()
  const staffByFirstName: NameIndex = new Map()
  for (const m of memberships) {
    addToIndex(staffByFullName, normalizeName(`${m.user.firstName} ${m.user.lastName}`), m.user.id)
    addToIndex(staffByFirstName, normalizeName(m.user.firstName), m.user.id)
  }

  const clientByName: NameIndex = new Map()
  for (const c of clients) addToIndex(clientByName, normalizeName(c.name), c.id)

  const assignmentsByVaAndClient = new Map<string, { id: string; startDate: Date }[]>()
  for (const a of assignments) {
    const key = `${a.vaProfileId}:${a.clientId}`
    const existing = assignmentsByVaAndClient.get(key)
    const entry = { id: a.id, startDate: a.startDate }
    if (existing) existing.push(entry)
    else assignmentsByVaAndClient.set(key, [entry])
  }

  return { vaByName, staffByFullName, staffByFirstName, clientByName, assignmentsByVaAndClient }
}

// A VA can have re-engaged with the same client (a real, if rare, case),
// which is why the sheet's own RECORD NO exists — this app doesn't have
// that key, so ties are broken by whichever Assignment's startDate is
// closest to the sheet's own start date for that row.
export function pickAssignment(
  candidates: { id: string; startDate: Date }[] | undefined,
  targetDate: Date | null
): string | null {
  if (!candidates || candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0].id
  if (!targetDate) return null // genuinely ambiguous without a date to break the tie

  let best = candidates[0]
  let bestDiff = Math.abs(best.startDate.getTime() - targetDate.getTime())
  for (const c of candidates.slice(1)) {
    const diff = Math.abs(c.startDate.getTime() - targetDate.getTime())
    if (diff < bestDiff) {
      best = c
      bestDiff = diff
    }
  }
  return best.id
}
