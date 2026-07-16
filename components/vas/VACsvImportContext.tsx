'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { bulkImportVAs, type VACsvRow } from '@/app/(dashboard)/vas/actions'

const CHUNK_SIZE = 100

// The same person can appear as multiple rows (department transfers,
// re-engagements) and the server groups a person's rows together to build
// their full EmploymentRecord history. Keep every row for a person in the
// same chunk so that grouping never gets split across separate server calls.
function chunkRowsByPerson(rows: VACsvRow[], chunkSize: number): VACsvRow[][] {
  const personKey = (row: VACsvRow) => {
    const email = (row.email || '').trim().toLowerCase()
    if (email) return `email:${email}`
    const first = (row.firstName || '').trim().toLowerCase()
    const last = (row.lastName || '').trim().toLowerCase()
    return `name:${first}|${last}`
  }

  const groups = new Map<string, VACsvRow[]>()
  const order: string[] = []
  for (const row of rows) {
    const key = personKey(row)
    const existing = groups.get(key)
    if (existing) {
      existing.push(row)
    } else {
      groups.set(key, [row])
      order.push(key)
    }
  }

  const chunks: VACsvRow[][] = []
  let current: VACsvRow[] = []
  for (const key of order) {
    const group = groups.get(key)!
    if (current.length > 0 && current.length + group.length > chunkSize) {
      chunks.push(current)
      current = []
    }
    current.push(...group)
  }
  if (current.length > 0) chunks.push(current)

  return chunks
}

type ImportStatus = 'idle' | 'running' | 'done' | 'cancelled'

type SkippedRow = { row: number; reason: string }

type ImportState = {
  status: ImportStatus
  fileName: string | null
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
  totalRows: 0,
  processedRows: 0,
  created: 0,
  updated: 0,
  skipped: [],
  minimized: false,
  modalOpen: false,
}

type VACsvImportContextValue = {
  state: ImportState
  startImport: (fileName: string, rows: VACsvRow[], overwriteExisting: boolean) => void
  cancelImport: () => void
  minimize: () => void
  restore: () => void
  reset: () => void
  openModal: () => void
  closeModal: () => void
}

const VACsvImportContext = createContext<VACsvImportContextValue | null>(null)

export function VACsvImportProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<ImportState>(initialState)
  const cancelRef = useRef(false)

  const startImport = useCallback((fileName: string, rows: VACsvRow[], overwriteExisting: boolean) => {
    cancelRef.current = false
    setState((prev) => ({
      ...initialState,
      status: 'running',
      fileName,
      totalRows: rows.length,
      modalOpen: prev.modalOpen,
    }))

    ;(async () => {
      const chunks = chunkRowsByPerson(rows, CHUNK_SIZE)
      for (const chunk of chunks) {
        if (cancelRef.current) {
          setState((prev) => ({ ...prev, status: 'cancelled' }))
          return
        }
        try {
          const res = await bulkImportVAs(chunk, overwriteExisting)
          setState((prev) => ({
            ...prev,
            processedRows: prev.processedRows + chunk.length,
            created: prev.created + res.created,
            updated: prev.updated + res.updated,
            skipped: [...prev.skipped, ...res.skipped.map((s) => ({ ...s, row: s.row }))],
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
      toast.success('VA import finished — check the results in the import panel')
    })()
  }, [router])

  const cancelImport = useCallback(() => {
    cancelRef.current = true
  }, [])

  const minimize = useCallback(() => {
    setState((prev) => ({ ...prev, minimized: true, modalOpen: false }))
  }, [])

  const restore = useCallback(() => {
    if (window.location.pathname !== '/vas') {
      router.push('/vas')
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
    <VACsvImportContext.Provider value={{ state, startImport, cancelImport, minimize, restore, reset, openModal, closeModal }}>
      {children}
    </VACsvImportContext.Provider>
  )
}

export function useVACsvImport() {
  const ctx = useContext(VACsvImportContext)
  if (!ctx) throw new Error('useVACsvImport must be used within VACsvImportProvider')
  return ctx
}
