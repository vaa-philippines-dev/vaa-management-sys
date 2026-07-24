import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, IdCard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CUSTOMER_ACCOUNT_STATUS_COLORS } from '@/lib/cms/display'

const CUSTOMERS_VIEW_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE']

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !CUSTOMERS_VIEW_ROLES.includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }

  const { id } = await params
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { accounts: { orderBy: { accountName: 'asc' } } },
  })
  if (!customer) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/customers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{customer.name}</h2>
            <Badge variant="outline" className={cn('text-xs', customer.status ? CUSTOMER_ACCOUNT_STATUS_COLORS[customer.status] : '')}>
              {customer.status ?? 'Unknown'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {customer.assignedSpecialist && `Specialist: ${customer.assignedSpecialist} · `}
            {customer.accounts.length} account{customer.accounts.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {customer.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center gap-2">
          <IdCard className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Accounts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {customer.accounts.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No accounts for this customer.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b bg-muted/50">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Account</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Company</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Category</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Country</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.accounts.map((a) => (
                  <TableRow key={a.id} className="border-b hover:bg-accent/30">
                    <TableCell className="text-sm font-medium">
                      <Link href={`/accounts/${a.id}`} className="hover:text-primary transition-colors">
                        {a.accountName || '—'}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.companyName || '—'}</TableCell>
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
    </div>
  )
}
