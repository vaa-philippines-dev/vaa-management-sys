'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'
import { AssignmentEditModal, type AssignmentEditData } from '@/components/assignments/AssignmentEditModal'

export function AssignmentEditButton({ assignment }: { assignment: AssignmentEditData }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5 mr-1.5" />
        Edit
      </Button>
      {open && <AssignmentEditModal assignment={assignment} open={open} onClose={() => setOpen(false)} />}
    </>
  )
}
