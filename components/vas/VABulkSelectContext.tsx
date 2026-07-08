'use client'

import { createContext, useContext, useMemo, useState, useCallback } from 'react'

type VABulkSelectContextValue = {
  enabled: boolean
  selected: Set<string>
  toggle: (id: string) => void
  isSelected: (id: string) => boolean
  selectAll: (ids: string[]) => void
  clear: () => void
}

const VABulkSelectContext = createContext<VABulkSelectContextValue | null>(null)

export function VABulkSelectProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const isSelected = useCallback((id: string) => selected.has(id), [selected])

  const selectAll = useCallback((ids: string[]) => {
    setSelected((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id))
      return allSelected ? new Set() : new Set(ids)
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])

  const value = useMemo(
    () => ({ enabled, selected, toggle, isSelected, selectAll, clear }),
    [enabled, selected, toggle, isSelected, selectAll, clear]
  )

  return <VABulkSelectContext.Provider value={value}>{children}</VABulkSelectContext.Provider>
}

export function useVABulkSelect() {
  const ctx = useContext(VABulkSelectContext)
  if (!ctx) throw new Error('useVABulkSelect must be used within VABulkSelectProvider')
  return ctx
}
