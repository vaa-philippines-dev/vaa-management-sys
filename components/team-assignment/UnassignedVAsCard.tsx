import Link from 'next/link'
import { UsersRound } from 'lucide-react'
import { MemberRow } from './TeamAssignmentCard'
import type { TeamMemberAssignmentRow } from '@/lib/team-assignments'

// VAs actively in the department but on no active team roster — invisible on
// /teams today, so surfaced here as its own bucket.
export function UnassignedVAsCard({ members }: { members: TeamMemberAssignmentRow[] }) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/20">
        <div className="flex items-center gap-2">
          <UsersRound className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Unassigned VAs ({members.length})</span>
        </div>
        <Link href="/teams" className="text-xs text-muted-foreground hover:text-primary transition-colors">
          Add to a team →
        </Link>
      </div>
      <div className="divide-y">
        {members.map((m) => (
          <MemberRow key={m.userId} member={m} />
        ))}
      </div>
    </div>
  )
}
