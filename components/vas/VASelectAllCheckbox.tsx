'use client'

import { useVABulkSelect } from '@/components/vas/VABulkSelectContext'

export function VASelectAllCheckbox({ ids }: { ids: string[] }) {
  const { enabled, selected, selectAll } = useVABulkSelect()
  if (!enabled) return null

  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id))

  return (
    <input
      type="checkbox"
      checked={allSelected}
      onChange={() => selectAll(ids)}
      aria-label="Select all VAs"
      className="h-3.5 w-3.5 rounded border-input accent-primary cursor-pointer"
    />
  )
}
