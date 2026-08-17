import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ResignationIntakeForm } from '@/components/resign/ResignationIntakeForm'

export default async function ResignPage() {
  const departments = await prisma.department.findMany({
    where: { level: 'SERVICE', status: 'ACTIVE' },
    select: { id: true, name: true, shortName: true },
    orderBy: { sortOrder: 'asc' },
  })

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Report a Resignation</CardTitle>
          <CardDescription>
            For Team Leaders and Department Managers — no account or login needed. HR will follow up from here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResignationIntakeForm departments={departments.map((d) => ({ id: d.id, name: d.shortName || d.name }))} />
        </CardContent>
      </Card>
    </div>
  )
}
