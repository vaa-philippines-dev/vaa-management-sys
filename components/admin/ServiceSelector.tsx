'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Save, X, Briefcase, Check, Plus } from 'lucide-react'
import { setDepartmentSkills } from '@/app/(dashboard)/skills/actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

type Service = {
  id: string
  name: string
  category: string
  assigned: boolean
}

const CATEGORY_COLORS: Record<string, string> = {
  AMAZON: 'bg-amber-500/15 text-amber-700 border-amber-500/20',
  WALMART: 'bg-blue-500/15 text-blue-700 border-blue-500/20',
  TIKTOK_SHOP: 'bg-pink-500/15 text-pink-700 border-pink-500/20',
  SHOPIFY: 'bg-green-500/15 text-green-700 border-green-500/20',
  GENERAL: 'bg-gray-500/15 text-gray-700 border-gray-500/20',
}

export function ServiceSelector({
  departmentId,
  departmentName,
  services,
  canEdit = true,
}: {
  departmentId: string
  departmentName: string
  services: Service[]
  canEdit?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(
    new Set(services.filter((s) => s.assigned).map((s) => s.id))
  )
  const [filter, setFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const [pending, startTransition] = useTransition()

  const initialCount = services.filter((s) => s.assigned).length
  const selectedCount = selected.size
  const isDirty = selectedCount !== initialCount || services.filter((s) => s.assigned && !selected.has(s.id)).length > 0

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await setDepartmentSkills(departmentId, [...selected])
      toast.success(`${departmentName}: services updated`)
      startTransition(() => router.refresh())
      setOpen(false)
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to save services')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setSelected(new Set(services.filter((s) => s.assigned).map((s) => s.id)))
    setOpen(false)
  }

  const filtered = services.filter((s) =>
    !filter || s.name.toLowerCase().includes(filter.toLowerCase()) || s.category.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/30 transition-colors text-left"
        disabled={!canEdit}
      >
        <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">Services</span>
        {initialCount > 0 ? (
          <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
            {initialCount}
          </Badge>
        ) : (
          <span className="text-[10px] text-muted-foreground">none</span>
        )}
        <Plus className={`h-3.5 w-3.5 text-muted-foreground ml-auto transition-transform ${open ? 'rotate-45' : ''}`} />
      </button>

      {open && (
        <div className="border-t p-3 space-y-2.5">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter services..."
            className="w-full px-2.5 py-1.5 text-xs border rounded-md bg-background h-7"
          />

          {canEdit ? (
            <div className="max-h-48 overflow-y-auto space-y-1 rounded border p-1.5 bg-muted/20">
              {filtered.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-3">
                  No services match. Create services first via /skills.
                </p>
              ) : (
                filtered.map((service) => {
                  const isSelected = selected.has(service.id)
                  const colorClass = CATEGORY_COLORS[service.category] ?? CATEGORY_COLORS.GENERAL
                  return (
                    <label
                      key={service.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-background cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(service.id)}
                        className="rounded shrink-0"
                      />
                      <span className="text-xs flex-1 truncate">{service.name}</span>
                      <Badge variant="outline" className={`text-[9px] py-0 px-1.5 ${colorClass}`}>
                        {service.category.replace(/_/g, ' ')}
                      </Badge>
                    </label>
                  )
                })
              )}
            </div>
          ) : (
            <div className="rounded border bg-muted/20 p-2.5 text-[11px] text-muted-foreground italic text-center">
              View-only mode — Executive role cannot modify services
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-muted-foreground">
              {selectedCount} selected
              {isDirty && <span className="text-amber-600 ml-1">· unsaved</span>}
            </span>
            <div className="flex gap-1.5">
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCancel} disabled={!canEdit || !isDirty || saving}>
                <X className="h-3 w-3 mr-1" /> Cancel
              </Button>
              <Button type="button" size="sm" className="h-7 text-xs" onClick={handleSave} disabled={!canEdit || !isDirty || saving}>
                {saving ? (
                  'Saving...'
                ) : (
                  <><Save className="h-3 w-3 mr-1" /> Save
                </>
              )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
