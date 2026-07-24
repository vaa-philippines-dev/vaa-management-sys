import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FilterBar } from '@/components/filters/FilterBar'
import { Pagination } from '@/components/ui/pagination'
import { Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CUSTOMER_ACCOUNT_STATUS_COLORS } from '@/lib/cms/display'

const CUSTOMERS_VIEW_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE']
const PAGE_SIZE = 30
const DEFAULT_STATUS = 'ACTIVE'

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !CUSTOMERS_VIEW_ROLES.includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : undefined
  const status = typeof params.status === 'string' ? params.status : DEFAULT_STATUS
  const page = Math.max(1, parseInt(typeof params.page === 'string' ? params.page : '1', 10) || 1)

  const where: Record<string, unknown> = {}
  if (status === 'ACTIVE') where.status = { not: 'Terminated' }
  else if (status !== 'ALL') where.status = status
  if (q) where.name = { contains: q, mode: 'insensitive' }

  const [customers, totalCount, statusGroups] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: { _count: { select: { accounts: true } } },
      orderBy: { name: 'asc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.customer.count({ where }),
    prisma.customer.groupBy({ by: ['status'], _count: true, orderBy: { status: 'asc' } }),
  ])

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const buildHref = (targetPage: number) => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (status !== DEFAULT_STATUS) sp.set('status', status)
    if (targetPage > 1) sp.set('page', String(targetPage))
    return `?${sp.toString()}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Building2 className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-bold tracking-tight">Customers</h2>
          <p className="text-xs text-muted-foreground">Mirrored from the CMS · {totalCount} shown</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <FilterBar
          filters={[
            {
              key: 'status',
              label: 'Status',
              defaultValue: DEFAULT_STATUS,
              options: [
                { value: 'ACTIVE', label: 'Active (hide Terminated)' },
                { value: 'ALL', label: 'All' },
                ...statusGroups.filter((g) => g.status).map((g) => ({ value: g.status as string, label: `${g.status} (${g._count})` })),
              ],
            },
          ]}
          searchPlaceholder="Search customer name..."
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {customers.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No customers found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b bg-muted/50">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Specialist</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Accounts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id} className="border-b hover:bg-accent/30">
                    <TableCell className="text-sm font-medium">
                      <Link href={`/customers/${c.id}`} className="hover:text-primary transition-colors">
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-[10px]', c.status ? CUSTOMER_ACCOUNT_STATUS_COLORS[c.status] : '')}>
                        {c.status ?? '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.assignedSpecialist || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground text-right">{c._count.accounts}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Pagination page={page} pageCount={pageCount} buildHref={buildHref} />
    </div>
  )
}
