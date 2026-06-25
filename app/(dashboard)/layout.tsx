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
  const role = user?.role === 'VA' ? 'VA' : 'MANAGER'

  return (
    <RealtimeProvider>
      <div className="flex h-screen bg-background">
        <Sidebar role={role} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Navbar />
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </RealtimeProvider>
  )
}
