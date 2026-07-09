'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Loader2 } from 'lucide-react'
import { createTicket, createTicketFromScreenshot } from '@/app/(dashboard)/tickets/actions'

type Option = { id: string; name: string }

const CATEGORIES = ['TECHNICAL', 'HR', 'CLIENT', 'VA_SUPPORT', 'GENERAL']
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

function SharedFields({ departments, clients }: { departments: Option[]; clients: Option[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="departmentId">Department</Label>
        <select
          id="departmentId"
          name="departmentId"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">None</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="clientId">Client</Label>
        <select
          id="clientId"
          name="clientId"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">None</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function NewTicketForm({ departments, clients }: { departments: Option[]; clients: Option[] }) {
  const [mode, setMode] = useState<'screenshot' | 'manual'>('screenshot')
  const [submitting, setSubmitting] = useState(false)

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex gap-2 rounded-lg border p-1 bg-muted/40 w-fit">
          <button
            type="button"
            onClick={() => setMode('screenshot')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'screenshot' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
          >
            Report a problem
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'manual' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
          >
            Write it myself
          </button>
        </div>

        {mode === 'screenshot' ? (
          <form
            action={async (formData) => {
              setSubmitting(true)
              try {
                await createTicketFromScreenshot(formData)
              } finally {
                setSubmitting(false)
              }
            }}
            className="space-y-4"
          >
            <fieldset disabled={submitting} className="space-y-4 disabled:opacity-60">
              <div className="space-y-2">
                <Label htmlFor="screenshot">Screenshot *</Label>
                <Input id="screenshot" name="screenshot" type="file" accept="image/*" required />
                <p className="text-xs text-muted-foreground">
                  Take a screenshot of the problem — a screen capture tool, Snipping Tool, or your phone's screenshot works.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vaNote">What happened? (optional)</Label>
                <textarea
                  id="vaNote"
                  name="vaNote"
                  rows={3}
                  placeholder="In your own words — even a few words helps, e.g. &quot;this button doesn&apos;t work&quot;"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <SharedFields departments={departments} clients={clients} />
            </fieldset>
            {submitting && (
              <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Reading your screenshot and drafting the ticket — this can take a few seconds...
                </p>
                <Progress indeterminate />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Drafting ticket...</>
                ) : (
                  'Submit'
                )}
              </Button>
            </div>
          </form>
        ) : (
          <form action={createTicket} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" required placeholder="Short summary of the issue" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                name="description"
                rows={4}
                placeholder="What happened, and what did you expect instead?"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <select
                  id="category"
                  name="category"
                  required
                  defaultValue=""
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="" disabled>Select category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <select
                  id="priority"
                  name="priority"
                  defaultValue="MEDIUM"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <SharedFields departments={departments} clients={clients} />
            <div className="flex justify-end gap-2">
              <Button type="submit">Submit</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
