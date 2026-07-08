'use client'

import { useVABulkSelect } from '@/components/vas/VABulkSelectContext'

export function VARowCheckbox({ id }: { id: string }) {
  const { enabled, isSelected, toggle } = useVABulkSelect()
  if (!enabled) return null

  return (
    <input
      type="checkbox"
      checked={isSelected(id)}
      onChange={(e) => {
        e.stopPropagation()
        toggle(id)
      }}
      onClick={(e) => e.stopPropagation()}
      aria-label="Select VA"
      className="h-3.5 w-3.5 rounded border-input accent-primary cursor-pointer"
    />
  )
}
