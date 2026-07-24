import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Database } from 'lucide-react'
import { CmsSyncPanel } from '@/components/admin/CmsSyncPanel'

const CMS_SYNC_VIEW_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE']

export default async function CmsSyncPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser || !CMS_SYNC_VIEW_ROLES.includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-bold tracking-tight">Sync from CMS</h2>
          <p className="text-xs text-muted-foreground">
            Pulls Customers and Accounts from the CMS Google Sheet into this app. Nothing is ever deleted — existing rows are updated in place.
          </p>
        </div>
      </div>

      <CmsSyncPanel />
    </div>
  )
}
