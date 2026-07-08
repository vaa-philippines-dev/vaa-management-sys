'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { addVASkill } from '@/app/(dashboard)/vas/actions'

const PROFICIENCY_OPTIONS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']

export function AddSkillCard({
  vaProfileId,
  skillOptions,
}: {
  vaProfileId: string
  skillOptions: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [skillId, setSkillId] = useState('')
  const [proficiency, setProficiency] = useState('INTERMEDIATE')
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!skillId) return
    setSaving(true)
    try {
      await addVASkill(vaProfileId, skillId, proficiency)
      toast.success('Service added')
      setAdding(false)
      setSkillId('')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add service')
    } finally {
      setSaving(false)
    }
  }

  if (skillOptions.length === 0 && !adding) return null

  return (
    <div className="mt-3 pt-3 border-t">
      {!adding ? (
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Service
        </Button>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Service</Label>
            <select value={skillId} onChange={(e) => setSkillId(e.target.value)} className="h-8 text-xs rounded-md border bg-background px-2">
              <option value="">Select…</option>
              {skillOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Proficiency</Label>
            <select value={proficiency} onChange={(e) => setProficiency(e.target.value)} className="h-8 text-xs rounded-md border bg-background px-2">
              {PROFICIENCY_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <Button type="button" size="sm" className="h-8 text-xs" disabled={!skillId || saving} onClick={handleAdd}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
          </Button>
          <button type="button" onClick={() => setAdding(false)} className="text-xs text-muted-foreground hover:text-foreground h-8 px-2">
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
