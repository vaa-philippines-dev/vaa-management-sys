import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { UsersRound, Crown, ShieldHalf, ArrowRight } from 'lucide-react'
import { getDepartmentTeamAssignments } from '@/lib/team-assignments'
import { cached, CACHE_TAGS } from '@/lib/cache'

export async function DepartmentTeamsCard({ deptId }: { deptId: string }) {
  const data = await cached(
    `dashboard:teamAssignments:${deptId}`,
    [CACHE_TAGS.teams, CACHE_TAGS.assignments, CACHE_TAGS.vas, CACHE_TAGS.dashboard],
    60,
    () => getDepartmentTeamAssignments(deptId)
  )

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <UsersRound className="h-4 w-4" />
          Teams
        </CardTitle>
        <Link
          href={`/team-assignment?dept=${deptId}`}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          Team Assignment <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className={data.teams.length === 0 ? undefined : 'p-0'}>
        {data.teams.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No teams in this department yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b bg-muted/50">
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Team</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Leadership</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Active / Idle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.teams.map((t) => (
                <TableRow key={t.teamId} className="border-b">
                  <TableCell className="py-2.5">
                    <Link href={`/teams/${t.teamId}`} className="font-medium hover:underline">
                      {t.teamName}
                    </Link>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className="flex flex-wrap gap-1">
                      <LeaderBadge person={t.leader} icon={Crown} />
                      <LeaderBadge person={t.tempLeader1} icon={ShieldHalf} />
                      <LeaderBadge person={t.tempLeader2} icon={ShieldHalf} />
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 text-right text-sm">
                    {t.counts.active} / {t.counts.idle}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function LeaderBadge({
  person,
  icon: Icon,
}: {
  person: { firstName: string; lastName: string } | null
  icon: React.ComponentType<{ className?: string }>
}) {
  if (!person) return null
  return (
    <Badge variant="outline" className="text-[10px] gap-1">
      <Icon className="h-2.5 w-2.5" />
      {person.firstName}
    </Badge>
  )
}
