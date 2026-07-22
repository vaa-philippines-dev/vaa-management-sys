import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import { RealtimeProvider } from '@/components/layout/RealtimeProvider'
import { SidebarCollapseProvider } from '@/components/layout/SidebarCollapseContext'
import { VACsvImportProvider } from '@/components/vas/VACsvImportContext'
import { VACsvImportFloatingWidget } from '@/components/vas/VACsvImportFloatingWidget'
import { ImportVACsvModal } from '@/components/vas/ImportVACsvModal'
import { ClientCsvImportProvider } from '@/components/clients/ClientCsvImportContext'
import { ClientCsvImportFloatingWidget } from '@/components/clients/ClientCsvImportFloatingWidget'
import { ImportClientCsvModal } from '@/components/clients/ImportClientCsvModal'
import { getCurrentUser, CLIENT_MUTATOR_ROLES } from '@/lib/auth'
import { getSidebarFavorites } from '@/lib/favorites'
import { isTeamAffiliated } from '@/lib/teams'
import { prisma } from '@/lib/prisma'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  const role = user?.userType === 'VIRTUAL_ASSISTANT' ? 'VA' : 'MANAGER'
  const isAdmin = user ? ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE'].includes(user.systemRole) : false
  const favorites = user && role === 'MANAGER' ? await getSidebarFavorites(user.id) : []

  const isManagerDeptRole = user ? ['DEPT_MANAGER', 'OPERATIONS_MANAGER'].includes(user.systemRole) : false
  const isHR = user?.systemRole === 'HR'
  const showDepartmentSection =
    isAdmin ||
    isHR ||
    isManagerDeptRole ||
    (user?.userType === 'VIRTUAL_ASSISTANT' ? await isTeamAffiliated(user.id) : false)

  const canImportClients = user ? CLIENT_MUTATOR_ROLES.includes(user.systemRole) : false
  const serviceDepartments = canImportClients
    ? await prisma.department.findMany({
        where: { level: 'SERVICE', status: 'ACTIVE' },
        select: { id: true, name: true, shortName: true, acronym: true },
        orderBy: { sortOrder: 'asc' },
      })
    : []

  return (
    <RealtimeProvider>
      <SidebarCollapseProvider>
        <VACsvImportProvider>
          <ClientCsvImportProvider>
            <div className="flex h-screen bg-background">
              <Sidebar role={role} isAdmin={isAdmin} initialFavorites={favorites} showDepartmentSection={showDepartmentSection} />
              <div className="flex flex-1 flex-col overflow-hidden">
                <Navbar />
                <main className="flex-1 overflow-auto p-6 has-[[data-inbox-page]]:overflow-hidden has-[[data-inbox-page]]:p-0">
                  <div className="mx-auto max-w-7xl has-[[data-inbox-page]]:h-full has-[[data-inbox-page]]:max-w-none has-[[data-wide-page]]:max-w-none">
                    {children}
                  </div>
                </main>
              </div>
            </div>
            <VACsvImportFloatingWidget />
            <ImportVACsvModal />
            {canImportClients && (
              <>
                <ClientCsvImportFloatingWidget />
                <ImportClientCsvModal departments={serviceDepartments} />
              </>
            )}
          </ClientCsvImportProvider>
        </VACsvImportProvider>
      </SidebarCollapseProvider>
    </RealtimeProvider>
  )
}
