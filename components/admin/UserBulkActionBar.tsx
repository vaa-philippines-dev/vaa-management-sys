'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useUserBulkSelect } from '@/components/admin/UserBulkSelectContext'
import { bulkDeleteUsers } from '@/app/(dashboard)/admin/users/actions'

const CONFIRM_WORD = 'CONFIRM'

export function UserBulkActionBar({ onDone }: { onDone: () => void }) {
  const { selected, clear } = useUserBulkSelect()
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  const count = selected.size
  if (count === 0) return null

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const result = await bulkDeleteUsers(Array.from(selected))
      if (result.deleted > 0) {
        toast.success(`Permanently deleted ${result.deleted} user${result.deleted === 1 ? '' : 's'}`)
      }
      if (result.failed.length > 0) {
        toast.error(`Failed to delete ${result.failed.length} user${result.failed.length === 1 ? '' : 's'}`)
      }
      setModalOpen(false)
      setConfirmText('')
      clear()
      onDone()
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete users')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-lg border bg-background shadow-2xl px-4 py-2.5">
        <span className="text-xs font-medium">{count} selected</span>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setModalOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clear}>
          Clear
        </Button>
      </div>

      <Modal
        open={modalOpen}
        onOpenChange={(open) => {
          if (!deleting) {
            setModalOpen(open)
            if (!open) setConfirmText('')
          }
        }}
        title="Permanently delete selected users?"
        description={`This will permanently delete ${count} user${count === 1 ? '' : 's'} and all associated records. This action cannot be undone.`}
        size="sm"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setModalOpen(false)
                setConfirmText('')
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={handleDelete}
              disabled={deleting || confirmText !== CONFIRM_WORD}
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete {count} User{count === 1 ? '' : 's'}
            </Button>
          </>
        }
      >
        <p className="text-xs text-muted-foreground mb-2">
          Type <span className="font-mono font-semibold text-foreground">{CONFIRM_WORD}</span> below to proceed.
        </p>
        <input
          autoFocus
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={CONFIRM_WORD}
          className="w-full px-3 py-1.5 text-xs border rounded-md bg-background h-8 font-mono"
          disabled={deleting}
        />
      </Modal>
    </>
  )
}
