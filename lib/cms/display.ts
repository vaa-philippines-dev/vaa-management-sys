// Shared status badge coloring for CMS-sourced Customer/Account records.
export const CUSTOMER_ACCOUNT_STATUS_COLORS: Record<string, string> = {
  Active: 'bg-success/10 text-success border-success/20',
  Terminated: 'bg-destructive/10 text-destructive border-destructive/20',
  Paused: 'bg-warning/10 text-warning border-warning/20',
  Pending: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
}
