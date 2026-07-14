import { prisma } from '@/lib/prisma'
import { getCurrentUser, getManagedDepartmentIds } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Cake } from 'lucide-react'

const FULL_ADMIN_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE']

// Prisma's DateTime? type is Date | null at compile time, but a malformed
// underlying value can still surface as something other than a real Date at
// runtime — coerce defensively rather than assume the type holds.
function toValidDate(value: unknown): Date | null {
  const d = value instanceof Date ? value : new Date(value as string)
  return isNaN(d.getTime()) ? null : d
}

function formatMonthDay(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

// Days until the next occurrence of this month/day, counting today as 0.
function daysUntilNext(date: Date, today: Date) {
  const next = new Date(today.getFullYear(), date.getMonth(), date.getDate())
  if (next < today) next.setFullYear(next.getFullYear() + 1)
  return Math.round((next.getTime() - today.getTime()) / 86400000)
}

export default async function BirthdaysPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const isFullAdmin = FULL_ADMIN_ROLES.includes(user.systemRole)
  const isVA = user.userType === 'VIRTUAL_ASSISTANT'

  let scopedDeptIds: string[] | undefined
  if (!isFullAdmin) {
    scopedDeptIds = isVA
      ? (user.memberships ?? []).filter((m) => !m.endedAt).map((m) => m.departmentId)
      : getManagedDepartmentIds(user)
  }

  const users = await prisma.user.findMany({
    where: {
      profile: { birthDate: { not: null }, nonCelebrant: false, birthdayCelebrant: true },
      ...(scopedDeptIds ? { memberships: { some: { departmentId: { in: scopedDeptIds }, endedAt: null } } } : {}),
    },
    include: { profile: true },
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const celebrants = users
    .map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, birthDate: toValidDate(u.profile!.birthDate) }))
    .filter((c): c is { id: string; name: string; birthDate: Date } => c.birthDate !== null)
    .map((c) => ({ ...c, daysUntil: daysUntilNext(c.birthDate, today) }))
    .sort((a, b) => a.daysUntil - b.daysUntil)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Birthdays</h2>
        <p className="text-sm text-muted-foreground mt-1">Upcoming birthday celebrants</p>
      </div>

      {celebrants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Cake className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No birthday celebrants found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden divide-y">
          {celebrants.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-medium">{c.name}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{formatMonthDay(c.birthDate)}</Badge>
                {c.daysUntil === 0 && <Badge className="text-xs">Today</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
