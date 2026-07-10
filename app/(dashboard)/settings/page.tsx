import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AvatarUploader } from '@/components/settings/AvatarUploader'

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Settings</h2>
        <p className="text-xs text-muted-foreground">Manage your profile.</p>
      </div>

      <div className="max-w-md rounded-xl border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold">Profile Picture</h3>
        <AvatarUploader
          avatarUrl={user.avatarUrl}
          displayName={displayName}
        />
      </div>
    </div>
  )
}
