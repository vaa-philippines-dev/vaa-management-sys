'use client'

import { createContext, useContext, useMemo, useState, useCallback } from 'react'

type UserBulkSelectContextValue = {
  enabled: boolean
  selected: Set<string>
  toggle: (id: string) => void
  isSelected: (id: string) => boolean
  selectAll: (ids: string[]) => void
  clear: () => void
}

const UserBulkSelectContext = createContext<UserBulkSelectContextValue | null>(null)

export function UserBulkSelectProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
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

  return <UserBulkSelectContext.Provider value={value}>{children}</UserBulkSelectContext.Provider>
}

export function useUserBulkSelect() {
  const ctx = useContext(UserBulkSelectContext)
  if (!ctx) throw new Error('useUserBulkSelect must be used within UserBulkSelectProvider')
  return ctx
}
