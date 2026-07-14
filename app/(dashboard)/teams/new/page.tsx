import { prisma } from '@/lib/prisma'
import { getCurrentUser, canMutate, getManagedDepartmentIds, TEAM_MANAGE_ROLES } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createTeam } from '@/app/(dashboard)/teams/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

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
      <div>
        <h2 className="text-2xl font-bold tracking-tight">New Team</h2>
        <p className="text-sm text-muted-foreground mt-1">Create a team within your department</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form action={createTeam} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Team Name *</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="departmentId">Department *</Label>
              <select
                id="departmentId"
                name="departmentId"
                required
                defaultValue=""
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="" disabled>Select a department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="submit">Create Team</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
