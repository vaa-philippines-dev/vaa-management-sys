import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import { RealtimeProvider } from '@/components/layout/RealtimeProvider'
import { SidebarCollapseProvider } from '@/components/layout/SidebarCollapseContext'
import { VACsvImportProvider } from '@/components/vas/VACsvImportContext'
import { VACsvImportFloatingWidget } from '@/components/vas/VACsvImportFloatingWidget'
import { ImportVACsvModal } from '@/components/vas/ImportVACsvModal'
import { getCurrentUser } from '@/lib/auth'
import { getSidebarFavorites } from '@/lib/favorites'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  const role = user?.userType === 'VIRTUAL_ASSISTANT' ? 'VA' : 'MANAGER'
  const isAdmin = user ? ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE'].includes(user.systemRole) : false
  const favorites = user && role === 'MANAGER' ? await getSidebarFavorites(user.id) : []

  return (
    <RealtimeProvider>
      <SidebarCollapseProvider>
        <VACsvImportProvider>
          <div className="flex h-screen bg-background">
            <Sidebar role={role} isAdmin={isAdmin} initialFavorites={favorites} />
            <div className="flex flex-1 flex-col overflow-hidden">
              <Navbar />
              <main className="flex-1 overflow-auto p-6 has-[[data-inbox-page]]:overflow-hidden has-[[data-inbox-page]]:p-0">
                <div className="mx-auto max-w-7xl has-[[data-inbox-page]]:h-full has-[[data-inbox-page]]:max-w-none">
                  {children}
                </div>
              </main>
            </div>
          </div>
          <VACsvImportFloatingWidget />
          <ImportVACsvModal />
        </VACsvImportProvider>
      </SidebarCollapseProvider>
    </RealtimeProvider>
  )
}
