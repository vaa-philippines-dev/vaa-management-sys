'use client'

import { useState, useTransition, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Save, X, Search, Briefcase, Loader2 } from 'lucide-react'
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
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (!open) {
      setSelected(new Set(services.filter((s) => s.assigned).map((s) => s.id)))
    }
  }, [services, open])

  const assignedCount = services.filter((s) => s.assigned).length
  const isDirty = selected.size !== assignedCount
    || services.some((s) => s.assigned && !selected.has(s.id))

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
    setFilter('')
  }

  const filtered = services.filter((s) =>
    !filter
    || s.name.toLowerCase().includes(filter.toLowerCase())
    || s.category.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className="inline-flex items-center gap-1 h-6 text-[10px] px-1.5 border rounded-md hover:bg-accent transition-colors"
        title="Assign services to this department"
      >
        <Briefcase className="h-3 w-3 text-muted-foreground" />
        <span>Assign Services{assignedCount > 0 ? ` (${assignedCount})` : ''}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={handleCancel}>
          <div
            className="bg-card border rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-sm font-semibold">Services — {departmentName}</h3>
                <p className="text-[11px] text-muted-foreground">
                  Choose which services this department provides
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="p-1 hover:bg-accent rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {services.length === 0 ? (
              <div className="p-8 text-center">
                <Briefcase className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No services created yet. Create services at /skills first.
                </p>
              </div>
            ) : (
              <>
                <div className="px-4 py-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder="Search services..."
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                  {filtered.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      No services match your search.
                    </p>
                  ) : (
                    filtered.map((service) => {
                      const isSelected = selected.has(service.id)
                      const colorClass = CATEGORY_COLORS[service.category] ?? CATEGORY_COLORS.GENERAL
                      return (
                        <label
                          key={service.id}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                            isSelected ? 'bg-primary/5 border border-primary/20' : 'hover:bg-accent/30 border border-transparent'
                          } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => canEdit && toggle(service.id)}
                            disabled={!canEdit}
                            className="rounded shrink-0"
                          />
                          <span className="text-xs font-medium flex-1">{service.name}</span>
                          <Badge variant="outline" className={`text-[9px] py-0 px-1.5 ${colorClass}`}>
                            {service.category.replace(/_/g, ' ')}
                          </Badge>
                        </label>
                      )
                    })
                  )}
                </div>
              </>
            )}

            <div className="flex items-center justify-between p-4 border-t">
              <span className="text-[11px] text-muted-foreground">
                {selected.size} service{selected.size !== 1 ? 's' : ''} selected
                {isDirty && canEdit && (
                  <span className="text-amber-600 ml-1">· unsaved</span>
                )}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                {canEdit && (
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={handleSave}
                    disabled={!isDirty || saving}
                  >
                    {saving ? (
                      <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving...</>
                    ) : (
                      <><Save className="h-3 w-3 mr-1" /> Save Changes</>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
