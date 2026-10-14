'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { UserRoundX } from 'lucide-react'
import { CLIENT_PLATFORM_META, clientCompanyName, clientDisplayName } from '@/lib/clients/display'
import { clientStatusLabel, clientStatusTone, type ClientCardData } from '@/components/clients/ClientCard'
import { ClientRequestActions } from '@/components/clients/ClientRequestActions'

export function ClientListTable({ clients, canManage = false }: { clients: ClientCardData[]; canManage?: boolean }) {
  const router = useRouter()
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table className="text-xs">
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="px-3 py-2">Name</TableHead>
            <TableHead className="px-3 py-2 hidden sm:table-cell">Company</TableHead>
            <TableHead className="px-3 py-2 hidden md:table-cell">Category / Niche</TableHead>
            <TableHead className="px-3 py-2">Platform</TableHead>
            <TableHead className="px-3 py-2">Status</TableHead>
            <TableHead className="px-3 py-2 hidden md:table-cell">Active VAs</TableHead>
            <TableHead className="px-3 py-2 hidden lg:table-cell">Services</TableHead>
            <TableHead className="px-3 py-2 hidden sm:table-cell whitespace-nowrap">Date Added</TableHead>
            <TableHead className="px-3 py-2 text-right">Assignments</TableHead>
            {canManage && <TableHead className="px-3 py-2 w-0" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((c) => (
            <TableRow
              key={c.id}
              className="cursor-pointer"
              onClick={(e) => {
                // Let real links (and modifier-clicks on them) behave normally,
                // and keep the actions menu (and its dialogs) from opening the row.
                if (!e.currentTarget.contains(e.target as Node)) return
                if ((e.target as HTMLElement).closest('a, button, [data-row-actions]')) return
                router.push(`/clients/${c.id}`)
              }}
            >
              <TableCell className="px-3 py-2 font-medium">
                <Link href={`/clients/${c.id}`} className="hover:text-primary transition-colors">
                  {clientDisplayName(c)}
                </Link>
              </TableCell>
              <TableCell className="px-3 py-2 text-muted-foreground hidden sm:table-cell truncate max-w-[220px]">
                {clientCompanyName(c) || <span className="text-muted-foreground/50">—</span>}
              </TableCell>
              <TableCell className="px-3 py-2 text-muted-foreground hidden md:table-cell max-w-[240px]">
                {c.category || c.niche ? (
                  <div className="flex flex-col gap-0.5">
                    {c.category && <span className="truncate">{c.category}</span>}
                    {c.niche && <span className="truncate text-muted-foreground/70">{c.niche}</span>}
                  </div>
                ) : (
                  <span className="text-muted-foreground/50">—</span>
                )}
              </TableCell>
              <TableCell className="px-3 py-2">
                <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${CLIENT_PLATFORM_META[c.platform]?.color ?? ''}`}>
                  {CLIENT_PLATFORM_META[c.platform]?.label ?? c.platform}
                </Badge>
              </TableCell>
              <TableCell className="px-3 py-2 whitespace-nowrap">
                <StatusIndicator tone={clientStatusTone(c)}>{clientStatusLabel(c)}</StatusIndicator>
              </TableCell>
              <TableCell className="px-3 py-2 hidden md:table-cell max-w-[260px]">
                {c.activeVAs.length === 0 ? (
                  <span className="inline-flex items-center gap-1 text-warning">
                    <UserRoundX className="h-3 w-3" />
                    None
                  </span>
                ) : (
                  <span className="line-clamp-2 text-muted-foreground" title={c.activeVAs.map((v) => v.name).join(', ')}>
                    {c.activeVAs.map((v) => v.name).join(', ')}
                  </span>
                )}
              </TableCell>
              <TableCell className="px-3 py-2 hidden lg:table-cell">
                {c.requiredSkills.length > 0 ? (
                  <div className="flex flex-wrap gap-1 max-w-[260px]">
                    {c.requiredSkills.slice(0, 3).map((s) => (
                      <Badge key={s} variant="outline" className="text-[10px] py-0 px-1.5">{s}</Badge>
                    ))}
                    {c.requiredSkills.length > 3 && (
                      <span className="text-[10px] text-muted-foreground/70" title={c.requiredSkills.slice(3).join(', ')}>
                        +{c.requiredSkills.length - 3}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground/50">—</span>
                )}
              </TableCell>
              <TableCell className="px-3 py-2 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                {c.dateAdded}
              </TableCell>
              <TableCell className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                {c.assignmentCount}
              </TableCell>
              {canManage && (
                <TableCell className="px-3 py-2" data-row-actions>
                  <ClientRequestActions
                    client={{ id: c.id, name: clientDisplayName(c), status: c.status, assignmentCount: c.assignmentCount, openAssignmentCount: c.openAssignmentCount }}
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
