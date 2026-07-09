'use client'

import { useUserBulkSelect } from '@/components/admin/UserBulkSelectContext'

export function UserSelectAllCheckbox({ ids }: { ids: string[] }) {
  const { enabled, selected, selectAll } = useUserBulkSelect()
  if (!enabled) return null

  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id))

  return (
    <input
      type="checkbox"
      checked={allSelected}
      onChange={() => selectAll(ids)}
      aria-label="Select all users"
      className="h-3.5 w-3.5 rounded border-input accent-primary cursor-pointer"
    />
  )
}
