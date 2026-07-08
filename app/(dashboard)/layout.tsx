import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import { RealtimeProvider } from '@/components/layout/RealtimeProvider'
import { getCurrentUser } from '@/lib/auth'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  const role = user?.userType === 'VIRTUAL_ASSISTANT' ? 'VA' : 'MANAGER'
  const isAdmin = user ? ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE'].includes(user.systemRole) : false

  return (
    <RealtimeProvider>
      <div className="flex h-screen bg-background">
        <Sidebar role={role} isAdmin={isAdmin} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Navbar />
          <main className="flex-1 overflow-auto p-6">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </RealtimeProvider>
  )
}
