import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Users } from 'lucide-react'

const CATEGORY_COLORS: Record<string, string> = {
  AMAZON: 'bg-orange-500/15 text-orange-700 border-orange-500/20',
  WALMART: 'bg-blue-500/15 text-blue-700 border-blue-500/20',
  TIKTOK_SHOP: 'bg-pink-500/15 text-pink-700 border-pink-500/20',
  SHOPIFY: 'bg-green-500/15 text-green-700 border-green-500/20',
  GENERAL: 'bg-gray-500/15 text-gray-700 border-gray-500/20',
}

export default async function VAPage() {
  const user = await getCurrentUser()
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL

  const vas = await prisma.vAProfile.findMany({
    include: {
      user: true,
      skills: true,
      assignments: { where: { status: 'ACTIVE' } },
    },
    orderBy: { user: { name: 'asc' } },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Virtual Assistants</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Team of VAs with skills and active assignments
          </p>
        </div>
        {isDevMode && (
          <Link href="/vas/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add VA
            </Button>
          </Link>
        )}
      </div>

      {vas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No VAs yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {vas.map((va) => (
            <Link key={va.id} href={`/vas/${va.id}`}>
              <Card className="group cursor-pointer transition-all hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">
                      {va.user.name || va.user.email}
                    </CardTitle>
                    <Badge variant={va.isActive ? 'default' : 'secondary'} className="text-xs">
                      {va.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p className="text-xs">{va.user.email}</p>
                  {va.hourlyRate && (
                    <p className="text-xs font-medium">
                      ${Number(va.hourlyRate).toFixed(2)}/hr
                    </p>
                  )}
                  {va.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {va.skills.slice(0, 3).map((s) => (
                        <Badge key={s.id} variant="outline" className="text-xs">
                          {s.name}
                        </Badge>
                      ))}
                      {va.skills.length > 3 && (
                        <span className="text-xs text-muted-foreground/70">
                          +{va.skills.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground/70 pt-1">
                    {va.assignments.length} active assignment{va.assignments.length === 1 ? '' : 's'}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}