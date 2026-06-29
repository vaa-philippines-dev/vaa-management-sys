import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getPrimaryDepartment, hasModuleAccess } from '@/lib/auth'
import {
  Users,
  UserCog,
  Briefcase,
  DollarSign,
  Clock,
} from 'lucide-react'

const AVAILABILITY_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-green-500/15 text-green-700 border-green-500/20',
  PARTIALLY_ASSIGNED: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/20',
  FULLY_ASSIGNED: 'bg-blue-500/15 text-blue-700 border-blue-500/20',
  ON_LEAVE: 'bg-orange-500/15 text-orange-700 border-orange-500/20',
  UNAVAILABLE: 'bg-red-500/15 text-red-700 border-red-500/20',
}

const EMPLOYMENT_COLORS: Record<string, string> = {
  EMPLOYED: 'bg-green-500/15 text-green-700 border-green-500/20',
  ENGAGED: 'bg-blue-500/15 text-blue-700 border-blue-500/20',
  CONTRACTED: 'bg-purple-500/15 text-purple-700 border-purple-500/20',
  END_OF_CONTRACT: 'bg-orange-500/15 text-orange-700 border-orange-500/20',
  TRANSFERRED: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/20',
  RESIGNED: 'bg-red-500/15 text-red-700 border-red-500/20',
  TERMINATED: 'bg-red-500/15 text-red-700 border-red-500/20',
  BLACKLISTED: 'bg-gray-500/15 text-gray-700 border-gray-500/20',
}

const hrgRoles = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'EXECUTIVE']

export default async function VAPage() {
  const currentUser = await getCurrentUser()
  const isHRE = currentUser ? hrgRoles.includes(currentUser.systemRole) : false

  const vas = await prisma.vAProfile.findMany({
    where: { user: { userType: 'VIRTUAL_ASSISTANT' } },
    include: {
      user: {
        include: {
          profile: true,
          memberships: {
            where: { endedAt: null },
            include: { department: true, position: true },
          },
          employmentRecords: { where: { isCurrent: true }, take: 1 },
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
            {isHRE ? 'HR View — full read & write access' : 'Read-only view'} — {vas.length} VAs
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Users} label="Total VAs" value={vas.length} />
        <StatCard icon={UserCog} label="Active" value={activeCount} />
        <StatCard icon={Clock} label="Available" value={availableCount} />
        <StatCard icon={Briefcase} label="Assignments" value={totalAssignments} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            VA Roster
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left p-3 font-medium text-muted-foreground sticky left-0 bg-muted/40 z-10">Name</th>
                  <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Email</th>
                  <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Dept / Position</th>
                  <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Contract</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Availability</th>
                  <th className="text-left p-3 font-medium text-muted-foreground hidden xl:table-cell">Rate</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Assignments</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      No VAs found.
                    </td>
                  </tr>
                ) : (
                  vas.map((va) => {
                    const emp = va.user.employmentRecords?.[0]
                    const primaryMem = va.user.memberships?.find((m) => m.isPrimary) ?? va.user.memberships?.[0]

                    return (
                      <tr key={va.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 sticky left-0 bg-background z-10">
                          <Link href={`/vas/${va.id}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary shrink-0">
                              {(va.user.firstName || 'V')[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{va.user.firstName} {va.user.lastName}</p>
                              {isHRE && va.user.profile?.gender && (
                                <p className="text-[10px] text-muted-foreground">{va.user.profile.gender}</p>
                              )}
                            </div>
                          </Link>
                        </td>
                        <td className="p-3 text-muted-foreground hidden md:table-cell">
                          <div>
                            <p>{va.user.email}</p>
                            {isHRE && va.user.profile?.whatsappNumber && (
                              <p className="text-[10px]">WA: {va.user.profile.whatsappNumber}</p>
                            )}
                          </div>
                        </td>
                        <td className="p-3 hidden lg:table-cell">
                          {primaryMem ? (
                            <div>
                              <Badge variant="outline" className="text-[10px]">{primaryMem.department.name}</Badge>
                              {primaryMem.position && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">{primaryMem.position.title}</p>
                              )}
                              {va.vaaPosition && (
                                <p className="text-[10px] text-muted-foreground">{va.vaaPosition}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 hidden lg:table-cell">
                          {emp ? (
                            <div>
                              <Badge variant="outline" className={`text-[10px] ${EMPLOYMENT_COLORS[emp.employmentStatus] || ''}`}>
                                {emp.contractType.replace(/_/g, ' ')}
                              </Badge>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Since {new Date(emp.startDate).toLocaleDateString()}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={`text-[10px] ${AVAILABILITY_COLORS[va.availabilityStatus] || ''}`}>
                            {va.availabilityStatus.replace(/_/g, ' ')}
                          </Badge>
                          {va.hybrid && (
                            <Badge variant="outline" className="text-[10px] ml-1 bg-purple-500/15 text-purple-700 border-purple-500/20">Hybrid</Badge>
                          )}
                        </td>
                        <td className="p-3 hidden xl:table-cell">
                          {va.baseRate ? (
                            <p className="font-mono text-[10px]">₱{Number(va.baseRate).toLocaleString()}/hr</p>
                          ) : va.hourlyRate ? (
                            <p className="font-mono text-[10px]">${Number(va.hourlyRate).toFixed(2)}/hr</p>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {va.level && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">Lvl: {va.level}</p>
                          )}
                        </td>
                        <td className="p-3">
                          {va.assignments.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {va.assignments.map((a) => (
                                <Link key={a.id} href={`/assignments/${a.id}`}>
                                  <Badge variant="secondary" className="text-[10px] cursor-pointer hover:bg-secondary/80 max-w-[100px] truncate">
                                    {a.client.name}
                                  </Badge>
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">None</span>
                          )}
                        </td>
                        <td className="p-3">
                          <Link href={`/vas/${va.id}`}>
                            <Button variant="ghost" size="sm" className="text-xs h-7">
                              {isHRE ? 'View / Edit' : 'View'}
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
}) {
  return (
    <Card className="card-hover">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}
