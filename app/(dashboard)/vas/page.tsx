import { redirect } from 'next/navigation'

// The VA Masterlist is now the VA table on /masterlist. Its params are the
// same there (unprefixed), so old links and bookmarks carry straight over.
export default async function VAMasterlistRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === 'string') sp.set(k, v)
  redirect(`/masterlist${sp.size ? `?${sp}` : ''}`)
}
