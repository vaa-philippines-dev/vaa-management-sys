'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createVA } from '@/app/(dashboard)/vas/actions'

export function VAForm({
  skills,
}: {
  skills: { id: string; name: string }[]
}) {
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={createVA} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" name="email" type="email" required />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hourlyRate">Hourly Rate (USD)</Label>
              <Input id="hourlyRate" name="hourlyRate" type="number" step="0.01" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Skills</Label>
            {skills.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No skills yet. Add skills first in the Skills page.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {skills.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    className="focus:outline-none"
                  >
                    <Badge
                      variant={selected.includes(s.id) ? 'default' : 'outline'}
                      className="cursor-pointer"
                    >
                      {s.name}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
            {selected.map((id) => (
              <input key={id} type="hidden" name="skillIds" value={id} />
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="submit">Create VA</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}