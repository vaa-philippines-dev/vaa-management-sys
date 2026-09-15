import type { KpiMilestone } from '@/src/generated/prisma/enums'

// The seven fixed check-in milestones and their labels, split out of
// lib/kpi-checks.ts so client components can import them without pulling
// Prisma (and therefore pg) into the browser bundle. lib/kpi-checks.ts
// re-exports both, so existing server-side importers are unaffected.

export const KPI_MILESTONES: KpiMilestone[] = ['D4', 'W1', 'W2', 'M1', 'M2', 'M3', 'M6']

export const KPI_MILESTONE_LABELS: Record<KpiMilestone, string> = {
  D4: '4th Day',
  W1: 'Week 1',
  W2: 'Week 2',
  M1: 'Month 1',
  M2: 'Month 2',
  M3: 'Month 3',
  M6: 'Month 6',
}
