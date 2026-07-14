import { redirect } from 'next/navigation'

// Clients Monitoring was folded into /clients (which is now department-scoped
// for the Department-category audience) — keep this route as a redirect so
// existing links/bookmarks/favorites don't break.
export default function ClientsMonitoringRedirect() {
  redirect('/clients')
}
