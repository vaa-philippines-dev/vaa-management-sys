'use client'

import { createContext, useContext, useState } from 'react'

type SidebarCollapseContextValue = {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

const SidebarCollapseContext = createContext<SidebarCollapseContextValue | null>(null)

export function SidebarCollapseProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <SidebarCollapseContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </SidebarCollapseContext.Provider>
  )
}

export function useSidebarCollapse() {
  const ctx = useContext(SidebarCollapseContext)
  if (!ctx) throw new Error('useSidebarCollapse must be used within SidebarCollapseProvider')
  return ctx
}
