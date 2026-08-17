import { prisma } from '@/lib/prisma'

// Well-known actor satisfying AuditLog.actorId/Ticket.createdBy's FK
// requirement for records created or updated through a public, no-login
// form (app/resign, app/exit-clearance/[token]) rather than an authenticated
// session. isActive: false keeps it out of assignable-user dropdowns,
// matching the sync engine's SYSTEM_ACTOR_EMAIL pattern
// (lib/sync/va-connections.ts).
const PUBLIC_FORM_ACTOR_EMAIL = 'public-form@system.internal'

export async function getPublicFormActorId(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: PUBLIC_FORM_ACTOR_EMAIL },
    update: {},
    create: {
      email: PUBLIC_FORM_ACTOR_EMAIL,
      firstName: 'Public Form',
      lastName: 'Submission',
      systemRole: 'HR',
      userType: 'INTERNAL_STAFF',
      isActive: false,
      isBot: true,
    },
  })
  return user.id
}
