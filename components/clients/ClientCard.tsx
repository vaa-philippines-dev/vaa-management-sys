import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const PLATFORM_META: Record<string, { label: string; color: string }> = {
  AMAZON: { label: 'Amazon', color: 'bg-orange-500/15 text-orange-700 border-orange-500/20' },
  WALMART: { label: 'Walmart', color: 'bg-blue-500/15 text-blue-700 border-blue-500/20' },
  TIKTOK_SHOP: { label: 'TikTok Shop', color: 'bg-pink-500/15 text-pink-700 border-pink-500/20' },
  SHOPIFY: { label: 'Shopify', color: 'bg-green-500/15 text-green-700 border-green-500/20' },
  MULTI: { label: 'Multi-platform', color: 'bg-gray-500/15 text-gray-700 border-gray-500/20' },
}

export type ClientCardData = {
  id: string
  name: string
  platform: string
  contactName: string | null
  industry: string | null
  requiredSkills: string[]
  assignments: unknown[]
}

export function ClientCard({ c }: { c: ClientCardData }) {
  return (
    <Link href={`/clients/${c.id}`}>
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
  )
}
