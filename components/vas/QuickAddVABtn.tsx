'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { AddVAModal } from '@/components/vas/AddVAForm'

export function QuickAddVABtn() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setOpen(true)}>
        <Plus className="h-3 w-3" />
        Add VA
      </Button>
      <AddVAModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
