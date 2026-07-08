'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { mergeDepartments, getMergePreview, type MergePreview } from '@/app/(dashboard)/admin/users/actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, GitMerge, AlertTriangle, Users, Briefcase, Building2 } from 'lucide-react'

type Source = { id: string; name: string; shortName: string | null; acronym: string | null; level: string | null }
type Target = { id: string; name: string; shortName: string | null; acronym: string | null; level: string | null; membershipsCount: number; clientsCount: number }

export function MergeWizard({ source, targets }: { source: Source; targets: Target[] }) {
  const router = useRouter()
  const [selectedTargetId, setSelectedTargetId] = useState<string>('')
  const [preview, setPreview] = useState<MergePreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const handleSelectTarget = async (targetId: string) => {
    setSelectedTargetId(targetId)
    setPreview(null)
    setError(null)
    setConfirmed(false)
    if (!targetId) return
    setLoading(true)
    try {
      const p = await getMergePreview(source.id, targetId)
      setPreview(p)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load preview')
    } finally {
      setLoading(false)
    }
  }

  const handleMerge = async () => {
    if (!selectedTargetId || !confirmed) return
    setSubmitting(true)
    setError(null)
    try {
      await mergeDepartments({ sourceId: source.id, targetId: selectedTargetId })
      toast.success(`Merged "${source.name}" successfully`)
      router.push('/admin/departments')
    } catch (e: any) {
      setError(e.message ?? 'Merge failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (targets.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-2">
          <AlertTriangle className="h-8 w-8 text-warning mx-auto" />
          <p className="text-sm font-medium">No eligible targets</p>
          <p className="text-xs text-muted-foreground">
            There are no other active {source.level} departments to merge into. Create another {source.level} department first.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Step 1 — Select target department</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {targets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelectTarget(t.id)}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  selectedTargetId === t.id
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'hover:border-primary/30 hover:bg-accent/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{t.name}</span>
                  {t.acronym && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                      {t.acronym}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {t.membershipsCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {t.clientsCount}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading preview...
          </CardContent>
        </Card>
      )}

      {preview && !preview.sameLevel && (
        <Card>
          <CardContent className="py-6 flex items-center gap-3 text-sm text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Source and target are at different levels. Merges must be between same-level departments.
          </CardContent>
        </Card>
      )}

      {preview && preview.sameLevel && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Step 2 — Review impact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-muted/30 p-3 text-sm">
              <div className="flex items-center gap-2 mb-2 font-medium">
                <Building2 className="h-4 w-4" />
                {preview.source.name}
                <span className="text-muted-foreground">→</span>
                <Building2 className="h-4 w-4" />
                {preview.target.name}
              </div>
              <p className="text-xs text-muted-foreground">
                The following will be moved to the target department, and the source will be set to MERGED status.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-lg border p-3 text-center">
                <Users className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-2xl font-bold">{preview.counts.memberships}</p>
                <p className="text-xs text-muted-foreground">Memberships</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <Briefcase className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-2xl font-bold">{preview.counts.clients}</p>
                <p className="text-xs text-muted-foreground">Active Clients</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <Users className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-2xl font-bold">{preview.counts.assignments}</p>
                <p className="text-xs text-muted-foreground">Active Assignments</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <Building2 className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-2xl font-bold">{preview.counts.children}</p>
                <p className="text-xs text-muted-foreground">Sub-departments</p>
              </div>
            </div>

            <div className="rounded-lg bg-warning/10 border border-warning/20 p-3 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-warning">
                <AlertTriangle className="h-4 w-4" />
                This action is not reversible through the UI
              </div>
              <p className="text-xs text-warning">
                The source department will be marked as MERGED and become read-only. Its history will remain in audit logs.
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
                I understand this merge is permanent. Source will be set to <Badge variant="outline" className="text-[10px] py-0 px-1 mx-0.5">MERGED</Badge> and all its data moved to the target.
              </span>
            </label>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => router.push('/admin/departments')}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleMerge} disabled={!confirmed || submitting}>
                {submitting ? (
                  <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Merging...</>
                ) : (
                  <><GitMerge className="h-3 w-3 mr-1.5" /> Merge Departments</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
