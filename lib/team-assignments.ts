import { prisma } from '@/lib/prisma'
import type { PersonRef } from '@/lib/structure'

// Per-team active/idle/unavailable VA counts + VA-to-client assignment grid,
// for the DM/OM-facing "Team Assignment" view. Thin, prisma-direct, analogous
// in spirit to lib/teams.ts.

export type VAAssignmentState = 'ACTIVE' | 'IDLE' | 'UNAVAILABLE'

// ACTIVE: >=1 Assignment with status ACTIVE (the enum is the source of truth,
// not endDate — consistent with dashboard/page.tsx and vas/page.tsx, which
// already filter this way).
// UNAVAILABLE: no active assignment, and either the VA profile itself isn't
// ACTIVE or its (manually maintained) availabilityStatus says on leave/
// unavailable.
// IDLE: no active assignment, VA profile active, not on leave/unavailable —
// genuine bench capacity. total = active + idle + unavailable always
// reconciles.
export function classifyAssignmentState(input: {
  vaStatus: string | null
  availabilityStatus: string | null
  activeAssignmentCount: number
}): VAAssignmentState {
  if (input.activeAssignmentCount > 0) return 'ACTIVE'
  if (input.vaStatus !== 'ACTIVE' || input.availabilityStatus === 'ON_LEAVE' || input.availabilityStatus === 'UNAVAILABLE') {
    return 'UNAVAILABLE'
  }
  return 'IDLE'
}

// availabilityStatus is a separate, manually-set field (not derived from
// Assignment rows) — this flags when it disagrees with the derived state, so
// stale data surfaces instead of being silently trusted.
function computeStateMismatch(state: VAAssignmentState, availabilityStatus: string | null): boolean {
  if (state === 'ACTIVE') return availabilityStatus === 'AVAILABLE'
  if (state === 'IDLE') return availabilityStatus === 'FULLY_ASSIGNED' || availabilityStatus === 'PARTIALLY_ASSIGNED'
  return false
}

export type TeamMemberAssignmentRow = {
  userId: string
  vaProfileId: string | null
  name: string
  employeeId: string | null
  position: string | null
  availabilityStatus: string | null
  state: VAAssignmentState
  stateMismatch: boolean
  leaderSlot: 'LEADER' | 'TEMP_1' | 'TEMP_2' | null
  clients: { id: string; name: string; agreedHours: number }[]
  totalAgreedHours: number
  capacityHours: number | null
}

export type AssignmentCounts = { total: number; active: number; idle: number; unavailable: number }

export type TeamAssignmentSummary = {
  teamId: string
  teamName: string
  leader: PersonRef | null
  tempLeader1: PersonRef | null
  tempLeader2: PersonRef | null
  members: TeamMemberAssignmentRow[]
  counts: AssignmentCounts
}

export type DepartmentTeamAssignments = {
  teams: TeamAssignmentSummary[]
  unassigned: TeamMemberAssignmentRow[]
  totals: AssignmentCounts
}

const PERSON_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  employeeId: true,
  avatarUrl: true,
  systemRole: true,
} as const

function emptyCounts(): AssignmentCounts {
  return { total: 0, active: 0, idle: 0, unavailable: 0 }
}

function addToCounts(counts: AssignmentCounts, state: VAAssignmentState) {
  counts.total += 1
  if (state === 'ACTIVE') counts.active += 1
  else if (state === 'IDLE') counts.idle += 1
  else counts.unavailable += 1
}

export async function getDepartmentTeamAssignments(departmentId: string): Promise<DepartmentTeamAssignments> {
  const teams = await prisma.team.findMany({
    where: { departmentId, status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      leaderId: true,
      tempLeader1Id: true,
      tempLeader2Id: true,
      leader: { select: PERSON_SELECT },
      tempLeader1: { select: PERSON_SELECT },
      tempLeader2: { select: PERSON_SELECT },
      memberships: {
        where: { endedAt: null },
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              vaProfile: {
                select: {
                  id: true,
                  status: true,
                  availabilityStatus: true,
                  totalCapacityHours: true,
                  vaaPosition: true,
                  positionSkill: { select: { shortName: true } },
                },
              },
            },
          },
        },
        orderBy: { startedAt: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  const teamMemberUserIds = new Set<string>()
  const vaProfileIds: string[] = []
  for (const team of teams) {
    for (const m of team.memberships) {
      teamMemberUserIds.add(m.userId)
      if (m.user.vaProfile) vaProfileIds.push(m.user.vaProfile.id)
    }
  }

  const activeAssignments = vaProfileIds.length
    ? await prisma.assignment.findMany({
        where: { vaProfileId: { in: vaProfileIds }, status: 'ACTIVE' },
        select: {
          vaProfileId: true,
          agreedHours: true,
          monthlyHours: true,
          client: { select: { id: true, name: true } },
        },
      })
    : []

  const assignmentsByVaProfile = new Map<string, typeof activeAssignments>()
  for (const a of activeAssignments) {
    const list = assignmentsByVaProfile.get(a.vaProfileId) ?? []
    list.push(a)
    assignmentsByVaProfile.set(a.vaProfileId, list)
  }

  function buildRow(
    userId: string,
    name: string,
    employeeId: string | null,
    vaProfile: { id: string; status: string; availabilityStatus: string; totalCapacityHours: unknown; vaaPosition: string | null; positionSkill: { shortName: string | null } | null } | null,
    leaderSlot: TeamMemberAssignmentRow['leaderSlot']
  ): TeamMemberAssignmentRow {
    const assignments = vaProfile ? assignmentsByVaProfile.get(vaProfile.id) ?? [] : []
    const state = classifyAssignmentState({
      vaStatus: vaProfile?.status ?? null,
      availabilityStatus: vaProfile?.availabilityStatus ?? null,
      activeAssignmentCount: assignments.length,
    })
    return {
      userId,
      vaProfileId: vaProfile?.id ?? null,
      name,
      employeeId,
      position: vaProfile?.positionSkill?.shortName ?? vaProfile?.vaaPosition ?? null,
      availabilityStatus: vaProfile?.availabilityStatus ?? null,
      state,
      stateMismatch: computeStateMismatch(state, vaProfile?.availabilityStatus ?? null),
      leaderSlot,
      clients: assignments.map((a) => ({ id: a.client.id, name: a.client.name, agreedHours: Number(a.agreedHours) })),
      totalAgreedHours: assignments.reduce((sum, a) => sum + Number(a.agreedHours), 0),
      capacityHours: vaProfile?.totalCapacityHours != null ? Number(vaProfile.totalCapacityHours) : null,
    }
  }

  const totals = emptyCounts()
  const summaries: TeamAssignmentSummary[] = teams.map((team) => {
    const counts = emptyCounts()
    // TeamMembership has no unique constraint on (teamId, userId) — a person
    // can end up with two simultaneously-active membership rows on the same
    // team (a real data-quality issue the sheet's own "Red = Duplicate"
    // legend calls out). Dedupe here so it doesn't double-count someone in
    // the active/idle totals; memberships are already ordered by startedAt
    // asc, so this keeps each person's earliest row.
    const seenUserIds = new Set<string>()
    const dedupedMemberships = team.memberships.filter((m) => {
      if (seenUserIds.has(m.userId)) return false
      seenUserIds.add(m.userId)
      return true
    })
    const members = dedupedMemberships.map((m) => {
      const leaderSlot: TeamMemberAssignmentRow['leaderSlot'] =
        m.userId === team.leaderId ? 'LEADER' : m.userId === team.tempLeader1Id ? 'TEMP_1' : m.userId === team.tempLeader2Id ? 'TEMP_2' : null
      const row = buildRow(m.userId, `${m.user.firstName} ${m.user.lastName}`, m.user.employeeId, m.user.vaProfile, leaderSlot)
      addToCounts(counts, row.state)
      addToCounts(totals, row.state)
      return row
    })
    return {
      teamId: team.id,
      teamName: team.name,
      leader: team.leader,
      tempLeader1: team.tempLeader1,
      tempLeader2: team.tempLeader2,
      members,
      counts,
    }
  })

  // Unassigned bucket: VAs actively in this department but not on any active
  // team roster above — invisible on /teams today, high-value to surface here.
  const deptVAUsers = await prisma.user.findMany({
    where: {
      userType: 'VIRTUAL_ASSISTANT',
      memberships: { some: { departmentId, endedAt: null } },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeId: true,
      vaProfile: {
        select: {
          id: true,
          status: true,
          availabilityStatus: true,
          totalCapacityHours: true,
          vaaPosition: true,
          positionSkill: { select: { shortName: true } },
        },
      },
    },
  })

  const unassignedUsers = deptVAUsers.filter((u) => !teamMemberUserIds.has(u.id))
  const unassignedVaProfileIds = unassignedUsers.map((u) => u.vaProfile?.id).filter((id): id is string => !!id)
  if (unassignedVaProfileIds.length) {
    const unassignedAssignments = await prisma.assignment.findMany({
      where: { vaProfileId: { in: unassignedVaProfileIds }, status: 'ACTIVE' },
      select: { vaProfileId: true, agreedHours: true, monthlyHours: true, client: { select: { id: true, name: true } } },
    })
    for (const a of unassignedAssignments) {
      const list = assignmentsByVaProfile.get(a.vaProfileId) ?? []
      list.push(a)
      assignmentsByVaProfile.set(a.vaProfileId, list)
    }
  }

  const unassigned = unassignedUsers.map((u) => {
    const row = buildRow(u.id, `${u.firstName} ${u.lastName}`, u.employeeId, u.vaProfile, null)
    addToCounts(totals, row.state)
    return row
  })

  return { teams: summaries, unassigned, totals }
}
