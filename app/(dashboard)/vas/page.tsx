import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Users, Search, ArrowUpDown } from 'lucide-react'

const CATEGORY_COLORS: Record<string, string> = {
  AMAZON: 'bg-orange-500/15 text-orange-700 border-orange-500/20',
  WALMART: 'bg-blue-500/15 text-blue-700 border-blue-500/20',
  TIKTOK_SHOP: 'bg-pink-500/15 text-pink-700 border-pink-500/20',
  SHOPIFY: 'bg-green-500/15 text-green-700 border-green-500/20',
  GENERAL: 'bg-gray-500/15 text-gray-700 border-gray-500/20',
}

const AVAILABILITY_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-green-500/15 text-green-700 border-green-500/20',
  PARTIALLY_ASSIGNED: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/20',
  FULLY_ASSIGNED: 'bg-blue-500/15 text-blue-700 border-blue-500/20',
  ON_LEAVE: 'bg-orange-500/15 text-orange-700 border-orange-500/20',
  UNAVAILABLE: 'bg-red-500/15 text-red-700 border-red-500/20',
}

export default async function VAPage() {
  const user = await getCurrentUser()
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL

  const vas = await prisma.vAProfile.findMany({
    include: {
      user: {
        include: {
          memberships: {
            where: { endedAt: null, isPrimary: true },
            include: { department: true },
          },
        },
      },
      vaSkills: { include: { skill: true } },
      assignments: {
        where: { status: 'ACTIVE' },
        include: { client: true },
      },
    },
    orderBy: { user: { firstName: 'asc' } },
  })

  const activeCount = vas.filter((v) => v.isActive).length
  const availableCount = vas.filter((v) => v.availabilityStatus === 'AVAILABLE').length
  const totalAssignments = vas.reduce((s, v) => s + v.assignments.length, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">VA Master List</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Complete roster of all Virtual Assistants with assignments and skills
          </p>
        </div>
        <div className="flex gap-2">
          {isDevMode && (
            <Link href="/vas/new">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add VA
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="card-hover">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total VAs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{vas.length}</p>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
            <div className="h-2 w-2 rounded-full bg-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Available</CardTitle>
            <div className="h-2 w-2 rounded-full bg-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{availableCount}</p>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Assignments</CardTitle>
            <div className="h-2 w-2 rounded-full bg-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalAssignments}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Master List ({vas.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {vas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No VAs in the system yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Rate</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Availability</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Department</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Assignments</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Skills</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vas.map((va) => {
                    const primaryDept = va.user.memberships?.[0]?.department
                    return (
                      <tr
                        key={va.id}
                        className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={(e) => {
                          const target = e.target as HTMLElement
                          if (target.tagName === 'A' || target.closest('a')) return
                          window.location.href = `/vas/${va.id}`
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary shrink-0">
                              {(va.user.firstName || 'V')[0].toUpperCase()}
                            </div>
                            <Link href={`/vas/${va.id}`} className="font-medium hover:text-primary transition-colors">
                              {va.user.firstName} {va.user.lastName}
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{va.user.email}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                          {va.hourlyRate ? `$${Number(va.hourlyRate).toFixed(2)}/hr` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-xs ${AVAILABILITY_COLORS[va.availabilityStatus] || ''}`}>
                            {va.availabilityStatus.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                          {primaryDept ? (
                            <Badge variant="outline" className="text-xs">
                              {primaryDept.name}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {va.assignments.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {va.assignments.map((a) => (
                                <Link key={a.id} href={`/assignments/${a.id}`}>
                                  <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80">
                                    {a.client.name}
                                  </Badge>
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">None</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {va.vaSkills.slice(0, 3).map((s) => (
                              <Badge key={s.id} variant="outline" className={`text-xs ${CATEGORY_COLORS[s.skill.category] || ''}`}>
                                {s.skill.name}
                              </Badge>
                            ))}
                            {va.vaSkills.length > 3 && (
                              <span className="text-xs text-muted-foreground">+{va.vaSkills.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={va.isActive ? 'default' : 'secondary'} className="text-xs">
                            {va.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
