'use client'

import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import { useClientCsvImport } from '@/components/clients/ClientCsvImportContext'

export function ImportClientCsvButton() {
  const { openModal } = useClientCsvImport()
  return (
    <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={openModal}>
      <Upload className="h-3.5 w-3.5" />
      Import CSV
    </Button>
  )
}
