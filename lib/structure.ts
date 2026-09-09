import { prisma } from '@/lib/prisma'
import type { SystemRole } from '@/src/generated/prisma/enums'
import { DEPARTMENT_SCOPED_ROLES } from '@/lib/auth'

// Read-model for "who runs department X" — Dept Manager(s), Operations
// Manager(s), Team Leaders, and the department Head. Deliberately separate
// from lib/auth.ts (forward authorization checks, imported on nearly every
// page) and lib/departments.ts (pure CRUD/validation, no aggregation).
//
// DepartmentMembership has no role field and no uniqueness constraint, so 0,
// 1, or N users can hold an active DEPT_MANAGER/OPERATIONS_MANAGER membership
// on one department at once — every list below is a list, never a single
// value, so a data problem (missing or duplicate manager) stays visible
// instead of being silently collapsed.

export type PersonRef = {
  id: string
  firstName: string
  lastName: string
  employeeId: string | null
  avatarUrl: string | null
  systemRole: string
}

export type TeamLeaderRef = PersonRef & {
  slot: 'LEADER' | 'TEMP_LEADER'
  teams: { id: string; name: string }[]
}

export type DepartmentStructure = {
  departmentId: string
  deptManagers: PersonRef[]
  opsManagers: PersonRef[]
  teamLeaders: TeamLeaderRef[]
  head: PersonRef | null
}

const PERSON_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  employeeId: true,
  avatarUrl: true,
  systemRole: true,
} as const

function emptyStructure(departmentId: string): DepartmentStructure {
  return { departmentId, deptManagers: [], opsManagers: [], teamLeaders: [], head: null }
}

// Returns a plain object (not a Map) — callers may wrap this in cached()
// (lib/cache.ts, backed by Next's unstable_cache), which JSON-serializes its
// return value; a Map would silently collapse to "{}" through that path.
export async function getDepartmentStructures(departmentIds: string[]): Promise<Record<string, DepartmentStructure>> {
  const result: Record<string, DepartmentStructure> = {}
  if (departmentIds.length === 0) return result
  for (const id of departmentIds) result[id] = emptyStructure(id)

  const [memberships, teams, departments] = await Promise.all([
    prisma.departmentMembership.findMany({
      where: {
        departmentId: { in: departmentIds },
        endedAt: null,
        user: { systemRole: { in: DEPARTMENT_SCOPED_ROLES as SystemRole[] }, status: 'ACTIVE' },
      },
      select: {
        departmentId: true,
        isPrimary: true,
        startedAt: true,
        user: { select: PERSON_SELECT },
      },
      orderBy: [{ isPrimary: 'desc' }, { startedAt: 'asc' }],
    }),
    prisma.team.findMany({
      where: { departmentId: { in: departmentIds }, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        departmentId: true,
        leader: { select: PERSON_SELECT },
        tempLeader1: { select: PERSON_SELECT },
        tempLeader2: { select: PERSON_SELECT },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.department.findMany({
      where: { id: { in: departmentIds } },
      select: { id: true, head: { select: PERSON_SELECT } },
    }),
  ])

  for (const m of memberships) {
    const entry = result[m.departmentId]
    if (!entry) continue
    if (m.user.systemRole === 'DEPT_MANAGER') entry.deptManagers.push(m.user)
    else if (m.user.systemRole === 'OPERATIONS_MANAGER') entry.opsManagers.push(m.user)
  }

  // Flatten leader/tempLeader1/tempLeader2 across every team in a department
  // to one TeamLeaderRef per distinct person, keeping LEADER over TEMP_LEADER
  // if someone somehow holds both, and accumulating every team they lead.
  const leadersByDept = new Map<string, Map<string, TeamLeaderRef>>()
  for (const team of teams) {
    let leaders = leadersByDept.get(team.departmentId)
    if (!leaders) {
      leaders = new Map<string, TeamLeaderRef>()
      leadersByDept.set(team.departmentId, leaders)
    }
    const slots: { person: PersonRef | null; slot: 'LEADER' | 'TEMP_LEADER' }[] = [
      { person: team.leader, slot: 'LEADER' },
      { person: team.tempLeader1, slot: 'TEMP_LEADER' },
      { person: team.tempLeader2, slot: 'TEMP_LEADER' },
    ]
    for (const { person, slot } of slots) {
      if (!person) continue
      const existing = leaders.get(person.id)
      if (!existing) {
        leaders.set(person.id, { ...person, slot, teams: [{ id: team.id, name: team.name }] })
      } else {
        if (slot === 'LEADER') existing.slot = 'LEADER'
        existing.teams.push({ id: team.id, name: team.name })
      }
    }
  }
  for (const [departmentId, leaders] of leadersByDept) {
    const entry = result[departmentId]
    if (entry) entry.teamLeaders = Array.from(leaders.values())
  }

  for (const d of departments) {
    const entry = result[d.id]
    if (entry) entry.head = d.head
  }

  return result
}

export async function getDepartmentStructure(departmentId: string): Promise<DepartmentStructure> {
  const map = await getDepartmentStructures([departmentId])
  return map[departmentId] ?? emptyStructure(departmentId)
}
