'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createConcern, updateConcern, deleteConcern } from '@/app/(dashboard)/va-concerns/actions'
import {
  CONCERN_CATEGORIES,
  CONCERN_STATUS_LABELS,
  CONCERN_TAXONOMY,
  ESCALATION_LABELS,
  ESCALATION_STATUS_OPTIONS,
  formatConcernNumber,
  type ConcernRow,
  type ConcernVaOption,
} from '@/lib/va-concerns-fields'

const OTHER = '__other'
const NO_CLIENT = ''

function todayInput() {
  const now = new Date()
  // The Philippines is UTC+8; "today" there is what a Team Leader means.
  return new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 10)
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 border-t pt-4 first:border-t-0 first:pt-0">
      <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</legend>
      {hint && <p className="-mt-1 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </fieldset>
  )
}

export function ConcernModal({
  concern,
  vaOptions,
  onClose,
  onSaved,
}: {
  concern: ConcernRow | null
  vaOptions: ConcernVaOption[]
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const isNew = concern === null
  // A new concern starts with the concern itself; the manager and escalation
  // columns are filled in afterwards, from the saved row.
  const perms = concern?.permissions ?? { canEditConcern: true, canEditManagerFields: false, canDelete: false }
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [vaKey, setVaKey] = useState<string>('')
  const [vaSearch, setVaSearch] = useState('')
  const selectedVa = vaOptions.find((o) => o.key === vaKey) ?? null

  const initialCategory = concern?.category ?? ''
  const categoryIsKnown = !initialCategory || CONCERN_CATEGORIES.includes(initialCategory)
  const [category, setCategory] = useState(categoryIsKnown ? initialCategory : OTHER)
  const [categoryOther, setCategoryOther] = useState(categoryIsKnown ? '' : initialCategory)

  const concernVa = concern
    ? vaOptions.find((o) => o.vaProfileId === concern.vaProfileId && o.departmentId === concern.departmentId)
    : selectedVa
  const clientOptions = (concernVa?.clients ?? []).filter((c) => c.id !== concern?.clientId)
  const [clientChoice, setClientChoice] = useState<string>(
    concern ? (concern.clientId ?? (concern.clientName ? OTHER : NO_CLIENT)) : NO_CLIENT
  )
  const [clientOther, setClientOther] = useState(concern && !concern.clientId ? (concern.clientName ?? '') : '')

  const [status, setStatus] = useState(concern?.status ?? 'PENDING')
  const [escalatedTo, setEscalatedTo] = useState(concern?.escalatedTo ?? '')

  const matchingVas = useMemo(() => {
    const q = vaSearch.trim().toLowerCase()
    const list = q ? vaOptions.filter((o) => o.name.toLowerCase().includes(q)) : vaOptions
    return list.slice(0, 40)
  }, [vaOptions, vaSearch])

  const editable = perms.canEditConcern
  const managerEditable = perms.canEditManagerFields
  const showEscalation = managerEditable || !!concern?.escalatedTo
  const concernSuggestions = CONCERN_TAXONOMY[category] ?? []

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isNew && !selectedVa) {
      toast.error('Choose the VA this concern is about.')
      return
    }
    const fd = new FormData(e.currentTarget)
    fd.set('category', category === OTHER ? categoryOther.trim() : category)
    if (clientChoice === OTHER) {
      fd.set('clientId', '')
      fd.set('clientName', clientOther.trim())
    } else {
      fd.set('clientId', clientChoice)
      fd.set('clientName', '')
    }
    if (selectedVa) {
      fd.set('vaProfileId', selectedVa.vaProfileId)
      fd.set('departmentId', selectedVa.departmentId)
    }

    setSaving(true)
    try {
      const res = isNew ? await createConcern(fd) : await updateConcern(concern.id, fd)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      onSaved(isNew ? 'Concern logged' : 'Concern updated')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!concern) return
    setSaving(true)
    try {
      const res = await deleteConcern(concern.id)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      onSaved('Concern deleted')
    } finally {
      setSaving(false)
    }
  }

  const title = isNew ? 'New VA concern' : `${formatConcernNumber(concern.number)} · ${concern.vaName}`
  const description = isNew
    ? undefined
    : [
        concern.departmentName,
        concern.reportedByName ? `logged by ${concern.reportedByName}` : null,
        concern.sheetConcernId ? `sheet ID ${concern.sheetConcernId}` : null,
      ]
        .filter(Boolean)
        .join(' · ')

  return (
    <Modal open onOpenChange={(next) => !next && !saving && onClose()} title={title} description={description} size="lg">
      <form id="concern-form" onSubmit={onSubmit} className="space-y-5">
        <Section title="Concern">
          {isNew && (
            <div className="space-y-1.5">
              <Label htmlFor="va-search">VA</Label>
              {selectedVa ? (
                <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium">{selectedVa.name}</span>
                    <span className="text-muted-foreground"> · {selectedVa.departmentName}</span>
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setVaKey('')}>
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    id="va-search"
                    placeholder="Type a VA's name..."
                    value={vaSearch}
                    onChange={(e) => setVaSearch(e.target.value)}
                    autoFocus
                  />
                  <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
                    {matchingVas.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No VA matches that name.</p>
                    ) : (
                      matchingVas.map((o) => (
                        <button
                          key={o.key}
                          type="button"
                          onClick={() => {
                            setVaKey(o.key)
                            setClientChoice(o.clients.length === 1 ? o.clients[0].id : NO_CLIENT)
                          }}
                          className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-muted"
                        >
                          <span>{o.name}</span>
                          <span className="text-xs text-muted-foreground">{o.departmentName}</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="concernDate">Date</Label>
              <Input
                id="concernDate"
                name="concernDate"
                type="date"
                required
                disabled={!editable}
                defaultValue={concern ? concern.concernDate.slice(0, 10) : todayInput()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clientChoice">Client (optional)</Label>
              <Select
                id="clientChoice"
                value={clientChoice}
                onChange={(e) => setClientChoice(e.target.value)}
                disabled={!editable}
                className="w-full"
              >
                <option value={NO_CLIENT}>No specific client</option>
                {concern?.clientId && <option value={concern.clientId}>{concern.clientName}</option>}
                {clientOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value={OTHER}>Other (type the name)</option>
              </Select>
              {clientChoice === OTHER && (
                <Input
                  aria-label="Client name"
                  value={clientOther}
                  onChange={(e) => setClientOther(e.target.value)}
                  disabled={!editable}
                  placeholder="Client name"
                />
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="categorySelect">Type of concern</Label>
              <Select
                id="categorySelect"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={!editable}
                required
                className="w-full"
              >
                <option value="" disabled>
                  Choose a type
                </option>
                {CONCERN_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value={OTHER}>Other</option>
              </Select>
              {category === OTHER && (
                <Input
                  aria-label="Type of concern"
                  value={categoryOther}
                  onChange={(e) => setCategoryOther(e.target.value)}
                  disabled={!editable}
                  placeholder="Type of concern"
                  required
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="concern">Concern</Label>
              <Input
                id="concern"
                name="concern"
                list="concern-suggestions"
                defaultValue={concern?.concern ?? ''}
                disabled={!editable}
                placeholder={concernSuggestions[0] ?? 'e.g. Missed deadlines'}
              />
              <datalist id="concern-suggestions">
                {concernSuggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={concern?.description ?? ''}
              disabled={!editable}
              placeholder="What happened, and what the client or VA said"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="suggestedMitigation">Suggested mitigation</Label>
            <Textarea
              id="suggestedMitigation"
              name="suggestedMitigation"
              rows={2}
              defaultValue={concern?.suggestedMitigation ?? ''}
              disabled={!editable}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="referenceUrl">Reference link</Label>
              <Input
                id="referenceUrl"
                name="referenceUrl"
                type="url"
                defaultValue={concern?.referenceUrl ?? ''}
                disabled={!editable}
                placeholder="https://"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recordingUrl">Recording link</Label>
              <Input
                id="recordingUrl"
                name="recordingUrl"
                type="url"
                defaultValue={concern?.recordingUrl ?? ''}
                disabled={!editable}
                placeholder="https://"
              />
            </div>
          </div>
        </Section>

        <Section title="Status">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={!editable}
                className="w-full"
              >
                {Object.entries(CONCERN_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            {(status === 'ESCALATED' || concern?.escalatedTo) && (
              <div className="space-y-1.5">
                <Label htmlFor="escalatedTo">Escalated to</Label>
                <Select
                  id="escalatedTo"
                  name="escalatedTo"
                  value={escalatedTo}
                  onChange={(e) => setEscalatedTo(e.target.value)}
                  disabled={!editable || status !== 'ESCALATED'}
                  required={status === 'ESCALATED'}
                  className="w-full"
                >
                  <option value="" disabled>
                    Choose a team
                  </option>
                  {Object.entries(ESCALATION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
          {status === 'ESCALATED' && (escalatedTo === 'MANAGER' || escalatedTo === 'HR') && (
            <p className="text-xs text-muted-foreground">
              {escalatedTo === 'HR' ? 'HR' : "The department's Dept/Ops Managers"} will get a notification when you save.
            </p>
          )}
        </Section>

        <Section title="Action taken">
          <div className="space-y-1.5">
            <Label htmlFor="teamLeaderAction">Team Leader</Label>
            <Textarea
              id="teamLeaderAction"
              name="teamLeaderAction"
              rows={2}
              defaultValue={concern?.teamLeaderAction ?? ''}
              disabled={!editable}
            />
          </div>
          {(managerEditable || concern?.managerAction) && (
            <div className="space-y-1.5">
              <Label htmlFor="managerAction">Dept/Ops Manager</Label>
              <Textarea
                id="managerAction"
                name="managerAction"
                rows={2}
                defaultValue={concern?.managerAction ?? ''}
                disabled={!managerEditable}
              />
            </div>
          )}
        </Section>

        {showEscalation && !isNew && (
          <Section
            title="Escalation"
            hint={managerEditable ? 'Record what each team did once the concern reached them.' : undefined}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="escalationStatus">Escalation status</Label>
                <Select
                  id="escalationStatus"
                  name="escalationStatus"
                  defaultValue={concern?.escalationStatus ?? ''}
                  disabled={!managerEditable}
                  className="w-full"
                >
                  <option value="">Not escalated</option>
                  {ESCALATION_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {CONCERN_STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="escalationReference">Escalation reference</Label>
                <Input
                  id="escalationReference"
                  name="escalationReference"
                  type="url"
                  defaultValue={concern?.escalationReference ?? ''}
                  disabled={!managerEditable}
                  placeholder="https://"
                />
              </div>
            </div>
            {(
              [
                ['hrAction', 'HR', concern?.hrAction],
                ['clientExperienceAction', 'Client Experience', concern?.clientExperienceAction],
                ['businessProcessAction', 'Business Process', concern?.businessProcessAction],
                ['accountingAction', 'Accounting', concern?.accountingAction],
              ] as const
            )
              .filter(([, , value]) => managerEditable || value)
              .map(([name, label, value]) => (
                <div key={name} className="space-y-1.5">
                  <Label htmlFor={name}>{label}</Label>
                  <Textarea id={name} name={name} rows={2} defaultValue={value ?? ''} disabled={!managerEditable} />
                </div>
              ))}
          </Section>
        )}
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        {perms.canDelete && !isNew && (
          <div className="mr-auto flex items-center gap-2">
            {confirmDelete ? (
              <>
                <span className="text-xs text-muted-foreground">Delete this concern for good?</span>
                <Button type="button" variant="destructive" size="sm" disabled={saving} onClick={onDelete}>
                  Delete
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  Keep
                </Button>
              </>
            ) : (
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
          </div>
        )}
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          {editable ? 'Cancel' : 'Close'}
        </Button>
        {editable && (
          <Button type="submit" form="concern-form" disabled={saving}>
            {saving ? 'Saving...' : isNew ? 'Log concern' : 'Save changes'}
          </Button>
        )}
      </div>
    </Modal>
  )
}
