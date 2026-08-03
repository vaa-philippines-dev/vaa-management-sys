'use server'

import { prisma } from '@/lib/prisma'
import { requireRole, AGENT_MUTATOR_ROLES } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { CACHE_TAGS } from '@/lib/cache'
import { revalidateTag } from 'next/cache'

/**
 * Approves or rejects one AI Agent suggestion. This is the one place a human
 * decision gets recorded — nothing upstream (vaa-agent) ever writes a status
 * other than PENDING or SUPERSEDED.
 */
export async function decideSuggestion(id: string, status: 'APPROVED' | 'REJECTED', note?: string) {
  const actor = await requireRole(...AGENT_MUTATOR_ROLES)

  const suggestion = await prisma.agentSuggestion.findUnique({
    where: { id },
    select: { id: true, status: true, kind: true, clientId: true },
  })
  if (!suggestion) throw new Error('Suggestion not found')
  if (suggestion.status !== 'PENDING') throw new Error('This suggestion has already been decided.')

  await prisma.$transaction(async (tx) => {
    await tx.agentSuggestion.update({
      where: { id },
      data: {
        status,
        decidedById: actor.id,
        decidedAt: new Date(),
        decisionNote: note?.trim() || null,
      },
    })

    // Approving one VA match resolves that client's whole shortlist — the
    // other ranked candidates are no longer a live decision, so they're
    // superseded rather than left sitting in the queue looking still-pending.
    if (status === 'APPROVED' && suggestion.kind === 'VA_MATCH' && suggestion.clientId) {
      await tx.agentSuggestion.updateMany({
        where: { clientId: suggestion.clientId, kind: 'VA_MATCH', status: 'PENDING', id: { not: id } },
        data: { status: 'SUPERSEDED', decidedAt: new Date() },
      })
    }
  })

  await logAudit({
    actorId: actor.id,
    action: status === 'APPROVED' ? 'APPROVE' : 'REJECT',
    entityType: 'AgentSuggestion',
    entityId: id,
    after: { status, note: note?.trim() || null },
  })

  revalidateTag(CACHE_TAGS.agent, 'default')
}
