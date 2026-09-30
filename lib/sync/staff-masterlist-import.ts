import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { parseDmfBool, parseDmfDate } from '@/lib/sync/dmf-parse'

// One-time backfill of the "VAA | STAFF MASTERLIST" sheet (exported as CSV)
// into staff_records, plus the account changes that make these people
// internal staff. Dry run by default: plan() only reads.
//
// Matching is by person, not row — a promotion or transfer gives the same
// person several rows. Work emails are NOT a person key on their own: many are
// role mailboxes (amazondept@, hrm@, ppc@) handed from one person to the next,
// so an email hit only counts when the account's first name agrees too. The
// same goes for personal emails: the sheet has copy-paste errors where a row
// carries the previous person's personal email.
//
// Account rules (per the person's latest row):
//   - Team Leaders keep their VA account untouched — they work as VAs too.
//   - A matched VA account whose latest row is ACTIVE/ON HOLD becomes
//     INTERNAL_STAFF; its SystemRole goes VA → STAFF (an elevated role such as
//     DEPT_MANAGER is kept).
//   - Departed staff (RESIGNED, REMOVED, ...) are linked but not converted.
//   - An unmatched person who is still active gets a new STAFF account.
//   - Everyone else only gets their staff_records rows.

const SYSTEM_ACTOR_EMAIL = 'staff-masterlist-import@system.internal'
const HEADER_ROW_INDEX = 2 // 0-based: two banner rows sit above the header
const ACTIVE_STATUSES = new Set(['ACTIVE', 'ON HOLD'])
const NULL_VALUES = new Set(['', 'no email entered.', '#ref!', '#n/a', '-'])

export type StaffRow = {
  sheetRow: number
  staffId: string | null
  hireDate: Date | null
  startDate: Date | null
  department: string | null
  subdepartment: string | null
  // FULL NAME column, the grouping key — FIRST/LAST NAME are derived columns
  // in the sheet and occasionally wrong (one holds an unevaluated =AI() formula).
  fullName: string
  firstName: string
  lastName: string | null
  position: string | null
  level: string | null
  workEmail: string | null
  personalEmail: string | null
  whatsapp: string | null
  gcash: string | null
  emergencyContact: string | null
  address: string | null
  birthDate: Date | null
  remarks: string | null
  generalStatus: string | null
  statusDate: Date | null
  employmentStatus: string | null
  eocDate: Date | null
  nonCelebrant: boolean
}

type MatchedUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  userType: 'INTERNAL_STAFF' | 'VIRTUAL_ASSISTANT'
  systemRole: string
  activeAssignments: number
}

export type PersonAction =
  | { kind: 'link'; user: MatchedUser; reason: string }
  | { kind: 'convert'; user: MatchedUser; newRole: string }
  | { kind: 'create'; email: string }
  | { kind: 'record-only'; reason: string }

export type PersonPlan = {
  key: string
  name: string
  rows: StaffRow[]
  latest: StaffRow
  matchedBy: string | null
  action: PersonAction
}

export type StaffImportPlan = {
  rows: StaffRow[]
  people: PersonPlan[]
  ambiguous: { name: string; reason: string }[]
  warnings: { name: string; reason: string }[]
}

// RFC 4180: quoted fields may hold commas, doubled quotes and newlines (the
// header's "STATUS\nDATE" cell does).
export function parseCsv(text: string): string[][] {
  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { record.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      record.push(field); records.push(record); record = []; field = ''
    } else field += ch
  }
  if (field || record.length) { record.push(field); records.push(record) }
  return records
}

function clean(raw: string | undefined): string | null {
  const v = (raw ?? '').replace(/\s+/g, ' ').trim()
  return NULL_VALUES.has(v.toLowerCase()) ? null : v
}

const cleanEmail = (raw: string | undefined) => {
  const v = clean(raw)?.toLowerCase() ?? null
  return v && v.includes('@') ? v : null
}

const normName = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim()
const nameKey = (first: string, last: string | null) => normName(`${first} ${last ?? ''}`)
const firstToken = (name: string) => normName(name).split(' ')[0]

export function parseStaffCsv(text: string): StaffRow[] {
  const records = parseCsv(text)
  const header = records[HEADER_ROW_INDEX]?.map((h) => h.replace(/\s+/g, ' ').trim().toUpperCase()) ?? []
  const col = (name: string, nth = 0) => {
    const hits = header.map((h, i) => (h === name ? i : -1)).filter((i) => i >= 0)
    if (hits[nth] === undefined) throw new Error(`Column "${name}" not found in the CSV header`)
    return hits[nth]
  }
  const c = {
    staffId: col('STAFF ID'), hireDate: col('VAA HIRE DATE'), startDate: col('START DATE'),
    department: col('DEPARTMENT'), subdepartment: col('SUBDEPARTMENT'), fullName: col('FULL NAME'),
    firstName: col('FIRST NAME'), lastName: col('LAST NAME'), position: col('VAA POSITION'), level: col('LEVEL'),
    workEmail: col('WORK EMAIL ADDRESS'), personalEmail: col('PERSONAL EMAIL ADDRESS'), whatsapp: col('WHATSAPP'),
    gcash: col('GCASH'), emergency: col('EMERGENCY CONTACT'), address: col('COMPLETE ADDRESS'), birthday: col('BIRTHDAY'),
    remarks1: col('REMARKS', 0), remarks2: col('REMARKS', 1), generalStatus: col('GENERAL STATUS'),
    statusDate: col('STATUS DATE'), employmentStatus: col('EMPLOYMENT STATUS'), eocDate: col('EOC DATE'),
    nonCelebrant: col('NON CELEBRANT'),
  }

  const rows: StaffRow[] = []
  records.forEach((r, i) => {
    if (i <= HEADER_ROW_INDEX) return
    // FIRST NAME is the only column every real row has; FULL NAME is blank on a few.
    const lastName = clean(r[c.lastName])
    const fullName = clean(r[c.fullName]) ?? [clean(r[c.firstName]), lastName].filter(Boolean).join(' ')
    let firstName = clean(r[c.firstName])
    if (firstName?.startsWith('=')) {
      firstName = lastName && fullName.endsWith(` ${lastName}`) ? fullName.slice(0, -lastName.length - 1) : fullName
    }
    if (!firstName || !fullName) return
    rows.push({
      sheetRow: i + 1,
      staffId: clean(r[c.staffId]),
      hireDate: parseDmfDate(r[c.hireDate]),
      startDate: parseDmfDate(r[c.startDate]),
      department: clean(r[c.department]),
      subdepartment: clean(r[c.subdepartment]),
      fullName,
      firstName,
      lastName,
      position: clean(r[c.position]),
      level: clean(r[c.level]),
      workEmail: cleanEmail(r[c.workEmail]),
      personalEmail: cleanEmail(r[c.personalEmail]),
      whatsapp: clean(r[c.whatsapp]),
      gcash: clean(r[c.gcash]),
      emergencyContact: clean(r[c.emergency]),
      address: clean(r[c.address]),
      birthDate: parseDmfDate(r[c.birthday]),
      remarks: [clean(r[c.remarks1]), clean(r[c.remarks2])].filter(Boolean).join(' | ') || null,
      generalStatus: clean(r[c.generalStatus])?.toUpperCase() ?? null,
      statusDate: parseDmfDate(r[c.statusDate]),
      employmentStatus: clean(r[c.employmentStatus])?.toUpperCase() ?? null,
      eocDate: parseDmfDate(r[c.eocDate]),
      nonCelebrant: parseDmfBool(r[c.nonCelebrant]),
    })
  })
  return rows
}

const isTeamLeader = (row: StaffRow) => /team leader/i.test(row.position ?? '')
const isActiveRow = (row: StaffRow) => ACTIVE_STATUSES.has(row.generalStatus ?? '')

export async function planStaffImport(rows: StaffRow[]): Promise<StaffImportPlan> {
  const ambiguous: StaffImportPlan['ambiguous'] = []
  const warnings: StaffImportPlan['warnings'] = []

  const users = await prisma.user.findMany({
    where: { isBot: false },
    select: {
      id: true, email: true, firstName: true, lastName: true, userType: true, systemRole: true,
      profile: { select: { personalEmail: true, workEmail: true } },
      vaProfile: { select: { _count: { select: { assignments: { where: { status: 'ACTIVE' } } } } } },
    },
  })
  const toMatched = (u: (typeof users)[number]): MatchedUser => ({
    id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName,
    userType: u.userType, systemRole: u.systemRole,
    activeAssignments: u.vaProfile?._count.assignments ?? 0,
  })

  const index = (keys: (u: (typeof users)[number]) => (string | null | undefined)[]) => {
    const map = new Map<string, Set<(typeof users)[number]>>()
    for (const u of users) for (const k of keys(u)) {
      const key = k?.toLowerCase().trim()
      if (key) map.set(key, (map.get(key) ?? new Set()).add(u))
    }
    return map
  }
  const byEmail = index((u) => [u.email, u.profile?.personalEmail, u.profile?.workEmail])
  const byName = index((u) => [nameKey(u.firstName, u.lastName)])

  // Group rows into people by name; the latest row decides what happens to the account.
  const groups = new Map<string, StaffRow[]>()
  for (const r of rows) {
    const key = normName(r.fullName)
    groups.set(key, [...(groups.get(key) ?? []), r])
  }

  const people: PersonPlan[] = []
  const claimed = new Map<string, string[]>() // userId → person keys that matched it
  // Any email already on an account (login, personal or work) is off-limits
  // for a new login.
  const usedEmails = new Set(
    users.flatMap((u) => [u.email, u.profile?.personalEmail, u.profile?.workEmail]).filter(Boolean).map((e) => e!.toLowerCase())
  )

  for (const [key, personRows] of groups) {
    const latest = [...personRows].sort(
      (a, b) => (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0) || b.sheetRow - a.sheetRow
    )[0]
    const name = latest.fullName
    const personalEmails = [...new Set(personRows.map((r) => r.personalEmail).filter(Boolean) as string[])]
    const workEmails = [...new Set(personRows.map((r) => r.workEmail).filter(Boolean) as string[])]

    let hit: (typeof users)[number] | null = null
    let matchedBy: string | null = null
    const tryMatch = (label: string, candidates: Set<(typeof users)[number]> | undefined, requireName = false) => {
      if (hit || !candidates?.size) return
      const pool = requireName
        ? [...candidates].filter((u) => firstToken(u.firstName) === firstToken(latest.firstName))
        : [...candidates]
      if (pool.length === 1) { hit = pool[0]; matchedBy = label }
      else if (pool.length > 1) ambiguous.push({ name, reason: `${label} matches ${pool.length} accounts: ${pool.map((u) => u.email).join(', ')}` })
    }
    tryMatch('exact name', byName.get(key))
    tryMatch('exact name', byName.get(nameKey(latest.firstName, latest.lastName)))
    for (const e of personalEmails) tryMatch(`personal email ${e} + first name`, byEmail.get(e), true)
    for (const e of workEmails) tryMatch(`work email ${e} + first name`, byEmail.get(e), true)

    let action: PersonAction
    if (hit) {
      const u = toMatched(hit)
      claimed.set(u.id, [...(claimed.get(u.id) ?? []), key])
      if (u.userType === 'INTERNAL_STAFF') action = { kind: 'link', user: u, reason: 'already internal staff' }
      else if (isTeamLeader(latest)) action = { kind: 'link', user: u, reason: 'Team Leader — keeps VA account' }
      else if (!isActiveRow(latest)) action = { kind: 'link', user: u, reason: `latest status ${latest.generalStatus ?? 'blank'} — not converted` }
      else {
        action = { kind: 'convert', user: u, newRole: u.systemRole === 'VA' ? 'STAFF' : u.systemRole }
        if (u.activeAssignments > 0) {
          warnings.push({ name, reason: `${u.email} has ${u.activeAssignments} active VA assignment(s) and will leave the VA Masterlist` })
        }
      }
    } else if (isActiveRow(latest)) {
      // Personal email first. Either kind is skipped when another person's row
      // carries it too — a role mailbox, or a copy-paste error in the sheet.
      const sharedWithOthers = (e: string) =>
        rows.some((r) => (r.workEmail === e || r.personalEmail === e) && normName(r.fullName) !== key)
      const email = [...personalEmails, ...workEmails].find((e) => !sharedWithOthers(e) && !usedEmails.has(e))
      if (email) {
        usedEmails.add(email)
        action = { kind: 'create', email }
      } else action = { kind: 'record-only', reason: 'active, but no unused personal or unshared work email to log in with' }
    } else action = { kind: 'record-only', reason: `no account, latest status ${latest.generalStatus ?? 'blank'}` }

    people.push({ key, name, rows: personRows, latest, matchedBy, action })
  }

  // Two people resolving to one account: the one whose name is the account's
  // keeps it. If none (or several) do, nobody gets it — a guess would hand one
  // person's login to another.
  for (const [userId, keys] of claimed) {
    if (keys.length < 2) continue
    const account = users.find((u) => u.id === userId)!
    const contenders = people.filter((p) => keys.includes(p.key))
    const owners = contenders.filter((p) => p.key === nameKey(account.firstName, account.lastName))
    for (const p of contenders) {
      if (owners.length === 1 && owners[0] === p) continue
      ambiguous.push({ name: p.name, reason: `matched ${account.email} (${account.firstName} ${account.lastName}), which is someone else's account — not linked` })
      p.action = { kind: 'record-only', reason: 'matched an account that belongs to someone else' }
      p.matchedBy = null
    }
  }

  return { rows, people, ambiguous, warnings }
}

async function getSystemActorId(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: SYSTEM_ACTOR_EMAIL },
    update: {},
    create: {
      email: SYSTEM_ACTOR_EMAIL,
      firstName: 'Staff Masterlist',
      lastName: 'Import',
      systemRole: 'SYSTEM_ADMIN',
      userType: 'INTERNAL_STAFF',
      isActive: false,
    },
  })
  return user.id
}

const recordData = (r: StaffRow, userId: string | null) => ({
  userId,
  staffId: r.staffId,
  hireDate: r.hireDate,
  startDate: r.startDate,
  department: r.department,
  subdepartment: r.subdepartment,
  firstName: r.firstName,
  lastName: r.lastName,
  position: r.position,
  level: r.level,
  workEmail: r.workEmail,
  personalEmail: r.personalEmail,
  whatsapp: r.whatsapp,
  gcash: r.gcash,
  emergencyContact: r.emergencyContact,
  address: r.address,
  birthDate: r.birthDate,
  remarks: r.remarks,
  generalStatus: r.generalStatus,
  statusDate: r.statusDate,
  employmentStatus: r.employmentStatus,
  eocDate: r.eocDate,
  nonCelebrant: r.nonCelebrant,
})

// Re-runnable: staff_records are upserted by sheet row, conversions are
// no-ops once applied, and creates skip emails that already exist.
export async function applyStaffImport(plan: StaffImportPlan): Promise<void> {
  const actorId = await getSystemActorId()

  for (const p of plan.people) {
    let userId: string | null = null
    const a = p.action

    if (a.kind === 'link') userId = a.user.id
    else if (a.kind === 'convert') {
      userId = a.user.id
      await prisma.user.update({
        where: { id: a.user.id },
        data: { userType: 'INTERNAL_STAFF', systemRole: a.newRole as 'STAFF' },
      })
      await logAudit({
        actorId,
        action: 'ROLE_CHANGE',
        entityType: 'User',
        entityId: a.user.id,
        before: { userType: a.user.userType, systemRole: a.user.systemRole },
        after: { userType: 'INTERNAL_STAFF', systemRole: a.newRole },
        metadata: { source: 'staff_masterlist_import' },
      })
    } else if (a.kind === 'create') {
      const existing = await prisma.user.findUnique({ where: { email: a.email }, select: { id: true } })
      if (existing) userId = existing.id
      else {
        const r = p.latest
        const created = await prisma.user.create({
          data: {
            email: a.email,
            firstName: r.firstName,
            lastName: r.lastName ?? '',
            userType: 'INTERNAL_STAFF',
            systemRole: 'STAFF',
            profile: {
              create: {
                personalEmail: r.personalEmail,
                workEmail: r.workEmail,
                whatsappNumber: r.whatsapp,
                gcashNumber: r.gcash,
                address: r.address,
                birthDate: r.birthDate,
                nonCelebrant: r.nonCelebrant,
              },
            },
          },
          select: { id: true },
        })
        userId = created.id
        await logAudit({
          actorId,
          action: 'CREATE',
          entityType: 'User',
          entityId: created.id,
          after: { email: a.email, userType: 'INTERNAL_STAFF', systemRole: 'STAFF' },
          metadata: { source: 'staff_masterlist_import' },
        })
      }
    }

    for (const r of p.rows) {
      await prisma.staffRecord.upsert({
        where: { sheetRow: r.sheetRow },
        create: { sheetRow: r.sheetRow, ...recordData(r, userId) },
        update: recordData(r, userId),
      })
    }
  }
}
