import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ComingSoon } from '@/components/support/ComingSoon'

export default async function FeedbackPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <ComingSoon
      title="Feedback"
      description="We're building a way for you to share feedback directly from the app."
    />
  )
}
