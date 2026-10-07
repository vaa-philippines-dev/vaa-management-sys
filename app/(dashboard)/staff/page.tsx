import { redirect } from 'next/navigation'

// The Staff Masterlist is now the Staff table on /masterlist, where its params
// are s-prefixed (so they don't collide with the VA table's).
export default async function StaffMasterlistRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === 'string') sp.set(`s${k}`, v)
  redirect(`/masterlist${sp.size ? `?${sp}` : ''}`)
}
