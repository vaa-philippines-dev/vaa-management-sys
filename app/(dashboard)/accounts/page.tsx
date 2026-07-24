import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FilterBar } from '@/components/filters/FilterBar'
import { Pagination } from '@/components/ui/pagination'
import { IdCard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CUSTOMER_ACCOUNT_STATUS_COLORS } from '@/lib/cms/display'

const ACCOUNTS_VIEW_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE']
const PAGE_SIZE = 30
const DEFAULT_STATUS = 'ACTIVE'

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !ACCOUNTS_VIEW_ROLES.includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : undefined
  const status = typeof params.status === 'string' ? params.status : DEFAULT_STATUS
  const page = Math.max(1, parseInt(typeof params.page === 'string' ? params.page : '1', 10) || 1)

  const where: Record<string, unknown> = {}
  if (status === 'ACTIVE') where.status = { not: 'Terminated' }
  else if (status !== 'ALL') where.status = status
  if (q) {
    where.OR = [
      { accountName: { contains: q, mode: 'insensitive' } },
      { companyName: { contains: q, mode: 'insensitive' } },
      { customerName: { contains: q, mode: 'insensitive' } },
    ]
  }

  const [accounts, totalCount, statusGroups] = await Promise.all([
    prisma.account.findMany({
      where,
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { accountName: 'asc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.account.count({ where }),
    prisma.account.groupBy({ by: ['status'], _count: true, orderBy: { status: 'asc' } }),
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
        <IdCard className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-bold tracking-tight">Accounts</h2>
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
          searchPlaceholder="Search account, company, or customer..."
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {accounts.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No accounts found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b bg-muted/50">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Account</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Company</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Customer</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Category</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Country</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id} className="border-b hover:bg-accent/30">
                    <TableCell className="text-sm font-medium">
                      <Link href={`/accounts/${a.id}`} className="hover:text-primary transition-colors">
                        {a.accountName || '—'}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.companyName || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.customer ? (
                        <Link href={`/customers/${a.customer.id}`} className="hover:text-primary transition-colors">
                          {a.customer.name}
                        </Link>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{[a.category, a.type].filter(Boolean).join(' · ') || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.countryRegion || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-[10px]', a.status ? CUSTOMER_ACCOUNT_STATUS_COLORS[a.status] : '')}>
                        {a.status ?? '—'}
                      </Badge>
                    </TableCell>
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
