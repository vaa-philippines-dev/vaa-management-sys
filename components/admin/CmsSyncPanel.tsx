'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Search, RefreshCw, CheckCircle2 } from 'lucide-react'
import { previewCmsSync, runCmsSync, type CmsSyncPreview } from '@/app/(dashboard)/admin/cms-sync/actions'
import type { CmsSyncSummary } from '@/lib/sync/customers-accounts'

export function CmsSyncPanel() {
  const [preview, setPreview] = useState<CmsSyncPreview | null>(null)
  const [summary, setSummary] = useState<CmsSyncSummary | null>(null)
  const [isPreviewing, startPreview] = useTransition()
  const [isSyncing, startSync] = useTransition()

  const handlePreview = () => {
    setSummary(null)
    startPreview(async () => {
      try {
        const result = await previewCmsSync()
        setPreview(result)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to preview CMS data')
      }
    })
  }

  const handleSync = () => {
    startSync(async () => {
      try {
        const result = await runCmsSync()
        setSummary(result)
        toast.success('CMS sync complete')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to sync from CMS')
      }
    })
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handlePreview} disabled={isPreviewing || isSyncing}>
            {isPreviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Preview
          </Button>
          <Button type="button" size="sm" className="gap-1.5" onClick={handleSync} disabled={isSyncing || isPreviewing}>
            {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {isSyncing ? 'Syncing…' : 'Sync Now'}
          </Button>
        </div>

        {preview && !summary && (
          <div className="text-sm text-muted-foreground">
            Found <span className="font-medium text-foreground">{preview.customerRows}</span> Customer rows and{' '}
            <span className="font-medium text-foreground">{preview.accountRows}</span> Account rows in the CMS sheet right now.
            Click <span className="font-medium text-foreground">Sync Now</span> to import them.
          </div>
        )}

        {summary && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
            <div className="flex items-center gap-1.5 text-success font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Sync complete
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="font-medium text-foreground">Customers</p>
                <p className="text-muted-foreground">{summary.customers.upserted} upserted of {summary.customers.totalRows} rows</p>
                {summary.customers.skippedBlankId > 0 && (
                  <p className="text-muted-foreground">{summary.customers.skippedBlankId} skipped (blank CustomerID)</p>
                )}
              </div>
              <div>
                <p className="font-medium text-foreground">Accounts</p>
                <p className="text-muted-foreground">{summary.accounts.upserted} upserted of {summary.accounts.totalRows} rows</p>
                {summary.accounts.skippedBlankId > 0 && (
                  <p className="text-muted-foreground">{summary.accounts.skippedBlankId} skipped (blank ClientID)</p>
                )}
                {summary.accounts.unresolvedCustomer > 0 && (
                  <p className="text-muted-foreground">{summary.accounts.unresolvedCustomer} with no matching Customer</p>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
