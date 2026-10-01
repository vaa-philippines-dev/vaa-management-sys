// Incremental update from an HR "VA MASTERLIST" CSV export into the VA
// Masterlist (/vas): creates VAs hired since --since, and brings existing VAs
// with activity since then (new hires, transfers, resignations/removals) up
// to date — status, engagement, hire/end dates, department membership and
// per-episode EmploymentRecords.
//
// Usage (see scripts/import-dmf.ts for why --env-file rather than dotenv):
//   npx tsx --env-file=.env.local scripts/import-masterlist.ts --file <csv> [--since 2026-06-01]          (dry run)
//   npx tsx --env-file=.env.local scripts/import-masterlist.ts --file <csv> [--since 2026-06-01] --apply  (writes)
//
// Why not the in-app "Import CSV" modal: the masterlist export has a
// two-row header whose names don't match the modal's, dates in "2026 Jun 01"
// form (native Date parsing shifts those a day east of UTC — see
// lib/sync/dmf-parse.ts), and the modal doesn't end the old department
// membership on a transfer.
//
// Scope: a person is touched only if one of their rows has a HIRE DATE,
// EOC TRANSFER DATE or STATUS DATE on/after --since. For those people every
// row (full history) is reconciled, so the transfer out of the old
// department and the hire into the new one land together. Existing profile
// details (address, phones, links, position) are only filled where the app
// has nothing — edits made in-app since the last import are never
// overwritten. Names of existing users are left alone.
import { readFileSync } from 'node:fs'
import { prisma } from '@/lib/prisma'
import { parseDmfDate } from '@/lib/sync/dmf-parse'
import { normalizeGcash } from '@/lib/phone'
import type { EmploymentStatus, GeneralStatus } from '@/src/generated/prisma/enums'

const SYSTEM_ACTOR_EMAIL = 'masterlist-import@system.internal'
const IMPORT_TAG = 'masterlist-csv'
const DAY_MS = 24 * 60 * 60 * 1000

const GENERAL_STATUSES: GeneralStatus[] = ['ACTIVE', 'PENDING', 'TRANSFERRED', 'RESIGNED', 'REMOVED', 'PROJECT_ENDED', 'CANCELLED', 'BLACKLISTED']
const TERMINAL_STATUSES: GeneralStatus[] = ['RESIGNED', 'REMOVED', 'PROJECT_ENDED', 'CANCELLED', 'BLACKLISTED']
// The sheet's EMPLOYMENT STATUS vocabulary → the app's. "EMPLOYED" is
// stored as ENGAGED, matching every VA the earlier CSV import created.
const ENGAGEMENT_MAP: Record<string, EmploymentStatus> = {
  EMPLOYED: 'ENGAGED',
  END_OF_CONTRACT: 'END_OF_CONTRACT',
  TRANSFERRED: 'TRANSFERRED',
  RESIGNED: 'RESIGNED',
  TERMINATED: 'TERMINATED',
  BLACKLISTED: 'BLACKLISTED',
}
// Sheet filler for "unknown" — importing these would look like real data.
const PLACEHOLDERS = new Set(['0900-0000-000', '(+63) 900-0000-000', 'facebook', 'https://www.facebook.com/', 'n/a', '-'])

// ── CSV ──────────────────────────────────────────────────────────────

function parseCsvRecords(text: string): string[][] {
  const records: string[][] = []
  let cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else cur += ch
      continue
    }
    if (ch === '"') inQuotes = true
    else if (ch === ',') { cells.push(cur); cur = '' }
    else if (ch === '\n') { cells.push(cur); records.push(cells); cells = []; cur = '' }
    else if (ch !== '\r') cur += ch
  }
  if (cur || cells.length) { cells.push(cur); records.push(cells) }
  return records
}

type MRow = {
  line: number
  vaId: string
  fullName: string
  firstName: string
  lastName: string
  department: string
  position: string
  workEmail: string
  personalEmail: string
  generalStatusRaw: string
  generalStatus: GeneralStatus | null
  onHold: boolean
  engagement: EmploymentStatus | null
  statusDate: Date | null
  hire: Date | null
  eoc: Date | null
  gender: string
  whatsapp: string
  gcash: string
  birthday: Date | null
  nonCelebrant: boolean
  address: string
  emergencyName: string
  emergencyPhone: string
  emergencyRelation: string
  facebook: string
  linkedin: string
  passport: string
  preferredHours: number | null
  availableSchedule: string
  barangay: string
  city: string
  province: string
}

function readMasterlist(path: string): MRow[] {
  const records = parseCsvRecords(readFileSync(path, 'utf8'))
  const headerIdx = records.findIndex((r) => r.some((c) => c.trim() === 'FULL NAME'))
  if (headerIdx === -1) throw new Error('No "FULL NAME" header row found — is this the MASTERLIST tab export?')
  const header = records[headerIdx].map((h) => h.trim())
  const col = (name: string) => {
    const i = header.indexOf(name)
    if (i === -1) throw new Error(`Missing column "${name}"`)
    return i
  }
  const optCol = (name: string) => header.indexOf(name)
  const C = {
    vaId: col('VA ID'), full: col('FULL NAME'), last: col('LAST NAME'), first: col('FIRST NAME'),
    dept: col('DEPARTMENT'), position: col('POSITION'), work: col('WORK EMAIL ADDRESS'), personal: col('PERSONAL EMAIL ADDRESS'),
    gs: col('GENERAL STATUS'), es: col('EMPLOYMENT STATUS'), sd: col('STATUS DATE'), hire: col('HIRE DATE'), eoc: col('EOC TRANSFER DATE'),
    gender: col('GENDER'), whatsapp: col('WHATSAPP'), gcash: col('GCASH'), birthday: col('BIRTHDAY'), nonCelebrant: col('NON CELEBRANT'),
    address: col('COMPLETE ADDRESS'), ecName: col('EMERGENCY CONTACT NAME'), ecPhone: col('EMERGENCY CONTACT NUMBER'),
    // The relation has no header of its own in the export ("Column 54").
    ecRel: optCol('Column 54'), facebook: col('FACEBOOK'), linkedin: col('LINKEDIN'), passport: col('PASSPORT NUMBER'),
    pwh: col('PREFERRED WORK HOURS'), sched: col('AVAILABLE SCHEDULE'),
    brgy: col('BARANGAY'), city: col('CITY/MUNICIPALITY'), province: col('PROVINCE'),
  }
  const rows: MRow[] = []
  records.slice(headerIdx + 1).forEach((cells, i) => {
    // Spreadsheet error values (#REF!, #N/A, #NUM!) are blanks, not data.
    const get = (idx: number) => {
      const v = idx >= 0 ? (cells[idx] ?? '').trim() : ''
      return v.startsWith('#') ? '' : v
    }
    const clean = (idx: number) => {
      const v = get(idx)
      return PLACEHOLDERS.has(v.toLowerCase()) ? '' : v
    }
    if (!get(C.full)) return
    const gsRaw = get(C.gs).toUpperCase().replace(/\s+/g, ' ')
    const gsKey = gsRaw.replace(/[\s-]+/g, '_') as GeneralStatus
    const esKey = get(C.es).toUpperCase().replace(/[\s-]+/g, '_')
    const pwh = Number(get(C.pwh))
    rows.push({
      line: headerIdx + 2 + i,
      vaId: get(C.vaId),
      fullName: get(C.full),
      firstName: get(C.first) || get(C.full).split(' ')[0],
      lastName: get(C.last) || '-',
      department: get(C.dept),
      position: get(C.position),
      workEmail: get(C.work).toLowerCase(),
      personalEmail: get(C.personal).toLowerCase(),
      generalStatusRaw: gsRaw,
      generalStatus: GENERAL_STATUSES.includes(gsKey) ? gsKey : null,
      onHold: gsRaw === 'ON HOLD' || gsRaw === 'HR - ON HOLD',
      engagement: ENGAGEMENT_MAP[esKey] ?? null,
      statusDate: parseDmfDate(get(C.sd)),
      hire: parseDmfDate(get(C.hire)),
      eoc: parseDmfDate(get(C.eoc)),
      gender: get(C.gender),
      whatsapp: clean(C.whatsapp),
      gcash: clean(C.gcash),
      birthday: parseDmfDate(get(C.birthday)),
      nonCelebrant: get(C.nonCelebrant).toUpperCase() === 'TRUE',
      address: get(C.address),
      emergencyName: get(C.ecName),
      emergencyPhone: clean(C.ecPhone),
      emergencyRelation: get(C.ecRel),
      facebook: clean(C.facebook),
      linkedin: clean(C.linkedin),
      passport: get(C.passport),
      preferredHours: get(C.pwh) && Number.isFinite(pwh) ? pwh : null,
      availableSchedule: get(C.sched),
      barangay: get(C.brgy),
      city: get(C.city),
      province: get(C.province),
    })
  })
  return rows
}

// "127, Mamatid, Cabuyao, Laguna, 4025" + barangay/city/province columns →
// addressLine "127", zip "4025" — the same split the earlier import stored.
function splitAddress(r: MRow): { addressLine: string | null; zipCode: string | null } {
  const parts = r.address.split(',').map((p) => p.trim()).filter(Boolean)
  let zipCode: string | null = null
  if (parts.length && /^\d{4}$/.test(parts[parts.length - 1])) zipCode = parts.pop()!
  const known = [r.barangay, r.city, r.province].filter(Boolean).map((s) => s.toLowerCase())
  while (known.length && parts.length && known.includes(parts[parts.length - 1].toLowerCase())) parts.pop()
  return { addressLine: parts.join(', ') || null, zipCode }
}

// End of a row's episode: the EOC/transfer date, else — for a resigned/
// removed/blacklisted row, whose EOC cell HR usually leaves blank — the
// STATUS DATE the status changed on.
function rowEnd(r: MRow): Date | null {
  if (r.eoc) return r.eoc
  if (r.generalStatus && TERMINAL_STATUSES.includes(r.generalStatus)) return r.statusDate
  return null
}

// Dates written by the earlier import are local (UTC+8) midnight, i.e.
// 16:00Z the previous day; treat anything within 36h as the same day so
// those aren't "corrected" or duplicated.
const sameDay = (a: Date | null | undefined, b: Date | null | undefined) =>
  !a || !b ? a == b : Math.abs(a.getTime() - b.getTime()) <= 1.5 * DAY_MS
const fmt = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '—')
const normName = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
const normDept = (s: string) => s.trim().toLowerCase().replace(/\s+department$/, '').trim()

// ── main ─────────────────────────────────────────────────────────────

type Report = { creates: string[]; updates: string[]; unchanged: number; warnings: string[]; skipped: string[] }

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const fileIdx = args.indexOf('--file')
  const sinceIdx = args.indexOf('--since')
  const file = fileIdx >= 0 ? args[fileIdx + 1] : null
  const since = new Date(`${sinceIdx >= 0 ? args[sinceIdx + 1] : '2026-06-01'}T00:00:00Z`)
  if (!file || Number.isNaN(since.getTime())) {
    console.error('Usage: npx tsx --env-file=.env.local scripts/import-masterlist.ts --file <csv> [--since YYYY-MM-DD] [--apply]')
    process.exit(1)
  }

  const rows = readMasterlist(file)
  console.log(`${apply ? 'APPLYING' : 'DRY RUN'} — ${rows.length} masterlist rows, activity since ${fmt(since)}`)

  const [users, departments, skills] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true, email: true, firstName: true, lastName: true, middleName: true,
        profile: { select: { personalEmail: true, workEmail: true } },
      },
    }),
    prisma.department.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true } }),
    prisma.skill.findMany({ select: { id: true, name: true, shortName: true } }),
  ])

  const deptByName = new Map(departments.map((d) => [normDept(d.name), d]))
  const deptName = new Map(departments.map((d) => [d.id, d.name]))
  const skillByText = new Map<string, string>()
  for (const s of skills) {
    skillByText.set(s.name.trim().toLowerCase(), s.id)
    if (s.shortName) skillByText.set(s.shortName.trim().toLowerCase(), s.id)
  }

  // Email → user ids (a user's login, personal and work email all count);
  // name → user ids. More than one id behind a key means "don't guess".
  const idsByEmail = new Map<string, Set<string>>()
  const idsByName = new Map<string, Set<string>>()
  const add = (m: Map<string, Set<string>>, k: string | null | undefined, id: string) => {
    if (!k) return
    const key = k.trim().toLowerCase()
    if (!key) return
    if (!m.has(key)) m.set(key, new Set())
    m.get(key)!.add(id)
  }
  for (const u of users) {
    add(idsByEmail, u.email, u.id)
    add(idsByEmail, u.profile?.personalEmail, u.id)
    add(idsByEmail, u.profile?.workEmail, u.id)
    add(idsByName, normName(`${u.firstName} ${u.lastName}`), u.id)
    if (u.middleName) add(idsByName, normName(`${u.firstName} ${u.middleName} ${u.lastName}`), u.id)
  }

  const report: Report = { creates: [], updates: [], unchanged: 0, warnings: [], skipped: [] }

  // Group rows into people: matched user id first, else email, else name.
  // A row whose person can't be pinned down lands in a `blocked` group —
  // reported only if that person is actually in scope.
  const loginIdByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]))
  const groups = new Map<string, { userId: string | null; rows: MRow[]; matchedBy: string; blocked?: string }>()
  for (const r of rows) {
    const emailIds = new Set<string>()
    for (const e of [r.workEmail, r.personalEmail]) idsByEmail.get(e)?.forEach((id) => emailIds.add(id))
    let userId: string | null = null
    let matchedBy = 'new'
    let blocked: string | undefined
    if (emailIds.size > 1) {
      // Duplicate accounts from an earlier import (one keyed on the work
      // email, one on the personal email): the row belongs to the account
      // whose login is the email this row would log in with.
      const login = loginIdByEmail.get(r.workEmail || r.personalEmail)
      if (login) {
        userId = login
        matchedBy = 'email'
        report.warnings.push(`${r.fullName} (line ${r.line}): its emails belong to ${emailIds.size} separate accounts (duplicate) — used ${r.workEmail || r.personalEmail}`)
      } else {
        blocked = `emails belong to ${emailIds.size} different users`
      }
    } else if (emailIds.size === 1) {
      userId = [...emailIds][0]
      matchedBy = 'email'
    } else {
      const nameIds = idsByName.get(normName(`${r.firstName} ${r.lastName}`)) ?? idsByName.get(normName(r.fullName))
      if (nameIds && nameIds.size > 1) blocked = `name matches ${nameIds.size} users and no email matches`
      else if (nameIds?.size === 1) {
        userId = [...nameIds][0]
        matchedBy = 'name'
      }
    }
    const key = blocked
      ? `x:${r.line}`
      : userId ? `u:${userId}` : r.workEmail || r.personalEmail ? `e:${r.workEmail || r.personalEmail}` : `n:${normName(r.fullName)}`
    const g = groups.get(key) ?? { userId, rows: [], matchedBy, blocked }
    g.rows.push(r)
    if (matchedBy === 'name' && g.matchedBy !== 'email') g.matchedBy = 'name'
    groups.set(key, g)
  }

  const inScope = [...groups.values()].filter((g) =>
    g.rows.some((r) => [r.hire, r.eoc, r.statusDate].some((d) => d && d >= since)),
  )
  const touched = inScope.filter((g) => !g.blocked)
  for (const g of inScope) if (g.blocked) report.skipped.push(`line ${g.rows[0].line} ${g.rows[0].fullName}: ${g.blocked}`)
  // Only keep duplicate-account warnings for people in scope.
  const inScopeLines = new Set(touched.flatMap((g) => g.rows.map((r) => `(line ${r.line})`)))
  report.warnings = report.warnings.filter((w) => [...inScopeLines].some((l) => w.includes(l)))
  console.log(`${touched.length} people with activity since ${fmt(since)}`)

  const actorId = apply ? await getSystemActorId() : 'dry-run'

  for (const g of touched) {
    // Oldest → newest by hire date; the newest row is the current state.
    const sorted = [...g.rows].sort((a, b) => (a.hire?.getTime() ?? -Infinity) - (b.hire?.getTime() ?? -Infinity))
    const latest = sorted[sorted.length - 1]
    const label = `${latest.fullName} [${latest.vaId}]`

    for (const r of sorted) {
      if (r.department && !deptByName.has(normDept(r.department))) {
        report.warnings.push(`${label}: no department named "${r.department}" (line ${r.line}) — left without one`)
      }
      if (!r.generalStatus && !r.onHold && r.generalStatusRaw && r === latest) {
        report.warnings.push(`${label}: GENERAL STATUS "${r.generalStatusRaw}" isn't an app status — status left as is`)
      }
    }
    if (!latest.hire) {
      report.skipped.push(`${label}: no HIRE DATE on its latest row`)
      continue
    }

    try {
      if (g.userId) {
        const changes = await reconcileExisting(g.userId, sorted, { deptByName, deptName, skillByText, actorId, apply })
        if (changes.length) report.updates.push(`${label}${g.matchedBy === 'name' ? ' (matched by name)' : ''}\n      ${changes.join('\n      ')}`)
        else report.unchanged++
      } else {
        const line = await createNew(sorted, { deptByName, deptName, skillByText, actorId, apply })
        report.creates.push(`${label}: ${line}`)
      }
    } catch (e) {
      report.skipped.push(`${label}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  console.log(`\n=== New VAs (${report.creates.length}) ===`)
  report.creates.forEach((l) => console.log(`  + ${l}`))
  console.log(`\n=== Updated VAs (${report.updates.length}) ===`)
  report.updates.forEach((l) => console.log(`  ~ ${l}`))
  console.log(`\n=== Already up to date: ${report.unchanged} ===`)
  if (report.warnings.length) {
    console.log(`\n=== Warnings (${report.warnings.length}) ===`)
    report.warnings.forEach((l) => console.log(`  ! ${l}`))
  }
  if (report.skipped.length) {
    console.log(`\n=== Skipped (${report.skipped.length}) ===`)
    report.skipped.forEach((l) => console.log(`  x ${l}`))
  }
  if (!apply) console.log('\nDry run only — re-run with --apply to write.')
}

type Ctx = {
  deptByName: Map<string, { id: string; name: string }>
  deptName: Map<string, string>
  skillByText: Map<string, string>
  actorId: string
  apply: boolean
}

type Episode = { departmentId: string | null; status: EmploymentStatus; start: Date; end: Date | null }

function episodes(sorted: MRow[], ctx: Ctx): Episode[] {
  return sorted
    .filter((r) => r.hire)
    .map((r, i, all) => ({
      departmentId: ctx.deptByName.get(normDept(r.department))?.id ?? null,
      status: r.engagement ?? (i === all.length - 1 ? 'ENGAGED' : 'END_OF_CONTRACT'),
      start: r.hire!,
      end: rowEnd(r),
    }))
}

async function reconcileExisting(userId: string, sorted: MRow[], ctx: Ctx): Promise<string[]> {
  const latest = sorted[sorted.length - 1]
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      vaProfile: true,
      profile: true,
      memberships: { where: { endedAt: null } },
      employmentRecords: { orderBy: { startDate: 'asc' } },
    },
  })
  const va = user.vaProfile
  if (!va) throw new Error(`matched ${user.email}, which has no VA profile`)

  const changes: string[] = []
  const vaData: Record<string, unknown> = {}
  const history: { eventType: 'STATUS_CHANGE' | 'ENGAGEMENT_CHANGE' | 'DEPARTMENT_TRANSFER'; oldValue: string | null; newValue: string; departmentId?: string | null; effectiveDate: Date }[] = []
  const statusEffective = latest.statusDate ?? rowEnd(latest) ?? latest.hire!

  if (latest.generalStatus && latest.generalStatus !== va.status) {
    vaData.status = latest.generalStatus
    changes.push(`status ${va.status} → ${latest.generalStatus}`)
    history.push({ eventType: 'STATUS_CHANGE', oldValue: va.status, newValue: latest.generalStatus, effectiveDate: statusEffective })
  }
  // Only ever set, never clear: a hold flagged in-app is independent of
  // the sheet's status column.
  if (latest.onHold && !va.onHold) {
    vaData.onHold = true
    changes.push('on hold → true')
  }
  if (latest.engagement && latest.engagement !== va.engagementStatus) {
    vaData.engagementStatus = latest.engagement
    changes.push(`engagement ${va.engagementStatus ?? '—'} → ${latest.engagement}`)
    history.push({ eventType: 'ENGAGEMENT_CHANGE', oldValue: va.engagementStatus, newValue: latest.engagement, effectiveDate: statusEffective })
  }
  if (!sameDay(va.currentHireDate, latest.hire)) {
    vaData.currentHireDate = latest.hire
    changes.push(`hire date ${fmt(va.currentHireDate)} → ${fmt(latest.hire)}`)
  }
  const end = rowEnd(latest)
  if (end && !sameDay(va.currentEndDate, end)) {
    vaData.currentEndDate = end
    changes.push(`end date ${fmt(va.currentEndDate)} → ${fmt(end)}`)
  } else if (!end && va.currentEndDate && latest.hire! > va.currentEndDate) {
    // A new episode (re-hire/transfer) started after the recorded end.
    vaData.currentEndDate = null
    changes.push(`end date ${fmt(va.currentEndDate)} → — (new episode)`)
  }
  if (!va.vaaPosition && latest.position) {
    vaData.vaaPosition = latest.position
    vaData.positionSkillId = ctx.skillByText.get(latest.position.toLowerCase()) ?? null
    changes.push(`position → ${latest.position}`)
  }
  if (va.preferredWorkHours == null && latest.preferredHours != null) vaData.preferredWorkHours = latest.preferredHours

  // Profile: fill blanks only.
  const p = user.profile
  const { addressLine, zipCode } = splitAddress(latest)
  const candidate: Record<string, unknown> = {
    phone: latest.whatsapp || null,
    gcashNumber: latest.gcash ? normalizeGcash(latest.gcash) : null,
    gender: latest.gender || null,
    birthDate: latest.birthday,
    addressLine, zipCode,
    barangay: latest.barangay || null,
    cityMunicipality: latest.city || null,
    province: latest.province || null,
    personalEmail: latest.personalEmail || null,
    workEmail: latest.workEmail || null,
    emergencyContactName: latest.emergencyName || null,
    emergencyContactPhone: latest.emergencyPhone || null,
    emergencyContactRelation: latest.emergencyRelation || null,
    facebookUrl: latest.facebook || null,
    linkedinUrl: latest.linkedin || null,
    passportNumber: latest.passport || null,
  }
  const profileData: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(candidate)) {
    if (v != null && (p == null || (p as Record<string, unknown>)[k] == null)) profileData[k] = v
  }
  // A work email that changed (new department, new mailbox) is a real update.
  if (p?.workEmail && latest.workEmail && p.workEmail.toLowerCase() !== latest.workEmail) {
    profileData.workEmail = latest.workEmail
    changes.push(`work email ${p.workEmail} → ${latest.workEmail}`)
  }
  if (Object.keys(profileData).length) {
    const filled = Object.keys(profileData).filter((k) => k !== 'workEmail' || !p?.workEmail)
    if (filled.length) changes.push(`filled blank profile fields: ${filled.join(', ')}`)
  }

  // Department membership: the latest row's department should be an
  // active, primary membership. A move out of a department the sheet shows
  // this person leaving ends that membership, like transferVA() does.
  const targetDeptId = ctx.deptByName.get(normDept(latest.department))?.id ?? null
  const membershipOps: (() => Promise<unknown>)[] = []
  if (targetDeptId && !user.memberships.some((m) => m.departmentId === targetDeptId)) {
    const leftDeptIds = new Set(
      sorted.slice(0, -1).map((r) => ctx.deptByName.get(normDept(r.department))?.id).filter(Boolean) as string[],
    )
    const leaving = user.memberships.filter((m) => leftDeptIds.has(m.departmentId))
    const from = leaving.find((m) => m.isPrimary) ?? leaving[0] ?? null
    const oldNames = user.memberships.map((m) => ctx.deptName.get(m.departmentId) ?? '?').join(', ') || '—'
    changes.push(`department ${oldNames} → ${ctx.deptName.get(targetDeptId)}${leaving.length ? '' : ' (added)'}`)
    history.push({
      eventType: 'DEPARTMENT_TRANSFER',
      oldValue: from ? ctx.deptName.get(from.departmentId) ?? null : null,
      newValue: ctx.deptName.get(targetDeptId)!,
      departmentId: targetDeptId,
      effectiveDate: latest.hire!,
    })
    membershipOps.push(async () => {
      for (const m of leaving) {
        await prisma.departmentMembership.update({ where: { id: m.id }, data: { endedAt: latest.hire!, isPrimary: false } })
      }
      await prisma.departmentMembership.create({
        data: {
          userId, departmentId: targetDeptId, isPrimary: true, startedAt: latest.hire!,
          transferType: from ? 'ACTIVE' : null, transferredFromId: from?.id ?? null,
        },
      })
    })
  }

  // Employment history: one record per row, matched on (department, start
  // within a day). Exactly the newest episode is current.
  const eps = episodes(sorted, ctx)
  const existing = [...user.employmentRecords]
  const matchedIds = new Set<string>()
  const recordOps: (() => Promise<unknown>)[] = []
  eps.forEach((ep, i) => {
    const isCurrent = i === eps.length - 1
    const match = existing.find((r) => !matchedIds.has(r.id) && r.departmentId === ep.departmentId && sameDay(r.startDate, ep.start))
    const dn = ep.departmentId ? ctx.deptName.get(ep.departmentId) : 'no dept'
    if (match) {
      matchedIds.add(match.id)
      const data: Record<string, unknown> = {}
      if (match.employmentStatus !== ep.status) data.employmentStatus = ep.status
      if (ep.end && !sameDay(match.endDate, ep.end)) data.endDate = ep.end
      if (match.isCurrent !== isCurrent) data.isCurrent = isCurrent
      if (Object.keys(data).length) {
        changes.push(`record ${dn} ${fmt(match.startDate)}: ${Object.entries(data).map(([k, v]) => `${k}=${v instanceof Date ? fmt(v) : v}`).join(', ')}`)
        recordOps.push(() => prisma.employmentRecord.update({ where: { id: match.id }, data }))
      }
    } else {
      changes.push(`new record ${dn} ${fmt(ep.start)}–${fmt(ep.end)} ${ep.status}${isCurrent ? ' (current)' : ''}`)
      recordOps.push(() =>
        prisma.employmentRecord.create({
          data: {
            userId, departmentId: ep.departmentId, contractType: 'REGULAR', employmentStatus: ep.status,
            startDate: ep.start, endDate: ep.end, effectiveDate: ep.start, isCurrent, initiatedBy: ctx.actorId,
            reason: 'VA Masterlist CSV update',
          },
        }),
      )
    }
  })
  for (const r of existing) {
    if (!matchedIds.has(r.id) && r.isCurrent) {
      changes.push(`record ${r.departmentId ? ctx.deptName.get(r.departmentId) : 'no dept'} ${fmt(r.startDate)}: isCurrent=false (not in sheet)`)
      recordOps.push(() => prisma.employmentRecord.update({ where: { id: r.id }, data: { isCurrent: false } }))
    }
  }

  const hasWrites = Object.keys(vaData).length || Object.keys(profileData).length || membershipOps.length || recordOps.length
  if (!ctx.apply || !hasWrites) return hasWrites ? changes : []

  if (Object.keys(vaData).length) await prisma.vAProfile.update({ where: { id: va.id }, data: vaData })
  if (Object.keys(profileData).length) {
    await prisma.userProfile.upsert({ where: { userId }, create: { userId, ...profileData }, update: profileData })
  }
  for (const op of membershipOps) await op()
  for (const op of recordOps) await op()
  if (history.length) {
    await prisma.vAHistory.createMany({
      data: history.map((h) => ({ ...h, userId, reason: 'VA Masterlist CSV update', changedById: ctx.actorId })),
    })
  }
  await prisma.auditLog.create({
    data: {
      actorId: ctx.actorId, action: 'UPDATE', entityType: 'User', entityId: userId,
      newValues: { changes } as object,
      metadata: { viaImport: IMPORT_TAG, sheetLines: sorted.map((r) => r.line) } as object,
      departmentId: targetDeptId,
    },
  })
  return changes
}

async function createNew(sorted: MRow[], ctx: Ctx): Promise<string> {
  const latest = sorted[sorted.length - 1]
  // No email yet (common for the newest hires): a placeholder login, the
  // same shape bulkImportVAs() uses, for HR to replace later.
  const email = latest.workEmail || latest.personalEmail ||
    `${latest.firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}-va-${Date.now()}-${latest.line}@placeholder.vaa`
  const departmentId = ctx.deptByName.get(normDept(latest.department))?.id ?? null
  const status: GeneralStatus = latest.generalStatus ?? 'UNIDENTIFIED'
  const eps = episodes(sorted, ctx)
  const { addressLine, zipCode } = splitAddress(latest)
  const summary = `${latest.department || 'no dept'}, ${status}${latest.engagement ? `/${latest.engagement}` : ''}, hired ${fmt(latest.hire)}${rowEnd(latest) ? `, ended ${fmt(rowEnd(latest))}` : ''}, login ${email}`
  if (!ctx.apply) return summary

  const user = await prisma.user.create({
    data: {
      email,
      firstName: latest.firstName,
      lastName: latest.lastName,
      systemRole: 'VA',
      userType: 'VIRTUAL_ASSISTANT',
      vaProfile: {
        create: {
          vaaPosition: latest.position || null,
          positionSkillId: latest.position ? ctx.skillByText.get(latest.position.toLowerCase()) ?? null : null,
          status,
          onHold: latest.onHold,
          engagementStatus: latest.engagement ?? undefined,
          currentHireDate: latest.hire,
          currentEndDate: rowEnd(latest),
          preferredWorkHours: latest.preferredHours,
          availableSchedule: latest.availableSchedule || null,
          notes: [latest.vaId && `VA ID: ${latest.vaId}`, latest.passport && `Passport: ${latest.passport}`].filter(Boolean).join(' | ') || null,
        },
      },
      profile: {
        create: {
          phone: latest.whatsapp || null,
          gcashNumber: latest.gcash ? normalizeGcash(latest.gcash) : null,
          gender: latest.gender || null,
          birthDate: latest.birthday,
          nonCelebrant: latest.nonCelebrant,
          birthdayCelebrant: !latest.nonCelebrant,
          addressLine, zipCode,
          barangay: latest.barangay || null,
          cityMunicipality: latest.city || null,
          province: latest.province || null,
          personalEmail: latest.personalEmail || null,
          workEmail: latest.workEmail || null,
          emergencyContactName: latest.emergencyName || null,
          emergencyContactPhone: latest.emergencyPhone || null,
          emergencyContactRelation: latest.emergencyRelation || null,
          facebookUrl: latest.facebook || null,
          linkedinUrl: latest.linkedin || null,
          passportNumber: latest.passport || null,
        },
      },
      ...(departmentId ? { memberships: { create: { departmentId, isPrimary: true, startedAt: latest.hire! } } } : {}),
    },
  })
  await prisma.employmentRecord.createMany({
    data: eps.map((ep, i) => ({
      userId: user.id, departmentId: ep.departmentId, contractType: 'REGULAR' as const, employmentStatus: ep.status,
      startDate: ep.start, endDate: ep.end, effectiveDate: ep.start, isCurrent: i === eps.length - 1, initiatedBy: ctx.actorId,
      reason: 'VA Masterlist CSV update',
    })),
  })
  await prisma.auditLog.create({
    data: {
      actorId: ctx.actorId, action: 'CREATE', entityType: 'User', entityId: user.id,
      newValues: { email, firstName: latest.firstName, lastName: latest.lastName, department: latest.department || null, status } as object,
      metadata: { viaImport: IMPORT_TAG, sheetLines: sorted.map((r) => r.line) } as object,
      departmentId,
    },
  })
  return summary
}

// Same pattern as lib/sync/dmf-import.ts: a non-login system user so audit
// rows and VAHistory.changedById have a real FK target.
async function getSystemActorId(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: SYSTEM_ACTOR_EMAIL },
    update: {},
    create: {
      email: SYSTEM_ACTOR_EMAIL,
      firstName: 'Masterlist',
      lastName: 'Import',
      systemRole: 'SYSTEM_ADMIN',
      userType: 'INTERNAL_STAFF',
      isActive: false,
    },
  })
  return user.id
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
