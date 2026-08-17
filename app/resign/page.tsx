import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getLedTeamIds } from '@/lib/teams'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { TeamLeaderResignationForm } from '@/components/resign/TeamLeaderResignationForm'

export default async function ResignPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/resign')

  const ledTeamIds = await getLedTeamIds(user.id)

  if (ledTeamIds.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Not available</CardTitle>
            <CardDescription>
              This page is only for team leaders. Your account isn&apos;t registered as a leader of any active team.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Contact HR if you believe this is a mistake.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const teams = await prisma.team.findMany({
    where: { id: { in: ledTeamIds } },
    select: {
      id: true,
      name: true,
      memberships: {
        where: { endedAt: null, userId: { not: user.id } },
        select: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              vaProfile: { select: { id: true } },
            },
          },
        },
        orderBy: { user: { firstName: 'asc' } },
      },
    },
    orderBy: { name: 'asc' },
  })

  const vaOptions = teams.flatMap((team) =>
    team.memberships
      .filter((m) => m.user.vaProfile)
      .map((m) => ({
        userId: m.user.vaProfile!.id,
        name: `${m.user.firstName} ${m.user.lastName}`.trim() + (teams.length > 1 ? ` (${team.name})` : ''),
      }))
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Report a Resignation</CardTitle>
          <CardDescription>
            For {teams.map((t) => t.name).join(', ')} — signed in as {user.firstName || user.email}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamLeaderResignationForm vaOptions={vaOptions} />
        </CardContent>
      </Card>
    </div>
  )
}
