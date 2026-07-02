import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  Building2,
  Users,
  Briefcase,
  Shield,
  ArrowRight,
  LayoutDashboard,
} from 'lucide-react'

const departmentIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  HR: Users,
  Operations: Briefcase,
  Admin: Shield,
  default: Building2,
}

export default async function DepartmentsPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const departments = await prisma.department.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: { select: { memberships: true, clients: true } },
    },
  })

  const parentDepts = departments.filter((d) => d.isParent)
  const childDepts = departments.filter((d) => !d.isParent)

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Select Department View</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a department to manage. You can switch views anytime.
        </p>
      </div>

      {parentDepts.length === 0 && childDepts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              No departments configured yet. Create departments from the Admin Panel.
            </p>
            <Link href="/admin/users">
              <Button>Go to Admin Panel</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {parentDepts.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Main Departments</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {parentDepts.map((dept) => (
              <DepartmentCard key={dept.id} department={dept} />
            ))}
          </div>
        </div>
      )}

      {childDepts.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Sub-Departments & Teams</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {childDepts.map((dept) => (
              <DepartmentCard key={dept.id} department={dept} />
            ))}
          </div>
        </div>
      )}

      <div className="border-t pt-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Management Views</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link href="/dashboard">
            <Card className="hover:shadow-md transition-all cursor-pointer border-primary/30 bg-primary/5">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium">Full Dashboard</CardTitle>
                <LayoutDashboard className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Company-wide overview of all departments, clients, and VAs</p>
              </CardContent>
            </Card>
          </Link>

          {['SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(user.systemRole) && (
            <Link href="/admin/users">
              <Card className="hover:shadow-md transition-all cursor-pointer border-muted">
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-medium">Admin Panel</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Manage users, departments, and system settings</p>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function DepartmentCard({
  department,
}: {
  department: {
    id: string
    name: string
    description: string | null
    _count: { memberships: number; clients: number }
  }
}) {
  const Icon = departmentIcons[department.name] ?? departmentIcons.default

  return (
    <Link href={`/dashboard?dept=${department.id}`}>
      <Card className="card-hover group">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-medium group-hover:text-primary transition-colors">
            {department.name}
          </CardTitle>
          <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </CardHeader>
        <CardContent>
          {department.description && (
            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
              {department.description}
            </p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {department._count.memberships} members
            </span>
            <span className="flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              {department._count.clients} clients
            </span>
          </div>
          <div className="flex items-center justify-end mt-3">
            <span className="text-xs text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              Enter <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
