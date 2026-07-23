import { matchDepartmentConfig } from '@/lib/clients/intake-fields'

// Universal — same across every department, seeded from what actually
// appeared in the Wholesale masterlist.
export const REQUEST_TYPE_OPTIONS = ['New', 'Replacement', 'Additional']
export const SCHEDULE_TYPE_OPTIONS = ['Fixed', 'Flexible', 'Project-based']
export const BRAND_OWNERSHIP_OPTIONS = ['Owner', 'Reseller']
export const BRAND_REGISTRATION_OPTIONS = ['Registered', 'Not Registered']

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
