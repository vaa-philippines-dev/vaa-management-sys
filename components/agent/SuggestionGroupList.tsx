'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SuggestionGroupCard, type SuggestionGroup } from './SuggestionGroupCard'

export function SuggestionGroupList({
  groups,
  canDecide,
  initiallyOpen,
}: {
  groups: SuggestionGroup[]
  canDecide: boolean
  initiallyOpen: boolean
}) {
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.key, initiallyOpen]))
  )
  const allOpen = groups.every((g) => openMap[g.key] ?? initiallyOpen)

  const toggleAll = () => {
    const next = !allOpen
    setOpenMap(Object.fromEntries(groups.map((g) => [g.key, next])))
  }

  return (
    <div className="space-y-3">
      {groups.length > 1 && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={toggleAll}>
            {allOpen ? 'Collapse all' : 'Expand all'}
          </Button>
        </div>
      )}
      {groups.map((group) => (
        <SuggestionGroupCard
          key={group.key}
          group={group}
          canDecide={canDecide}
          open={openMap[group.key] ?? initiallyOpen}
          onToggle={() => setOpenMap((prev) => ({ ...prev, [group.key]: !(prev[group.key] ?? initiallyOpen) }))}
        />
      ))}
    </div>
  )
}
