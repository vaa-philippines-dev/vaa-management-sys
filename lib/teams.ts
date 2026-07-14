import { prisma } from '@/lib/prisma'

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
