import Link from 'next/link'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { CLIENT_PLATFORM_META, CLIENT_STATUS_LABEL, CLIENT_STATUS_TONE } from '@/lib/clients/display'
import type { ClientCardData } from '@/components/clients/ClientCard'

export function ClientListTable({ clients }: { clients: ClientCardData[] }) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table className="text-xs">
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="px-3 py-2">Name</TableHead>
            <TableHead className="px-3 py-2 hidden sm:table-cell">Contact</TableHead>
            <TableHead className="px-3 py-2 hidden md:table-cell">Industry</TableHead>
            <TableHead className="px-3 py-2">Platform</TableHead>
            <TableHead className="px-3 py-2">Status</TableHead>
            <TableHead className="px-3 py-2 hidden lg:table-cell">Services</TableHead>
            <TableHead className="px-3 py-2 text-right">Assignments</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((c) => (
            <TableRow key={c.id} className="cursor-pointer">
              <TableCell className="px-3 py-2 font-medium">
                <Link href={`/clients/${c.id}`} className="hover:text-primary transition-colors">
                  {c.name}
                </Link>
              </TableCell>
              <TableCell className="px-3 py-2 text-muted-foreground hidden sm:table-cell truncate max-w-[180px]">
                {c.contactName || <span className="text-muted-foreground/50">—</span>}
              </TableCell>
              <TableCell className="px-3 py-2 text-muted-foreground hidden md:table-cell truncate max-w-[160px]">
                {c.industry || <span className="text-muted-foreground/50">—</span>}
              </TableCell>
              <TableCell className="px-3 py-2">
                <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${CLIENT_PLATFORM_META[c.platform]?.color ?? ''}`}>
                  {CLIENT_PLATFORM_META[c.platform]?.label ?? c.platform}
                </Badge>
              </TableCell>
              <TableCell className="px-3 py-2">
                <StatusIndicator tone={c.onHold ? 'warning' : (CLIENT_STATUS_TONE[c.status] ?? 'neutral')}>
                  {c.onHold ? 'On Hold' : (CLIENT_STATUS_LABEL[c.status] ?? c.status)}
                </StatusIndicator>
              </TableCell>
              <TableCell className="px-3 py-2 hidden lg:table-cell">
                {c.requiredSkills.length > 0 ? (
                  <div className="flex flex-wrap gap-1 max-w-[220px]">
                    {c.requiredSkills.slice(0, 2).map((s) => (
                      <Badge key={s} variant="outline" className="text-[10px] py-0 px-1.5">{s}</Badge>
                    ))}
                    {c.requiredSkills.length > 2 && (
                      <span className="text-[10px] text-muted-foreground/70">+{c.requiredSkills.length - 2}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground/50">—</span>
                )}
              </TableCell>
              <TableCell className="px-3 py-2 text-right text-muted-foreground">
                {c.assignments.length}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
