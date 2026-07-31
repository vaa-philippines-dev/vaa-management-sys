// Best-effort PH mobile number normalization. Returns the trimmed original
// input unchanged if it doesn't look like a PH mobile number, rather than
// throwing — bad legacy data shouldn't block a profile save.

function digitsOnly(input: string): string {
  return input.replace(/[^\d+]/g, '')
}

function ph10Digits(input: string): string | null {
  const cleaned = digitsOnly(input)
  if (cleaned.startsWith('+63') && cleaned.length === 13) return cleaned.slice(3)
  if (cleaned.startsWith('63') && cleaned.length === 12) return cleaned.slice(2)
  if (cleaned.startsWith('0') && cleaned.length === 11) return cleaned.slice(1)
  if (cleaned.length === 10) return cleaned
  return null
}

/** Normalizes a WhatsApp number to the "+63" prefix format, e.g. "+639171234567". */
export function normalizeWhatsApp(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return trimmed
  const ten = ph10Digits(trimmed)
  return ten ? `+63${ten}` : trimmed
}

/** Normalizes a GCash number to the "09" prefix format, e.g. "09171234567". */
export function normalizeGcash(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return trimmed
  const ten = ph10Digits(trimmed)
  return ten ? `0${ten}` : trimmed
}
