// Row types for the DMF sheet's "VA-Client Summary" tab (/va-client-summary).
// Prisma reads live in lib/va-client-summary.ts; this file stays importable
// from client components.
//
// The sheet keeps two side-by-side lists by hand: "Employed VA's Client
// Summary" (each VA, their clients and hours) and "Active Clients' VA
// Summary" (each client, its VAs and hours). Here both are derived from
// active assignments, so they can't drift from the Assignments tab.
// Hours are per day, the same unit as the sheet's NO OF HOURS.

export type SummaryLink = {
  id: string // the other side's id: a client id on a VA row, a VA profile id on a client row
  name: string
  hours: number
}

export type VaSummaryRow = {
  key: string // vaProfileId:departmentId — a VA in two departments has a row in each
  vaProfileId: string
  name: string
  status: string
  departmentId: string
  departmentName: string
  clients: SummaryLink[]
  totalHours: number
}

export type ClientSummaryRow = {
  clientId: string
  name: string
  departmentId: string
  departmentName: string
  vas: SummaryLink[]
  totalHours: number
}

export type VaClientSummary = {
  vas: VaSummaryRow[]
  clients: ClientSummaryRow[]
}

export const VA_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  PENDING: 'Pending',
  TRANSFERRED: 'Transferred',
  UNIDENTIFIED: 'Unidentified',
}

export function formatDailyHours(hours: number): string {
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h/day`
}
