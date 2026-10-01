import { Suspense } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getMyChannels } from './actions'
import { InboxView } from '@/components/inbox/InboxView'

// Inbox is parked, not deleted — it sits under the sidebar's "On Going"
// section and is reachable only by the admins who own that section, so it
// isn't part of day-to-day navigation while it's unfinished. It also lost its
// live delivery: messaging used to hold a Supabase Realtime channel per open
// conversation, and with Realtime removed app-wide a conversation only updates
// on send or reload. That is survivable for an admin-only tool and not
// something to reopen to everyone until live delivery is settled.
const INBOX_VIEW_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE']

export default async function InboxPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!INBOX_VIEW_ROLES.includes(user.systemRole)) redirect('/dashboard')

  const { channels, directMessages } = await getMyChannels()

  return (
    <div data-inbox-page className="h-full">
      <Suspense fallback={null}>
        <InboxView
          channels={channels}
          directMessages={directMessages}
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
