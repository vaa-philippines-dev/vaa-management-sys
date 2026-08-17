import { prisma } from '@/lib/prisma'

export async function nextTerminationTicketNumber(): Promise<string> {
  const count = await prisma.ticket.count()
  return `TCK-${String(count + 1).padStart(5, '0')}`
}
