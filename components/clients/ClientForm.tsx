'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/app/(dashboard)/clients/actions'

const PLATFORMS = [
  { value: 'AMAZON', label: 'Amazon' },
  { value: 'WALMART', label: 'Walmart' },
  { value: 'TIKTOK_SHOP', label: 'TikTok Shop' },
  { value: 'SHOPIFY', label: 'Shopify' },
  { value: 'MULTI', label: 'Multi-platform' },
]

export function ClientForm({
  skills,
  managerId,
  initial,
}: {
  skills: string[]
  managerId?: string
  initial?: {
    name: string
    contactName: string | null
    contactEmail: string | null
    platform: string
    industry: string | null
    notes: string | null
    requiredSkills: string[]
  }
}) {
  const [selected, setSelected] = useState<string[]>(initial?.requiredSkills ?? [])

  const toggle = (s: string) => {
    setSelected((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={createClient} className="space-y-4">
          {managerId && <input type="hidden" name="managerId" value={managerId} />}
          <div className="space-y-2">
            <Label htmlFor="name">Client / Brand Name *</Label>
            <Input id="name" name="name" required defaultValue={initial?.name} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contactName">Contact Name</Label>
              <Input id="contactName" name="contactName" defaultValue={initial?.contactName ?? ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input id="contactEmail" name="contactEmail" type="email" defaultValue={initial?.contactEmail ?? ''} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="platform">Platform *</Label>
              <select
                id="platform"
                name="platform"
                defaultValue={initial?.platform ?? 'AMAZON'}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry / Niche</Label>
              <Input id="industry" name="industry" defaultValue={initial?.industry ?? ''} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Required VA Services</Label>
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => toggle(s)}
                  className="focus:outline-none"
                >
                  <Badge
                    variant={selected.includes(s) ? 'default' : 'outline'}
                    className="cursor-pointer"
                  >
                    {s}
                  </Badge>
                </button>
              ))}
            </div>
            {selected.map((s) => (
              <input key={s} type="hidden" name="requiredSkills" value={s} />
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" defaultValue={initial?.notes ?? ''} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="submit">Create Client</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}