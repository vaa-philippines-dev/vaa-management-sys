import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StructureCard } from '@/components/departments/StructureCard'
import { Crown, Cog, ShieldHalf, ArrowRight } from 'lucide-react'
import { getDepartmentStructure } from '@/lib/structure'
import { cached, CACHE_TAGS } from '@/lib/cache'

export async function DepartmentStructureCard({ deptId }: { deptId: string }) {
  const structure = await cached(
    `dashboard:structure:${deptId}`,
    [CACHE_TAGS.departments, CACHE_TAGS.users, CACHE_TAGS.teams, CACHE_TAGS.dashboard],
    60,
    () => getDepartmentStructure(deptId)
  )

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Crown className="h-4 w-4" />
          Structure
        </CardTitle>
        <Link href={`/departments/${deptId}`} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          Full structure <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        <StructureCard label="Dept Manager" people={structure.deptManagers} icon={Crown} />
        <StructureCard label="Ops Manager" people={structure.opsManagers} icon={Cog} />
        <StructureCard
          label={`Team Leaders (${structure.teamLeaders.length})`}
          people={structure.teamLeaders.slice(0, 3)}
          icon={ShieldHalf}
        />
      </CardContent>
    </Card>
  )
}
