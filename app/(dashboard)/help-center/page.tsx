import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ComingSoon } from '@/components/support/ComingSoon'

export default async function HelpCenterPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <ComingSoon
      title="Help Center"
      description="We're building a help center with guides and answers to common questions."
    />
  )
}
