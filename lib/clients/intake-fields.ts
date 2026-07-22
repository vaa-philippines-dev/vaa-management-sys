// Each department has its own client intake "form" — Amazon only collects
// account background + goals, PPC also wants campaign background + budget,
// and future departments will add their own combinations. Rather than a
// schema migration per department, the fields live in Client.intakeDetails
// (a Json column) and this file is the single place that defines which keys
// belong to which department's form. Add a department here as its CSV
// arrives; no other code needs to change.

export const INTAKE_FIELD_CATALOG = {
  accountBackground: { label: 'Account Background', type: 'textarea' },
  campaignBackground: { label: 'Campaign Background', type: 'textarea' },
  goals: { label: 'Goals', type: 'textarea' },
  advertisingBudget: { label: 'Advertising Budget', type: 'currency' },
} as const

export type IntakeFieldKey = keyof typeof INTAKE_FIELD_CATALOG

// Keyed by normalized (lowercased, trimmed) department name, shortName, or
// acronym — whichever the department record actually uses — so CSV rows and
// department lookups can match on any of them.
export const DEPARTMENT_INTAKE_FIELDS: Record<string, IntakeFieldKey[]> = {
  amazon: ['accountBackground', 'goals'],
  ppc: ['accountBackground', 'campaignBackground', 'goals', 'advertisingBudget'],
  wholesale: ['accountBackground'],
}

export const DEFAULT_INTAKE_FIELDS: IntakeFieldKey[] = ['accountBackground', 'goals']

function normalizeDeptKey(key: string): string {
  return key.trim().toLowerCase()
}

export function getIntakeFieldsForDepartment(
  dept: { name?: string | null; shortName?: string | null; acronym?: string | null } | null | undefined
): IntakeFieldKey[] {
  if (!dept) return DEFAULT_INTAKE_FIELDS
  const candidates = [dept.name, dept.shortName, dept.acronym].filter(Boolean) as string[]
  for (const candidate of candidates) {
    const match = DEPARTMENT_INTAKE_FIELDS[normalizeDeptKey(candidate)]
    if (match) return match
  }
  return DEFAULT_INTAKE_FIELDS
}

// Spreadsheets commonly use a bare "-" (or "N/A"/"none") to mean "no data
// entered" rather than leaving the cell empty. Treating that as real data
// would, e.g., set a client's company name to the literal text "-". Shared
// between the CSV parser (client-side) and the import server action so a
// placeholder is dropped consistently regardless of which layer sees it.
const BLANK_PLACEHOLDER_VALUES = new Set(['-', '--', 'n/a', 'na', 'none', 'null', 'tbd'])

export function isBlankCell(value: string | null | undefined): boolean {
  if (!value) return true
  const trimmed = value.trim()
  if (!trimmed) return true
  return BLANK_PLACEHOLDER_VALUES.has(trimmed.toLowerCase())
}
