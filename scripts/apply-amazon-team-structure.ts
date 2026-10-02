// One-off: bring the Amazon department's teams in line with the structure the
// OM sent in the Feedback Log (FB-0009, 2026-10-01) — Eduardo Manabat and
// Mayette Caoagdan no longer lead, Michelle Bacalando does, and the teams are
// renumbered 1-9. The live DMF Masterlist tab already uses the new names
// ("TEAM 07 - MICHELLE", ...) in its TEAM column, so that column is the
// source for who sits on which team; the leaders come from the feedback.
//
//   npx tsx --env-file=.env.local scripts/apply-amazon-team-structure.ts          # dry run
//   npx tsx --env-file=.env.local scripts/apply-amazon-team-structure.ts --apply
//
// - Existing teams are found by their current leader and renamed, so their
//   history stays attached. A leader with no team gets a new one.
// - Teams that aren't in the new structure (Team 03 - MATE, Team 07 - EDU) are
//   archived: leaders cleared, memberships ended, status CANCELLED.
// - Every Masterlist row with a TEAM value is moved onto that team (other
//   Amazon team memberships ended). Rows with a blank TEAM are left alone.
// - Names are matched exactly (lib/sync/dmf-match.ts normalization), then by
//   first-word-of-first-name + last name; anything ambiguous or unmatched is
//   reported, never guessed.
// Re-running is safe: a second run finds nothing to change.

import { prisma } from '@/lib/prisma'
import { DMF_SHEETS, fetchDmfTabRows } from '@/lib/google/dmf-sheet'
import { normalizeName } from '@/lib/sync/dmf-match'
import { logAudit } from '@/lib/audit'

const APPLY = process.argv.includes('--apply')
const DEPARTMENT = 'Amazon'

// Team name -> leader's full name as it is on their User record.
const STRUCTURE: Record<string, string> = {
  'Team 01 - ANGIE': 'Angeline Paramil',
  'Team 02 - CED': 'Cedney Galano',
  'Team 03 - SHEENA': 'Sheena Marie Lacasandile',
  'Team 04 - ARCI': 'Rowena Camballa',
  'Team 05 - FLEXIE': 'Flexie Joe Magabo',
  'Team 06 - ANGEL': 'Ma. Angelica Lacorte',
  'Team 07 - MICHELLE': 'Mary Michelle Ann Bacalando',
  'Team 08 - JESS': 'Jessica Medina',
  'Team 09 - ANA': 'Ana Clarisse Natividad',
}

// "TEAM 07 - MICHELLE" -> "Team 07 - MICHELLE"
function sheetTeamName(raw: string | undefined): string | null {
  const m = (raw ?? '').trim().match(/^team\s*0?(\d+)\s*-\s*(.+)$/i)
  if (!m) return null
  return `Team ${m[1].padStart(2, '0')} - ${m[2].trim().toUpperCase()}`
}

// First word of the first name + last word of the last name: "Sheena
// Lacasandile" in the sheet is "Sheena Marie Lacasandile" in the app.
const looseKey = (first: string, last: string) =>
  normalizeName(`${first.trim().split(/\s+/)[0] ?? ''} ${last.trim().split(/\s+/).pop() ?? ''}`)

async function main() {
  const sheetId = DMF_SHEETS[DEPARTMENT]
  if (!sheetId) throw new Error(`No DMF sheet configured for ${DEPARTMENT}`)
  const department = await prisma.department.findFirst({ where: { name: DEPARTMENT, level: 'SERVICE' }, select: { id: true } })
  if (!department) throw new Error(`Department ${DEPARTMENT} not found`)
  const departmentId = department.id
  const now = new Date()
  const log = (msg: string) => console.log(`${APPLY ? '' : '[dry] '}${msg}`)

  // ── People: active members of the department, plus the named leaders
  //    (Michelle's membership is still Wholesale-only).
  const people = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { memberships: { some: { departmentId, endedAt: null } } },
        { userType: 'VIRTUAL_ASSISTANT', vaProfile: { isNot: null } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      memberships: { where: { departmentId, endedAt: null }, select: { id: true } },
    },
  })
  const inDept = people.filter((p) => p.memberships.length > 0)
  const exact = new Map<string, string[]>()
  const loose = new Map<string, string[]>()
  for (const p of inDept) {
    const k = normalizeName(`${p.firstName} ${p.lastName}`)
    exact.set(k, [...(exact.get(k) ?? []), p.id])
    const l = looseKey(p.firstName, p.lastName)
    loose.set(l, [...(loose.get(l) ?? []), p.id])
  }
  const byId = new Map(people.map((p) => [p.id, p]))
  const nameOf = (id: string) => {
    const p = byId.get(id)
    return p ? `${p.firstName} ${p.lastName}` : id
  }
  function match(raw: string): { id: string | null; why?: string } {
    const k = normalizeName(raw)
    const e = exact.get(k)
    if (e?.length === 1) return { id: e[0] }
    if (e && e.length > 1) return { id: null, why: 'ambiguous' }
    const parts = raw.trim().split(/\s+/)
    const l = loose.get(looseKey(parts[0] ?? '', parts[parts.length - 1] ?? ''))
    if (l?.length === 1) return { id: l[0] }
    return { id: null, why: l && l.length > 1 ? 'ambiguous' : 'no match' }
  }

  // Leaders resolve against every VA account (exact full name), since one
  // isn't a department member yet.
  const leaders = new Map<string, string>()
  for (const [team, name] of Object.entries(STRUCTURE)) {
    const hits = people.filter((p) => normalizeName(`${p.firstName} ${p.lastName}`) === normalizeName(name))
    if (hits.length !== 1) throw new Error(`Leader "${name}" for ${team}: ${hits.length} matching users`)
    leaders.set(team, hits[0].id)
  }

  // ── Teams
  const teams = await prisma.team.findMany({
    where: { departmentId },
    select: { id: true, name: true, status: true, leaderId: true, tempLeader1Id: true, tempLeader2Id: true },
  })
  const teamIdByName = new Map<string, string>()
  const kept = new Set<string>()

  for (const [targetName, leaderId] of leaders) {
    const existing =
      teams.find((t) => t.status === 'ACTIVE' && t.leaderId === leaderId) ??
      teams.find((t) => t.name === targetName)
    if (existing) {
      kept.add(existing.id)
      teamIdByName.set(targetName, existing.id)
      if (existing.name !== targetName) {
        log(`rename "${existing.name}" -> "${targetName}"`)
        if (APPLY) await prisma.team.update({ where: { id: existing.id }, data: { name: targetName } })
      }
      if (existing.status !== 'ACTIVE') {
        log(`reactivate "${targetName}"`)
        if (APPLY) await prisma.team.update({ where: { id: existing.id }, data: { status: 'ACTIVE', isActive: true } })
      }
    } else {
      log(`create "${targetName}"`)
      if (APPLY) {
        const t = await prisma.team.create({ data: { departmentId, name: targetName } })
        teamIdByName.set(targetName, t.id)
        kept.add(t.id)
      } else {
        teamIdByName.set(targetName, `new:${targetName}`)
      }
    }
  }

  const archived = teams.filter((t) => !kept.has(t.id) && t.status === 'ACTIVE')
  for (const t of archived) {
    const members = await prisma.teamMembership.count({ where: { teamId: t.id, endedAt: null } })
    log(`archive "${t.name}" (leader ${t.leaderId ? nameOf(t.leaderId) : '—'}, ending ${members} memberships)`)
    if (APPLY) {
      await prisma.$transaction([
        prisma.teamMembership.updateMany({ where: { teamId: t.id, endedAt: null }, data: { endedAt: now } }),
        prisma.team.update({
          where: { id: t.id },
          data: { status: 'CANCELLED', isActive: false, leaderId: null, tempLeader1Id: null, tempLeader2Id: null },
        }),
      ])
    }
  }
  const archivedIds = new Set(archived.map((t) => t.id))

  // ── Desired roster: sheet TEAM column, then each leader on their own team.
  const rows = await fetchDmfTabRows(sheetId, 'Masterlist', 3)
  const desired = new Map<string, string>() // userId -> target team name
  const unmatched: string[] = []
  const unknownTeams = new Set<string>()
  for (const r of rows) {
    const team = sheetTeamName(r['TEAM'])
    if (!team || !r['VA NAME']) continue
    if (!STRUCTURE[team]) { unknownTeams.add(team); continue }
    const m = match(r['VA NAME'])
    if (!m.id) { unmatched.push(`${r['VA NAME']} (${team}, ${r['GENERAL STATUS'] || '—'}): ${m.why}`); continue }
    desired.set(m.id, team)
  }
  for (const [team, leaderId] of leaders) desired.set(leaderId, team)

  // Leaders must be department members to sit on a department team.
  for (const [team, leaderId] of leaders) {
    if ((byId.get(leaderId)?.memberships.length ?? 0) > 0) continue
    log(`add ${nameOf(leaderId)} to ${DEPARTMENT} (leader of ${team})`)
    if (APPLY) await prisma.departmentMembership.create({ data: { userId: leaderId, departmentId, isPrimary: false } })
  }

  const current = await prisma.teamMembership.findMany({
    where: { endedAt: null, team: { departmentId }, userId: { in: [...desired.keys()] } },
    select: { id: true, userId: true, teamId: true },
    orderBy: { startedAt: 'asc' },
  })
  let moved = 0, added = 0, unchanged = 0
  for (const [userId, team] of desired) {
    const targetId = teamIdByName.get(team)!
    const mine = current.filter((m) => m.userId === userId && !archivedIds.has(m.teamId))
    const keep = mine.find((m) => m.teamId === targetId)
    const toEnd = mine.filter((m) => m !== keep).map((m) => m.id)
    if (keep && toEnd.length === 0) { unchanged++; continue }
    if (keep) moved++
    else if (mine.length > 0) moved++
    else added++
    if (!APPLY) continue
    await prisma.$transaction([
      prisma.teamMembership.updateMany({ where: { id: { in: toEnd } }, data: { endedAt: now } }),
      ...(keep || targetId.startsWith('new:') ? [] : [prisma.teamMembership.create({ data: { teamId: targetId, userId } })]),
    ])
  }

  // Leader slots last — setTeamLeader() requires an active membership first.
  for (const [team, leaderId] of leaders) {
    const id = teamIdByName.get(team)!
    const t = teams.find((x) => x.id === id)
    if (t?.leaderId === leaderId) continue
    log(`leader of "${team}" -> ${nameOf(leaderId)}`)
    if (APPLY) await prisma.team.update({ where: { id }, data: { leaderId } })
  }

  console.log(`\nRoster: ${desired.size} people placed — ${added} added, ${moved} moved, ${unchanged} already right`)
  if (unknownTeams.size) console.log(`Sheet teams not in the structure (skipped): ${[...unknownTeams].join(', ')}`)
  console.log(`Unmatched sheet rows (${unmatched.length}):`)
  unmatched.forEach((u) => console.log(`  ${u}`))

  if (APPLY) {
    const actor =
      (await prisma.user.findUnique({ where: { email: 'business-support@vaaphilippines.com' }, select: { id: true } })) ??
      (await prisma.user.findFirst({ where: { systemRole: 'SUPER_ADMIN', isActive: true }, select: { id: true } }))
    if (actor) {
      await logAudit({
        actorId: actor.id,
        action: 'UPDATE',
        entityType: 'Team',
        entityId: departmentId,
        metadata: { script: 'apply-amazon-team-structure', feedbackId: 'FB-0009', structure: STRUCTURE, added, moved, archived: archived.map((t) => t.name) },
        departmentId,
      })
    }
  }
  if (!APPLY) console.log('\nDry run — re-run with --apply to write.')
}

main().finally(() => prisma.$disconnect())
