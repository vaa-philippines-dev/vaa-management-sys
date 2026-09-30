import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/src/generated/prisma/client'

// "Team Leader" as a pick-list (e.g. VA Preparation's Person In-Charge):
// anyone who leads or temp-leads an active team in scope, plus anyone whose
// SystemRole is TEAM_LEADER. Leading is mostly a team relationship, not a
// role — most leaders are VA accounts (see app/(dashboard)/layout.tsx).
// `departmentIds: null` means every department.
export function teamLeaderUserWhere(departmentIds: string[] | null): Prisma.UserWhereInput {
  const team: Prisma.TeamWhereInput = {
    status: 'ACTIVE',
    ...(departmentIds === null ? {} : { departmentId: { in: departmentIds } }),
  }
  return {
    isActive: true,
    OR: [
      { ledTeams: { some: team } },
      { tempLedTeams1: { some: team } },
      { tempLedTeams2: { some: team } },
      {
        systemRole: 'TEAM_LEADER',
        ...(departmentIds === null
          ? {}
          : { memberships: { some: { departmentId: { in: departmentIds }, endedAt: null } } }),
      },
    ],
  }
}

// People who can be added to a team in `departmentId`: active accounts with an
// active membership in that department, not already on the team. VA accounts
// must also be an active VA (the Masterlist's Active rule) — a resigned VA
// can still hold a stale membership. One row per person even when they hold
// two memberships in the department.
export async function getTeamCandidates(departmentId: string, excludeUserIds: string[] = []) {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      id: { notIn: excludeUserIds },
      memberships: { some: { departmentId, endedAt: null } },
      OR: [
        { userType: { not: 'VIRTUAL_ASSISTANT' } },
        { vaProfile: { is: { status: { in: ['ACTIVE', 'PENDING'] } } } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, userType: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  })
  return users.map((u) => ({
    userId: u.id,
    name: `${u.firstName} ${u.lastName}`.trim(),
    isVA: u.userType === 'VIRTUAL_ASSISTANT',
  }))
}

// Whether a user is affiliated with any team — as leader, either temp leader
// slot, or an active (non-ended) member. Used to decide whether a VA-type user
// should see the sidebar's "Department" section at all.
export async function isTeamAffiliated(userId: string): Promise<boolean> {
  const count = await prisma.team.count({
    where: {
      OR: [
        { leaderId: userId },
        { tempLeader1Id: userId },
        { tempLeader2Id: userId },
        { memberships: { some: { userId, endedAt: null } } },
      ],
    },
  })
  return count > 0
}

// Ids of the team(s) a user is affiliated with — as leader, either temp leader
// slot, or an active (non-ended) member. Used to row-scope the VA roster to
// "same team" for team-affiliated VA viewers.
export async function getOwnTeamIds(userId: string): Promise<string[]> {
  const teams = await prisma.team.findMany({
    where: {
      OR: [
        { leaderId: userId },
        { tempLeader1Id: userId },
        { tempLeader2Id: userId },
        { memberships: { some: { userId, endedAt: null } } },
      ],
    },
    select: { id: true },
  })
  return teams.map((t) => t.id)
}

// Ids of active teams a user actually LEADS (leader or either temp-leader
// slot) — excludes plain membership. This is the authorization boundary for
// actions only a team's leadership should take (e.g. reporting a
// resignation via app/resign), not just anyone affiliated with the team.
export async function getLedTeamIds(userId: string): Promise<string[]> {
  const teams = await prisma.team.findMany({
    where: {
      status: 'ACTIVE',
      OR: [{ leaderId: userId }, { tempLeader1Id: userId }, { tempLeader2Id: userId }],
    },
    select: { id: true },
  })
  return teams.map((t) => t.id)
}
