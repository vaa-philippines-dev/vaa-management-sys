'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { LayoutGrid, LayoutList } from 'lucide-react'
import { AssignmentCard, type AssignmentRow } from './AssignmentCard'
import { AssignmentListTable } from './AssignmentListTable'

const VIEW_MODE_STORAGE_KEY = 'assignments-view-mode'

type ViewMode = 'cards' | 'list'

export function AssignmentsBoard({ regular, projects }: { regular: AssignmentRow[]; projects: AssignmentRow[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY)
    if (stored === 'cards' || stored === 'list') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring persisted UI state after mount, unavoidable since localStorage isn't available during SSR
      setViewMode(stored)
    }
  }, [])

  const changeView = (mode: ViewMode) => {
    setViewMode(mode)
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)
  }

  const renderSection = (title: string, rows: AssignmentRow[], emptyLabel: string) => (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        {title} ({rows.length})
      </h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : viewMode === 'cards' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 fade-in-stagger">
          {rows.map((a) => (
            <AssignmentCard key={a.id} a={a} />
          ))}
        </div>
      ) : (
        <AssignmentListTable assignments={rows} />
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-1">
        <div className="inline-flex items-center rounded-md border bg-card p-0.5">
          <Button
            type="button"
            variant={viewMode === 'cards' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-2 gap-1.5 text-xs"
            onClick={() => changeView('cards')}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Cards
          </Button>
          <Button
            type="button"
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-2 gap-1.5 text-xs"
            onClick={() => changeView('list')}
          >
            <LayoutList className="h-3.5 w-3.5" />
            List
          </Button>
        </div>
      </div>

      {renderSection('Regular', regular, 'No regular assignments.')}
      {renderSection('Projects', projects, 'No project assignments.')}
    </div>
  )
}
