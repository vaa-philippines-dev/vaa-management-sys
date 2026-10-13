import type { KpiMilestone } from '@/src/generated/prisma/enums'

// The check-in milestones and their labels, split out of lib/kpi-checks.ts so
// client components can import them without pulling Prisma (and therefore
// pg) into the browser bundle. lib/kpi-checks.ts re-exports both, so existing
// server-side importers are unaffected.

// Every milestone a department can run, in chronological order — the order
// panels and grid cells render in.
export const KPI_MILESTONES: KpiMilestone[] = ['D1', 'D4', 'W1', 'W2', 'M1', 'M2', 'M3', 'M6']

// The DMF sheet's own seven — what a department runs until it customises its
// schedule (FB-0015).
export const DEFAULT_KPI_MILESTONES: KpiMilestone[] = ['D4', 'W1', 'W2', 'M1', 'M2', 'M3', 'M6']

export const KPI_MILESTONE_LABELS: Record<KpiMilestone, string> = {
  D1: '1st Day',
  D4: '4th Day',
  W1: 'Week 1',
  W2: 'Week 2',
  M1: 'Month 1',
  M2: 'Month 2',
  M3: 'Month 3',
  M6: 'Month 6',
}

// A department's stored schedule → the milestones it actually runs, in
// chronological order. Empty (never customised) falls back to the default.
export function resolveKpiMilestones(stored: readonly KpiMilestone[] | null | undefined): KpiMilestone[] {
  if (!stored || stored.length === 0) return DEFAULT_KPI_MILESTONES
  return KPI_MILESTONES.filter((m) => stored.includes(m))
}
