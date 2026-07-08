'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { splitDepartment, type SplitNewDepartment } from '@/app/(dashboard)/admin/users/actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, GitBranch, AlertTriangle, Plus, Trash2, Users, Briefcase, Building2 } from 'lucide-react'

type Source = { id: string; name: string; level: string | null }
type Membership = { id: string; userName: string; userEmail: string; position: string | null }
type Client = { id: string; name: string; contactName: string | null; isActive: boolean; status?: 'ACTIVE' | 'INACTIVE' | 'ON_HOLD' }
type Child = { id: string; name: string; acronym: string | null }
type ServiceItem = { id: string; name: string; category: string }

type NewDeptDraft = {
  id: string
  name: string
  shortName: string
  acronym: string
  parentId: string
  memberships: Set<string>
  clients: Set<string>
  children: Set<string>
  services: Set<string>
}

function makeDraft(): NewDeptDraft {
  return {
    id: Math.random().toString(36).slice(2),
    name: '',
    shortName: '',
    acronym: '',
    parentId: '',
    memberships: new Set(),
    clients: new Set(),
    children: new Set(),
    services: new Set(),
  }
}

export function SplitWizard({
  source,
  memberships,
  clients,
  subDepartments,
  services,
  parentOptions,
}: {
  source: Source
  memberships: Membership[]
  clients: Client[]
  subDepartments: Child[]
  services: ServiceItem[]
  parentOptions: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [drafts, setDrafts] = useState<NewDeptDraft[]>([makeDraft(), makeDraft()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const addDraft = () => setDrafts((d) => [...d, makeDraft()])
  const removeDraft = (id: string) => setDrafts((d) => (d.length <= 2 ? d : d.filter((x) => x.id !== id)))
  const updateDraft = (id: string, patch: Partial<NewDeptDraft>) =>
    setDrafts((d) => d.map((x) => (x.id === id ? { ...x, ...patch } : x)))

  const toggleMember = (draftId: string, mId: string) =>
    setDrafts((d) =>
      d.map((x) => {
        if (x.id !== draftId) return x
        const m = new Set(x.memberships)
        m.has(mId) ? m.delete(mId) : m.add(mId)
        return { ...x, memberships: m }
      })
    )

  const toggleClient = (draftId: string, cId: string) =>
    setDrafts((d) =>
      d.map((x) => {
        if (x.id !== draftId) return x
        const c = new Set(x.clients)
        c.has(cId) ? c.delete(cId) : c.add(cId)
        return { ...x, clients: c }
      })
    )

  const toggleChild = (draftId: string, chId: string) =>
    setDrafts((d) =>
      d.map((x) => {
        if (x.id !== draftId) return x
        const c = new Set(x.children)
        c.has(chId) ? c.delete(chId) : c.add(chId)
        return { ...x, children: c }
      })
    )

  const toggleService = (draftId: string, svcId: string) =>
    setDrafts((d) =>
      d.map((x) => {
        if (x.id !== draftId) return x
        const s = new Set(x.services)
        s.has(svcId) ? s.delete(svcId) : s.add(svcId)
        return { ...x, services: s }
      })
    )

  const allAssignedMemberIds = new Set(drafts.flatMap((d) => [...d.memberships]))
  const allAssignedClientIds = new Set(drafts.flatMap((d) => [...d.clients]))
  const allAssignedChildIds = new Set(drafts.flatMap((d) => [...d.children]))
  const allAssignedServiceIds = new Set(drafts.flatMap((d) => [...d.services]))
  const unassignedMembers = memberships.filter((m) => !allAssignedMemberIds.has(m.id))
  const unassignedClients = clients.filter((c) => !allAssignedClientIds.has(c.id))
  const unassignedChildren = subDepartments.filter((c) => !allAssignedChildIds.has(c.id))
  const unassignedServices = services.filter((s) => !allAssignedServiceIds.has(s.id))

  const canSubmit =
    drafts.every((d) => d.name.trim() && d.acronym.trim()) &&
    confirmed

  const handleSplit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const newDepartments: SplitNewDepartment[] = drafts.map((d) => ({
        name: d.name.trim(),
        shortName: d.shortName.trim() || null,
        acronym: d.acronym.trim().toUpperCase(),
        level: source.level,
        parentId: d.parentId || null,
        reassignMemberships: [...d.memberships],
        reassignClients: [...d.clients],
        reassignChildren: [...d.children],
        reassignServices: [...d.services],
      }))
      await splitDepartment(source.id, newDepartments)
      toast.success(`Split "${source.name}" into ${drafts.length} departments`)
      router.push('/admin/departments')
    } catch (e: any) {
      setError(e.message ?? 'Split failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Source data ({source.name})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="rounded-lg border p-2">
              <p className="text-2xl font-bold">{memberships.length}</p>
              <p className="text-muted-foreground">Members</p>
            </div>
            <div className="rounded-lg border p-2">
              <p className="text-2xl font-bold">{clients.length}</p>
              <p className="text-muted-foreground">Clients</p>
            </div>
            <div className="rounded-lg border p-2">
              <p className="text-2xl font-bold">{subDepartments.length}</p>
              <p className="text-muted-foreground">Sub-departments</p>
            </div>
            <div className="rounded-lg border p-2">
              <p className="text-2xl font-bold">{services.length}</p>
              <p className="text-muted-foreground">Services</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {drafts.map((d, idx) => (
        <Card key={d.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                New Department #{idx + 1}
              </CardTitle>
              {drafts.length > 2 && (
                <Button variant="ghost" size="sm" onClick={() => removeDraft(d.id)} className="h-7 px-2 text-xs">
                  <Trash2 className="h-3 w-3 mr-1" /> Remove
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-4">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Name *</label>
                <input
                  value={d.name}
                  onChange={(e) => updateDraft(d.id, { name: e.target.value })}
                  placeholder="New Department Name"
                  className="w-full mt-0.5 px-2 py-1 text-xs border rounded-md bg-background h-7"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Short Name</label>
                <input
                  value={d.shortName}
                  onChange={(e) => updateDraft(d.id, { shortName: e.target.value })}
                  placeholder="Short"
                  className="w-full mt-0.5 px-2 py-1 text-xs border rounded-md bg-background h-7"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Acronym *</label>
                <input
                  value={d.acronym}
                  onChange={(e) => updateDraft(d.id, { acronym: e.target.value.toUpperCase() })}
                  placeholder="NEW"
                  maxLength={6}
                  className="w-full mt-0.5 px-2 py-1 text-xs border rounded-md bg-background h-7 font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Parent (optional)</label>
                <select
                  value={d.parentId}
                  onChange={(e) => updateDraft(d.id, { parentId: e.target.value })}
                  className="w-full mt-0.5 px-2 py-1 text-xs border rounded-md bg-background h-7"
                >
                  <option value="">— No parent —</option>
                  {parentOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {memberships.length > 0 && (
              <div>
                <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Assign members ({d.memberships.size} selected)
                </label>
                <div className="mt-1 max-h-32 overflow-y-auto rounded border p-2 space-y-1">
                  {memberships.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={d.memberships.has(m.id)}
                        onChange={() => toggleMember(d.id, m.id)}
                        className="rounded"
                      />
                      <span className="flex-1 truncate">
                        {m.userName}
                        {m.position && <span className="text-muted-foreground"> ({m.position})</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {clients.length > 0 && (
              <div>
                <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  Assign clients ({d.clients.size} selected)
                </label>
                <div className="mt-1 max-h-32 overflow-y-auto rounded border p-2 space-y-1">
                  {clients.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={d.clients.has(c.id)}
                        onChange={() => toggleClient(d.id, c.id)}
                        className="rounded"
                      />
                      <span className="flex-1 truncate">
                        {c.name}
                        {(c.status ? c.status !== 'ACTIVE' : !c.isActive) && <Badge variant="outline" className="text-[9px] py-0 px-1 ml-1">inactive</Badge>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {subDepartments.length > 0 && (
              <div>
                <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Assign sub-departments ({d.children.size} selected)
                </label>
                <div className="mt-1 max-h-32 overflow-y-auto rounded border p-2 space-y-1">
                  {subDepartments.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={d.children.has(c.id)}
                        onChange={() => toggleChild(d.id, c.id)}
                        className="rounded"
                      />
                      <span className="flex-1 truncate">
                        {c.name} {c.acronym && <span className="text-muted-foreground">({c.acronym})</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {services.length > 0 && (
              <div>
                <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  Assign services ({d.services.size} selected)
                </label>
                <div className="mt-1 max-h-32 overflow-y-auto rounded border p-2 space-y-1">
                  {services.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={d.services.has(s.id)}
                        onChange={() => toggleService(d.id, s.id)}
                        className="rounded"
                      />
                      <span className="flex-1 truncate">
                        {s.name} <span className="text-muted-foreground">({s.category.replace(/_/g, ' ')})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" size="sm" onClick={addDraft} className="w-full">
        <Plus className="h-3.5 w-3.5 mr-1" /> Add another new department
      </Button>

      {(unassignedMembers.length > 0 || unassignedClients.length > 0 || unassignedChildren.length > 0 || unassignedServices.length > 0) && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 border border-warning/20 rounded p-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <div>
                <span className="font-medium">Unassigned items will remain with the source (which will be marked SPLIT):</span>{' '}
                {unassignedMembers.length} members, {unassignedClients.length} clients, {unassignedChildren.length} sub-departments, {unassignedServices.length} services
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="rounded-lg bg-warning/10 border border-warning/20 p-3 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-warning">
              <AlertTriangle className="h-4 w-4" />
              This split is permanent
            </div>
            <p className="text-xs text-warning">
              The source department <Badge variant="outline" className="text-[10px] py-0 px-1 mx-0.5">{source.name}</Badge> will be marked as SPLIT and become read-only. Its split history remains in audit logs.
            </p>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 rounded"
            />
            <span>
              I understand this split is permanent. The source will be set to <Badge variant="outline" className="text-[10px] py-0 px-1 mx-0.5">SPLIT</Badge> and the new departments will be fully independent.
            </span>
          </label>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => router.push('/admin/departments')}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSplit} disabled={!canSubmit || submitting}>
              {submitting ? (
                <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Splitting...</>
              ) : (
                <><GitBranch className="h-3 w-3 mr-1.5" /> Split into {drafts.length} departments</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
