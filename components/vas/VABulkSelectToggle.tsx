'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ListChecks, X } from 'lucide-react'
import { VABulkSelectProvider } from '@/components/vas/VABulkSelectContext'
import { VABulkActionBar } from '@/components/vas/VABulkActionBar'

export function VABulkSelectToggle({
  headerActions,
  extraActions,
  children,
}: {
  headerActions?: React.ReactNode
  extraActions?: React.ReactNode
  children: React.ReactNode
}) {
  const [enabled, setEnabled] = useState(false)

  return (
    <VABulkSelectProvider enabled={enabled}>
      <div className="flex items-center justify-between">
        {headerActions}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={enabled ? 'secondary' : 'outline'}
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setEnabled((v) => !v)}
          >
            {enabled ? <X className="h-3.5 w-3.5" /> : <ListChecks className="h-3.5 w-3.5" />}
            {enabled ? 'Cancel Select' : 'Select'}
          </Button>
          {extraActions}
        </div>
      </div>
      <div className="space-y-3 mt-3">{children}</div>
      {enabled && <VABulkActionBar onDone={() => setEnabled(false)} />}
    </VABulkSelectProvider>
  )
}
