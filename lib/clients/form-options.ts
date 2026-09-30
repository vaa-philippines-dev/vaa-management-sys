import { matchDepartmentConfig } from '@/lib/clients/intake-fields'

// Universal — same across every department, seeded from what actually
// appeared in the Wholesale masterlist.
export const REQUEST_TYPE_OPTIONS = ['New', 'Replacement', 'Additional']
export const SCHEDULE_TYPE_OPTIONS = ['Fixed', 'Flexible', 'Project-based']
export const BRAND_OWNERSHIP_OPTIONS = ['Owner', 'Reseller']
export const BRAND_REGISTRATION_OPTIONS = ['Registered', 'Not Registered']

// Same "PHT ±h | UTC ±h | Zone name - ABBR" format the intake form's
// timezones already use in the data (~500 clients), one entry per zone
// rather than per city, ordered west → east. Standard-time offsets only,
// like the source format. A client whose stored value isn't in this list
// (older free-text entries) keeps it — TimezoneSelect shows it as an extra
// option instead of silently blanking it.
export const TIMEZONE_OPTIONS = [
  'PHT -18:00 | UTC -10:00 | Hawaii-Aleutian Standard Time - HST',
  'PHT -17:00 | UTC -9:00 | Alaska Standard Time - AKST',
  'PHT -16:00 | UTC -8:00 | Pacific Standard Time - PST',
  'PHT -15:00 | UTC -7:00 | Mountain Standard Time - MST',
  'PHT -14:00 | UTC -6:00 | Central Standard Time - CST',
  'PHT -13:00 | UTC -5:00 | Eastern Standard Time - EST',
  'PHT -12:00 | UTC -4:00 | Atlantic Standard Time - AST',
  'PHT -11:00 | UTC -3:00 | Brasília Time - BRT',
  'PHT -8:00 | UTC +0:00 | Greenwich Mean Time - GMT',
  'PHT -7:00 | UTC +1:00 | Central European Time - CET',
  'PHT -6:00 | UTC +2:00 | Eastern European Time - EET',
  'PHT -6:00 | UTC +2:00 | Israel Standard Time - IST',
  'PHT -5:00 | UTC +3:00 | Moscow Standard Time - MSK',
  'PHT -4:00 | UTC +4:00 | Gulf Standard Time - GST',
  'PHT -3:00 | UTC +5:00 | Pakistan Standard Time - PKT',
  'PHT -2:30 | UTC +5:30 | India Standard Time - IST',
  'PHT -2:00 | UTC +6:00 | Bangladesh Standard Time - BST',
  'PHT -1:00 | UTC +7:00 | Indochina Time - ICT',
  'PHT 0:00 | UTC +8:00 | Philippine Time - PHT',
  'PHT 0:00 | UTC +8:00 | China Standard Time - CST',
  'PHT 0:00 | UTC +8:00 | Singapore Time - SGT',
  'PHT 0:00 | UTC +8:00 | Malaysia Time - MYT',
  'PHT 0:00 | UTC +8:00 | Australian Western Time - AWT',
  'PHT +1:00 | UTC +9:00 | Japan Standard Time - JST',
  'PHT +1:00 | UTC +9:00 | Korea Standard Time - KST',
  'PHT +1:30 | UTC +9:30 | Australian Central Time - ACT',
  'PHT +2:00 | UTC +10:00 | Australian Eastern Time - AET',
  'PHT +4:00 | UTC +12:00 | New Zealand Standard Time - NZST',
]

// Multi-select; stored comma-joined in Client.formDetails.marketplace (see
// buildFormDetails in clients/actions.ts), with anything typed into "Other"
// appended as-is.
export const MARKETPLACE_OPTIONS = [
  'Amazon US',
  'Amazon CA',
  'Amazon MX',
  'Amazon UK',
  'Amazon EU',
  'Amazon AU',
  'Amazon JP',
  'Walmart',
  'TikTok Shop',
  'Shopify',
  'eBay',
  'Etsy',
  'Target Plus',
  'Wayfair',
  'Temu',
]

// Per-department — keyed the same way as DEPARTMENT_INTAKE_FIELDS
// (normalized department name/shortName/acronym). A department with no
// entry here falls back to a free-text input instead of a dropdown, since
// guessing at options we don't have real data for would just be wrong.
const BUSINESS_MODEL_OPTIONS_BY_DEPARTMENT: Record<string, string[]> = {
  wholesale: ['Wholesale', 'Arbitrage', 'Walmart Wholesale'],
}

const SERVICE_TYPE_OPTIONS_BY_DEPARTMENT: Record<string, string[]> = {
  wholesale: ['Wholesale VA', 'Arbitrage VA', 'Wholesale/Arbitrage VA', 'Walmart Wholesale VA'],
}

type DeptLike = { name?: string | null; shortName?: string | null; acronym?: string | null } | null | undefined

export function getBusinessModelOptions(dept: DeptLike): string[] {
  return matchDepartmentConfig(BUSINESS_MODEL_OPTIONS_BY_DEPARTMENT, dept) ?? []
}

export function getServiceTypeOptions(dept: DeptLike): string[] {
  return matchDepartmentConfig(SERVICE_TYPE_OPTIONS_BY_DEPARTMENT, dept) ?? []
}
