import { Suspense } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getMyChannels } from './actions'
import { InboxView } from '@/components/inbox/InboxView'

export default async function InboxPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const channels = await getMyChannels()

  return (
    <div data-inbox-page className="h-full">
      <Suspense fallback={null}>
        <InboxView
          channels={channels}
          currentUser={{
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            avatarUrl: user.avatarUrl,
            systemRole: user.systemRole,
            messageColor: user.messageColor,
          }}
        />
      </Suspense>
    </div>
  )
}
