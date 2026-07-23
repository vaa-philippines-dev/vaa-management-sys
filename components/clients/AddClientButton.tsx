'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { AddClientModal, type AddClientDepartmentOption } from '@/components/clients/AddClientModal'

export function AddClientButton({
  departments,
  managerId,
}: {
  departments: AddClientDepartmentOption[]
  managerId: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" className="h-8 gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Add Record
      </Button>
      <AddClientModal departments={departments} managerId={managerId} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
