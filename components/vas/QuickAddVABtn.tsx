'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Upload } from 'lucide-react'
import { AddVAModal } from '@/components/vas/AddVAForm'
import { useVACsvImport } from '@/components/vas/VACsvImportContext'

export function QuickAddVABtn() {
  const [open, setOpen] = useState(false)
  const { openModal } = useVACsvImport()
  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={openModal}>
          <Upload className="h-3 w-3" />
          Import CSV
        </Button>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setOpen(true)}>
          <Plus className="h-3 w-3" />
          Add VA
        </Button>
      </div>
      <AddVAModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
