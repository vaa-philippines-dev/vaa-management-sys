import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'

export default async function VAPage() {
  const user = await getCurrentUser()
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL

  const vas = user
    ? await prisma.vAProfile.findMany({
        where: user.department
          ? { user: { department: user.department } }
          : undefined,
        include: { user: true },
        orderBy: { user: { name: 'asc' } },
      })
    : await prisma.vAProfile.findMany({
        include: { user: true },
        orderBy: { user: { name: 'asc' } },
      })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Virtual Assistants</h2>
        {isDevMode && (
          <Link href="/vas/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add VA
            </Button>
          </Link>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {vas.map((va) => (
          <Link key={va.id} href={`/vas/${va.id}`}>
            <Card className="cursor-pointer transition-colors hover:bg-accent">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{va.user.name || va.user.email}</CardTitle>
                  <Badge variant={va.isActive ? 'default' : 'secondary'}>
                    {va.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <p>{va.user.email}</p>
                {va.phone && <p>{va.phone}</p>}
                {va.hourlyRate && <p>${Number(va.hourlyRate).toFixed(2)}/hr</p>}
                <p className="text-xs">{va._count.tasks} tasks assigned</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
