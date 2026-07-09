import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getMyChannels } from './actions'
import { MessagesView } from '@/components/messages/MessagesView'

export default async function MessagesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const channels = await getMyChannels()

  return (
    <div className="h-[calc(100vh-8.5rem)]">
      <MessagesView
        channels={channels}
        currentUser={{ id: user.id, firstName: user.firstName, lastName: user.lastName }}
      />
    </div>
  )
}
