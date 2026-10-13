'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ExternalLink, FileText, Plus, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OFFBOARDING_DOCUMENT_SUGGESTIONS } from '@/lib/offboarding'
import { addOffboardingDocument, removeOffboardingDocument } from '@/app/(dashboard)/offboarding/actions'

export type OffboardingDocument = {
  id: string
  label: string
  url: string
  addedByName: string | null
  createdAt: string
}

// Proof for the case — client confirmation, EOC notice, turnover notes — as
// links (Drive or any URL).
export function OffboardingDocumentsCard({
  terminationId,
  documents,
  canEdit,
}: {
  terminationId: string
  documents: OffboardingDocument[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [isPending, startTransition] = useTransition()

  const onAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await addOffboardingDocument(terminationId, formData)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success('Document added')
      setAdding(false)
      router.refresh()
    })
  }

  const onRemove = (doc: OffboardingDocument) => {
    if (!confirm(`Remove "${doc.label}" from this case?`)) return
    startTransition(async () => {
      const res = await removeOffboardingDocument(doc.id)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success('Document removed')
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Documents</CardTitle>
        {canEdit && !adding && (
          <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add link
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {adding && (
          <form onSubmit={onAdd} className="space-y-3 rounded-lg border p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="doc-label">Name</Label>
                <Input
                  id="doc-label"
                  name="label"
                  list="offboarding-doc-suggestions"
                  required
                  autoFocus
                  placeholder="e.g. Client confirmation"
                  className="h-9"
                />
                <datalist id="offboarding-doc-suggestions">
                  {OFFBOARDING_DOCUMENT_SUGGESTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-url">Link</Label>
                <Input id="doc-url" name="url" type="url" required placeholder="https://drive.google.com/…" className="h-9" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setAdding(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? 'Adding…' : 'Add'}
              </Button>
            </div>
          </form>
        )}

        {documents.length === 0 ? (
          !adding && <p className="text-muted-foreground">No documents attached yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium hover:text-primary"
                  >
                    {d.label}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                  <p className="text-xs text-muted-foreground">
                    Added {format(new Date(d.createdAt), 'MMM dd, yyyy')}
                    {d.addedByName ? ` by ${d.addedByName}` : ''}
                  </p>
                </div>
                {canEdit && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => onRemove(d)}
                    disabled={isPending}
                    aria-label={`Remove ${d.label}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
