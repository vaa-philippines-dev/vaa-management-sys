'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createAssignment } from '@/app/(dashboard)/assignments/actions'
import { SearchSelect, type SearchSelectOption } from '@/components/assignments/SearchSelect'

type Client = {
  id: string
  name: string
  company: string | null
  platform: string | null
  departmentId: string | null
  departmentName: string
  requiredSkills: string[]
}
type VA = { id: string; name: string; skills: string[]; departmentIds: string[] }

export function AssignmentForm({
  clients,
  vas,
  restrictVAsToClientDepartment,
  defaultClientId,
}: {
  clients: Client[]
  vas: VA[]
  // Scoped managers may only staff a client with a VA from that client's
  // department (createAssignment enforces it); admins may cross departments.
  restrictVAsToClientDepartment: boolean
  defaultClientId?: string
}) {
  const [clientId, setClientId] = useState(defaultClientId ?? '')
  const [vaProfileId, setVaProfileId] = useState('')
  const [type, setType] = useState<'REGULAR' | 'PROJECT'>('REGULAR')

  const selectedClient = clients.find((c) => c.id === clientId)

  const clientOptions = useMemo<SearchSelectOption[]>(
    () =>
      clients.map((c) => ({
        id: c.id,
        label: c.name,
        description: [c.company, c.platform].filter(Boolean).join(' · ') || undefined,
        tag: c.departmentName,
        group: c.departmentName,
        keywords: c.requiredSkills.join(' '),
      })),
    [clients]
  )

  // With a client picked, its department's VAs come first, then (admins only)
  // everyone else; within each group, VAs with the most matching skills lead.
  const vaOptions = useMemo<SearchSelectOption[]>(() => {
    const required = selectedClient?.requiredSkills ?? []
    const deptId = selectedClient?.departmentId ?? null
    return vas
      .filter((v) => !(restrictVAsToClientDepartment && deptId && !v.departmentIds.includes(deptId)))
      .map((v) => {
        const overlap = v.skills.filter((s) => required.includes(s))
        const inDept = deptId ? v.departmentIds.includes(deptId) : true
        return { v, overlap, inDept }
      })
      .sort((a, b) => Number(b.inDept) - Number(a.inDept) || b.overlap.length - a.overlap.length)
      .map(({ v, overlap, inDept }) => ({
        id: v.id,
        label: v.name,
        description: overlap.length > 0 ? `Matches: ${overlap.join(', ')}` : undefined,
        group: selectedClient && deptId ? (inDept ? `In ${selectedClient.departmentName}` : 'Other departments') : undefined,
        keywords: v.skills.join(' '),
      }))
  }, [selectedClient, vas, restrictVAsToClientDepartment])

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={createAssignment} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="clientId">Client *</Label>
              <SearchSelect
                id="clientId"
                name="clientId"
                options={clientOptions}
                value={clientId}
                onValueChange={(id) => {
                  setClientId(id)
                  // Drop a picked VA the new client's department can't staff.
                  const deptId = clients.find((c) => c.id === id)?.departmentId
                  const va = vas.find((v) => v.id === vaProfileId)
                  if (restrictVAsToClientDepartment && deptId && va && !va.departmentIds.includes(deptId)) {
                    setVaProfileId('')
                  }
                }}
                placeholder="Search clients…"
                emptyText="No clients match"
                required
              />
              {selectedClient && selectedClient.requiredSkills.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedClient.requiredSkills.map((s) => (
                    <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="vaProfileId">VA *</Label>
              <SearchSelect
                id="vaProfileId"
                name="vaProfileId"
                options={vaOptions}
                value={vaProfileId}
                onValueChange={setVaProfileId}
                placeholder="Search VAs…"
                emptyText={selectedClient ? 'No eligible VAs in this department' : 'No VAs match'}
                required
              />
              {selectedClient && selectedClient.requiredSkills.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  VAs are ranked by skill match
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assignment Type *</Label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setType('REGULAR')}>
                <Badge variant={type === 'REGULAR' ? 'default' : 'outline'} className="cursor-pointer px-3 py-1">
                  Regular (Monthly retainer)
                </Badge>
              </button>
              <button type="button" onClick={() => setType('PROJECT')}>
                <Badge variant={type === 'PROJECT' ? 'default' : 'outline'} className="cursor-pointer px-3 py-1">
                  Project (Fixed scope)
                </Badge>
              </button>
            </div>
            <input type="hidden" name="type" value={type} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="agreedHours">Agreed Hours *</Label>
              <Input
                id="agreedHours"
                name="agreedHours"
                type="number"
                step="0.5"
                min="0"
                required
              />
            </div>
            {type === 'REGULAR' && (
              <div className="space-y-2">
                <Label htmlFor="monthlyHours">Monthly Hours</Label>
                <Input
                  id="monthlyHours"
                  name="monthlyHours"
                  type="number"
                  step="0.5"
                  min="0"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                required
              />
            </div>
            {type === 'PROJECT' && (
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  required={type === 'PROJECT'}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="submit">Create Assignment</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}