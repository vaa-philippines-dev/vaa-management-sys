'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { bulkImportClients, type ClientCsvRow } from '@/app/(dashboard)/clients/actions'

const CHUNK_SIZE = 100

type ImportStatus = 'idle' | 'running' | 'done' | 'cancelled'

type SkippedRow = { row: number; reason: string }

type ImportState = {
  status: ImportStatus
  fileName: string | null
  departmentName: string | null
  totalRows: number
  processedRows: number
  created: number
  updated: number
  skipped: SkippedRow[]
  minimized: boolean
  modalOpen: boolean
}

const initialState: ImportState = {
  status: 'idle',
  fileName: null,
  departmentName: null,
  totalRows: 0,
  processedRows: 0,
  created: 0,
  updated: 0,
  skipped: [],
  minimized: false,
  modalOpen: false,
}

type ClientCsvImportContextValue = {
  state: ImportState
  startImport: (fileName: string, departmentId: string, departmentName: string, rows: ClientCsvRow[]) => void
  cancelImport: () => void
  minimize: () => void
  restore: () => void
  reset: () => void
  openModal: () => void
  closeModal: () => void
}

const ClientCsvImportContext = createContext<ClientCsvImportContextValue | null>(null)

export function ClientCsvImportProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<ImportState>(initialState)
  const cancelRef = useRef(false)

  const startImport = useCallback((fileName: string, departmentId: string, departmentName: string, rows: ClientCsvRow[]) => {
    cancelRef.current = false
    setState((prev) => ({
      ...initialState,
      status: 'running',
      fileName,
      departmentName,
      totalRows: rows.length,
      modalOpen: prev.modalOpen,
    }))

    ;(async () => {
      const chunks: ClientCsvRow[][] = []
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) chunks.push(rows.slice(i, i + CHUNK_SIZE))

      for (const chunk of chunks) {
        if (cancelRef.current) {
          setState((prev) => ({ ...prev, status: 'cancelled' }))
          return
        }
        try {
          const res = await bulkImportClients(departmentId, chunk)
          setState((prev) => ({
            ...prev,
            processedRows: prev.processedRows + chunk.length,
            created: prev.created + res.created,
            updated: prev.updated + res.updated,
            skipped: [...prev.skipped, ...res.skipped],
          }))
        } catch (e) {
          setState((prev) => ({
            ...prev,
            processedRows: prev.processedRows + chunk.length,
            skipped: [...prev.skipped, { row: -1, reason: e instanceof Error ? e.message : 'Chunk failed' }],
          }))
        }
      }
      if (cancelRef.current) {
        setState((prev) => ({ ...prev, status: 'cancelled' }))
        return
      }
      setState((prev) => ({ ...prev, status: 'done' }))
      router.refresh()
      toast.success('Client import finished — check the results in the import panel')
    })()
  }, [router])

  const cancelImport = useCallback(() => {
    cancelRef.current = true
  }, [])

  const minimize = useCallback(() => {
    setState((prev) => ({ ...prev, minimized: true, modalOpen: false }))
  }, [])

  const restore = useCallback(() => {
    if (window.location.pathname !== '/clients') {
      router.push('/clients')
    }
    setState((prev) => ({ ...prev, minimized: false, modalOpen: true }))
  }, [router])

  const reset = useCallback(() => {
    cancelRef.current = false
    setState((prev) => ({ ...initialState, modalOpen: prev.modalOpen }))
  }, [])

  const openModal = useCallback(() => {
    setState((prev) => ({ ...prev, modalOpen: true, minimized: false }))
  }, [])

  const closeModal = useCallback(() => {
    setState((prev) => ({ ...prev, modalOpen: false }))
  }, [])

  return (
    <ClientCsvImportContext.Provider value={{ state, startImport, cancelImport, minimize, restore, reset, openModal, closeModal }}>
      {children}
    </ClientCsvImportContext.Provider>
  )
}

export function useClientCsvImport() {
  const ctx = useContext(ClientCsvImportContext)
  if (!ctx) throw new Error('useClientCsvImport must be used within ClientCsvImportProvider')
  return ctx
}
