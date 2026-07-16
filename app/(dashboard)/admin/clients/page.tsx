import { getCurrentUser } from '@/lib/auth'
import { Card, CardContent } from '@/components/ui/card'
import { redirect } from 'next/navigation'
import { Building2 } from 'lucide-react'

const adminViewRoles = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE']

export default async function AdminClientsPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser || !adminViewRoles.includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Clients</h2>
        <p className="text-xs text-muted-foreground">Admin-level client management</p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
            <Building2 className="h-6 w-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium">Coming soon</p>
          <p className="text-xs text-muted-foreground mt-1">Admin client management will be added here.</p>
        </CardContent>
      </Card>
    </div>
  )
}
