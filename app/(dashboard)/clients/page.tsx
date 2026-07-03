import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Building2 } from 'lucide-react'

const PLATFORM_META: Record<string, { label: string; color: string }> = {
  AMAZON: { label: 'Amazon', color: 'bg-orange-500/15 text-orange-700 border-orange-500/20' },
  WALMART: { label: 'Walmart', color: 'bg-blue-500/15 text-blue-700 border-blue-500/20' },
  TIKTOK_SHOP: { label: 'TikTok Shop', color: 'bg-pink-500/15 text-pink-700 border-pink-500/20' },
  SHOPIFY: { label: 'Shopify', color: 'bg-green-500/15 text-green-700 border-green-500/20' },
  MULTI: { label: 'Multi-platform', color: 'bg-gray-500/15 text-gray-700 border-gray-500/20' },
}

export default async function ClientsPage() {
  const user = await getCurrentUser()
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL

  const clients = user
    ? await cached('clients:list:user', [CACHE_TAGS.clients], 60, () =>
        prisma.client.findMany({
          where: ['SUPER_ADMIN','SYSTEM_ADMIN','EXECUTIVE','DEPT_MANAGER','STAFF'].includes(user.systemRole) ? { managerId: user.id } : undefined,
          include: {
            assignments: { include: { vaProfile: { include: { user: true } } } },
          },
          orderBy: { createdAt: 'desc' },
        })
      )
    : await cached('clients:list', [CACHE_TAGS.clients], 60, () =>
        prisma.client.findMany({
          include: {
            assignments: { include: { vaProfile: { include: { user: true } } } },
          },
          orderBy: { createdAt: 'desc' },
        })
      )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Clients</h2>
          <p className="text-sm text-muted-foreground mt-1">
            E-commerce sellers and brands receiving VA support
          </p>
        </div>
        {isDevMode && (
          <Link href="/clients/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Client
            </Button>
          </Link>
        )}
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No clients yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 fade-in-stagger">
          {clients.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`}>
              <Card className="group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base font-semibold">{c.name}</CardTitle>
                    <Badge
                      variant="outline"
                      className={`text-xs shrink-0 ${PLATFORM_META[c.platform]?.color ?? ''}`}
                    >
                      {PLATFORM_META[c.platform]?.label ?? c.platform}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  {c.contactName && <p className="text-xs">Contact: {c.contactName}</p>}
                  {c.industry && <p className="text-xs">{c.industry}</p>}
                  {c.requiredSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {c.requiredSkills.slice(0, 3).map((s) => (
                        <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                      {c.requiredSkills.length > 3 && (
                        <span className="text-xs text-muted-foreground/70">+{c.requiredSkills.length - 3}</span>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground/70 pt-1">
                    {c.assignments.length} assignment{c.assignments.length === 1 ? '' : 's'}
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
