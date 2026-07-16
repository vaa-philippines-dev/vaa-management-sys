import { prisma } from '@/lib/prisma'
import { getCurrentUser, canMutate, getManagedDepartmentIds, TEAM_MANAGE_ROLES } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, UsersRound } from 'lucide-react'
import { CreateTeamForm } from '@/components/teams/CreateTeamForm'

export default async function NewTeamPage() {
  const user = await getCurrentUser()
  if (!user || !TEAM_MANAGE_ROLES.includes(user.systemRole)) {
    redirect('/teams')
  }

  const isAdmin = canMutate(user)
  const managedIds = getManagedDepartmentIds(user)

  const departments = await prisma.department.findMany({
    where: isAdmin ? { status: 'ACTIVE', parentId: { not: null } } : { id: { in: managedIds } },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/teams">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">New Team</h2>
          <p className="text-sm text-muted-foreground mt-1">Create a team within your department</p>
        </div>
      </div>

      <Card className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-6 pb-5 border-b">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UsersRound className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Team details</p>
              <p className="text-xs text-muted-foreground">Give your team a name and assign it to a department</p>
            </div>
          </div>

          {departments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              You don&apos;t manage any departments that can have teams.
            </p>
          ) : (
            <CreateTeamForm departments={departments} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
