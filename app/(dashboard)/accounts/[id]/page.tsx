import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CUSTOMER_ACCOUNT_STATUS_COLORS } from '@/lib/cms/display'
import { CLIENT_STATUS_LABEL, CLIENT_STATUS_TONE } from '@/lib/clients/display'
import { StatusIndicator } from '@/components/ui/status-indicator'

const ACCOUNTS_VIEW_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE']

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-4 text-sm py-1.5 border-b last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !ACCOUNTS_VIEW_ROLES.includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }

  const { id } = await params
  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true } },
      clientAssignments: { include: { department: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
    },
  })
  if (!account) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/accounts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{account.accountName || account.companyName || 'Untitled Account'}</h2>
            <Badge variant="outline" className={cn('text-xs', account.status ? CUSTOMER_ACCOUNT_STATUS_COLORS[account.status] : '')}>
              {account.status ?? 'Unknown'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {account.customer ? (
              <>Customer: <Link href={`/customers/${account.customer.id}`} className="hover:text-primary transition-colors">{account.customer.name}</Link></>
            ) : 'No linked customer'}
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0 space-y-6">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Client Assignments</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {account.clientAssignments.length === 0 ? (
                <div className="p-8 text-center">
                  <Briefcase className="h-8 w-8 mb-2 opacity-50 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No client assignments linked to this account yet.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b bg-muted/50">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Name</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Department</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {account.clientAssignments.map((ca) => (
                      <TableRow key={ca.id} className="border-b hover:bg-accent/30">
                        <TableCell className="text-sm font-medium">
                          <Link href={`/clients/${ca.id}`} className="hover:text-primary transition-colors">
                            {ca.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{ca.department?.name || '—'}</TableCell>
                        <TableCell>
                          <StatusIndicator tone={ca.onHold ? 'warning' : (CLIENT_STATUS_TONE[ca.status] ?? 'neutral')}>
                            {ca.onHold ? 'On Hold' : (CLIENT_STATUS_LABEL[ca.status] ?? ca.status)}
                          </StatusIndicator>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {account.notes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{account.notes}</CardContent>
            </Card>
          )}
        </div>

        <Card className="w-full lg:w-80 shrink-0 h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Account Details</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow label="Company Name" value={account.companyName} />
            <DetailRow label="Primary Contact" value={account.primaryContact} />
            <DetailRow label="Primary Email" value={account.primaryEmail} />
            <DetailRow label="Secondary Contact" value={account.secondaryContact} />
            <DetailRow label="Category" value={account.category} />
            <DetailRow label="Type" value={account.type} />
            <DetailRow label="Country/Region" value={account.countryRegion} />
            <DetailRow label="Returning" value={account.isReturning === null ? undefined : account.isReturning ? 'Yes' : 'No'} />
            <DetailRow label="Invoice Contact" value={account.invoiceContactName} />
            <DetailRow label="Invoice Email" value={account.invoiceContactEmail} />
            <DetailRow label="Account Managers" value={account.accountManagers} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
