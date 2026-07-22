'use client'

import { Loader2, X, Maximize2, CheckCircle2 } from 'lucide-react'
import { useClientCsvImport } from '@/components/clients/ClientCsvImportContext'

export function ClientCsvImportFloatingWidget() {
  const { state, restore, cancelImport, reset } = useClientCsvImport()

  const isRunning = state.status === 'running'
  const isDone = state.status === 'done' || state.status === 'cancelled'

  if (!state.minimized || (!isRunning && !isDone)) return null

  const pct = state.totalRows > 0 ? Math.round((state.processedRows / state.totalRows) * 100) : 0

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 rounded-xl border bg-card shadow-2xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
          )}
          <p className="text-xs font-medium truncate">
            {isRunning ? `Importing Clients ${pct}%` : state.status === 'cancelled' ? 'Import cancelled' : 'Import finished'}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={restore}
            className="p-1 hover:bg-accent rounded"
            aria-label="Show import"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={isRunning ? cancelImport : reset}
            className="p-1 hover:bg-accent rounded"
            aria-label={isRunning ? 'Cancel import' : 'Dismiss'}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${isDone ? (state.status === 'cancelled' ? 'bg-warning' : 'bg-success') : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground truncate">
        {state.fileName}{state.departmentName ? ` · ${state.departmentName}` : ''} · {state.processedRows}/{state.totalRows} rows
        {isDone && ` · ${state.created} created${state.updated > 0 ? `, ${state.updated} updated` : ''}`}
      </p>
    </div>
  )
}
