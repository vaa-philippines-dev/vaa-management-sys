'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createAssignment } from '@/app/(dashboard)/assignments/actions'

type Client = { id: string; name: string; requiredSkills: string[] }
type VA = { id: string; name: string; skills: string[] }

export function AssignmentForm({
  clients,
  vas,
  defaultClientId,
}: {
  clients: Client[]
  vas: VA[]
  defaultClientId?: string
}) {
  const [clientId, setClientId] = useState(defaultClientId ?? '')
  const [vaProfileId, setVaProfileId] = useState('')
  const [type, setType] = useState<'REGULAR' | 'PROJECT'>('REGULAR')

  const selectedClient = clients.find((c) => c.id === clientId)

  const matchedVAs = useMemo(() => {
    if (!selectedClient || selectedClient.requiredSkills.length === 0)
      return vas.map((v) => ({ va: v, overlap: [] as string[] }))
    return vas
      .map((v) => ({
        va: v,
        overlap: v.skills.filter((s) => selectedClient.requiredSkills.includes(s)),
      }))
      .sort((a, b) => b.overlap.length - a.overlap.length)
  }, [selectedClient, vas])

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={createAssignment} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="clientId">Client *</Label>
              <select
                id="clientId"
                name="clientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select a client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.requiredSkills.length > 0 && ` (${c.requiredSkills.join(', ')})`}
                  </option>
                ))}
              </select>
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
              <select
                id="vaProfileId"
                name="vaProfileId"
                value={vaProfileId}
                onChange={(e) => setVaProfileId(e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select a VA</option>
                {matchedVAs.map(({ va, overlap }) => (
                  <option key={va.id} value={va.id}>
                    {va.name}
                    {overlap.length > 0 && ` • matches: ${overlap.join(', ')}`}
                  </option>
                ))}
              </select>
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