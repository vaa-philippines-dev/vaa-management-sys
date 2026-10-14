// TYPE OF VA labels — client-safe (no Prisma import), shared by the Add VA
// form, the profile editor and the server action that validates the value.
export const VA_TYPE_OPTIONS = [
  { value: 'REGULAR', label: 'Regular' },
  { value: 'EXPERIENCED_EXTERNAL', label: 'Experienced (External)' },
  { value: 'SENIOR_EXTERNAL', label: 'Senior (External)' },
] as const

export type VATypeValue = (typeof VA_TYPE_OPTIONS)[number]['value']

export const VA_TYPE_LABELS: Record<string, string> = Object.fromEntries(VA_TYPE_OPTIONS.map((o) => [o.value, o.label]))

export function parseVAType(raw: unknown): VATypeValue | null {
  return VA_TYPE_OPTIONS.some((o) => o.value === raw) ? (raw as VATypeValue) : null
}
