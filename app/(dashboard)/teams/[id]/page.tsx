import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { TeamDetailView } from '@/components/teams/TeamDetailView'

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return <TeamDetailView teamId={id} user={user} />
}
