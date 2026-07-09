'use client'

import { useUserBulkSelect } from '@/components/admin/UserBulkSelectContext'

export function UserRowCheckbox({ id }: { id: string }) {
  const { enabled, isSelected, toggle } = useUserBulkSelect()
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
      aria-label="Select user"
      className="h-3.5 w-3.5 rounded border-input accent-primary cursor-pointer"
    />
  )
}
