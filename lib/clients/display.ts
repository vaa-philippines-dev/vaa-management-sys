// Single source for how a Client's status/platform render across the list
// page, card, table row, and detail page — previously duplicated verbatim
// in three separate files.

// Client.name is whatever the intake form called "Company Name" (on most
// imported rows it's just the person's name again); the person is
// contactName. Lists and pickers lead with the person, and only show the
// company alongside when it's actually different.
type ClientNameFields = { name: string; contactName: string | null }

export function clientDisplayName(c: ClientNameFields): string {
  return c.contactName?.trim() || c.name
}

export function clientCompanyName(c: ClientNameFields): string | null {
  const company = c.name.trim()
  if (!company || company.toLowerCase() === clientDisplayName(c).trim().toLowerCase()) return null
  return company
}

export function clientOptionLabel(c: ClientNameFields): string {
  const company = clientCompanyName(c)
  return company ? `${clientDisplayName(c)} (${company})` : clientDisplayName(c)
}

// Category/Niche column: the CMS Account's Category (Seller/Agency/…) plus
// whatever niche the intake captured — the Product Background/Niche answer,
// else the edit form's "Industry / Niche" field.
export function clientNiche(c: { industry: string | null; formDetails: unknown }): string | null {
  const details = (c.formDetails ?? {}) as Record<string, unknown>
  const niche = typeof details.productNiche === 'string' ? details.productNiche.trim() : ''
  return niche || c.industry?.trim() || null
}

export const CLIENT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  PENDING: 'Pending',
  TRANSFERRED: 'Transferred',
  RESIGNED: 'Resigned',
  REMOVED: 'Removed',
  PROJECT_ENDED: 'Project Ended',
  CANCELLED: 'Cancelled',
  BLACKLISTED: 'Blacklisted',
  UNIDENTIFIED: 'Unidentified',
}

export type StatusTone = 'success' | 'warning' | 'destructive' | 'info' | 'neutral'

export const CLIENT_STATUS_TONE: Record<string, StatusTone> = {
  ACTIVE: 'success',
  PENDING: 'warning',
  TRANSFERRED: 'info',
  RESIGNED: 'destructive',
  REMOVED: 'destructive',
  PROJECT_ENDED: 'neutral',
  CANCELLED: 'destructive',
  BLACKLISTED: 'destructive',
  UNIDENTIFIED: 'neutral',
}

// Same tones as CLIENT_STATUS_TONE, expressed as dot background classes for
// contexts (like the detail page header) that render a raw colored dot
// rather than the shared StatusIndicator component.
export const CLIENT_STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-success',
  PENDING: 'bg-warning',
  TRANSFERRED: 'bg-info',
  RESIGNED: 'bg-destructive',
  REMOVED: 'bg-destructive',
  PROJECT_ENDED: 'bg-muted-foreground',
  CANCELLED: 'bg-destructive',
  BLACKLISTED: 'bg-destructive',
  UNIDENTIFIED: 'bg-muted-foreground',
}

export const CLIENT_PLATFORM_META: Record<string, { label: string; color: string }> = {
  AMAZON: { label: 'Amazon', color: 'bg-orange-500/15 text-orange-700 border-orange-500/20' },
  WALMART: { label: 'Walmart', color: 'bg-blue-500/15 text-blue-700 border-blue-500/20' },
  TIKTOK_SHOP: { label: 'TikTok Shop', color: 'bg-pink-500/15 text-pink-700 border-pink-500/20' },
  SHOPIFY: { label: 'Shopify', color: 'bg-green-500/15 text-green-700 border-green-500/20' },
  MULTI: { label: 'Multi-platform', color: 'bg-gray-500/15 text-gray-700 border-gray-500/20' },
}
