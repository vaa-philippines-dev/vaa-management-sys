import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { GitBranch, ArrowLeft, AlertCircle } from 'lucide-react'
import { SplitWizard } from '@/components/admin/SplitWizard'
import { getSplitDetails } from '@/app/(dashboard)/admin/users/actions'
import { LEVEL_RECORD_NAMES } from '@/lib/departments'

const hrgRoles = ['SUPER_ADMIN', 'SYSTEM_ADMIN']

export default async function SplitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const currentUser = await getCurrentUser()
  if (!currentUser || !hrgRoles.includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }

  const source = await prisma.department.findUnique({ where: { id } })
  if (!source) notFound()
  if (source.status !== 'ACTIVE' || LEVEL_RECORD_NAMES.includes(source.name)) {
    return (
      <div className="space-y-4">
        <Link href="/admin/departments" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 w-fit">
          <ArrowLeft className="h-3 w-3" /> Back to departments
        </Link>
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-orange-500 mx-auto" />
            <p className="text-sm font-medium">Cannot split this department</p>
            <p className="text-xs text-muted-foreground">
              {LEVEL_RECORD_NAMES.includes(source.name)
                ? 'System Level records cannot be split.'
                : `This department has status "${source.status}". Only ACTIVE departments can be split.`}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const details = await getSplitDetails(id)
  const parentOptions = await prisma.department.findMany({
    where: { status: 'ACTIVE', id: { not: id }, name: { notIn: LEVEL_RECORD_NAMES } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  return (
    <div className="space-y-4">
      <Link href="/admin/departments" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 w-fit">
        <ArrowLeft className="h-3 w-3" /> Back to departments
      </Link>

      <div className="flex items-center gap-3">
        <GitBranch className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-bold tracking-tight">Split Department</h2>
          <p className="text-xs text-muted-foreground">
            Split <span className="font-semibold text-foreground">{source.name}</span> into 2 or more new departments. Distribute members, clients, and sub-departments among the new ones.
          </p>
        </div>
      </div>

      <SplitWizard source={details.source} memberships={details.memberships} clients={details.clients} subDepartments={details.children} services={details.services} parentOptions={parentOptions} />
    </div>
  )
}
