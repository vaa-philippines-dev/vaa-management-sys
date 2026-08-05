'use server'

// Server Actions in this file are intentionally public — reachable by a
// departing VA who has no Supabase session. submitExitSurvey authenticates
// via the one-time exit-survey token instead of requireAuth()/requireRole();
// see the PUBLIC_TOKEN_ACTIONS exception in scripts/check-action-auth.ts.

import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { logAudit } from '@/lib/audit'

export async function submitExitSurvey(token: string, formData: FormData) {
  const invite = await prisma.exitSurveyInvite.findUnique({
    where: { token },
    include: { termination: { select: { id: true, vaProfileId: true, vaProfile: { select: { userId: true } } } } },
  })
  if (!invite) throw new Error('This exit survey link is invalid.')
  if (invite.completedAt) throw new Error('This exit survey has already been submitted.')
  if (invite.expiresAt < new Date()) throw new Error('This exit survey link has expired.')

  const reasonForLeaving = (formData.get('reasonForLeaving') as string) || null
  const feedback = ((formData.get('feedback') as string) || '').trim() || null
  const wouldRecommendRaw = formData.get('wouldRecommend') as string | null
  const wouldRecommend = wouldRecommendRaw === 'yes' ? true : wouldRecommendRaw === 'no' ? false : null
  const additionalComments = ((formData.get('additionalComments') as string) || '').trim() || null

  await prisma.$transaction([
    prisma.exitSurveyResponse.create({
      data: { inviteId: invite.id, reasonForLeaving, feedback, wouldRecommend, additionalComments },
    }),
    prisma.exitSurveyInvite.update({ where: { id: invite.id }, data: { completedAt: new Date() } }),
    prisma.termination.update({
      where: { id: invite.termination.id },
      data: { workflowStatus: 'CLEARANCE_PENDING' },
    }),
  ])

  await logAudit({
    actorId: invite.termination.vaProfile.userId,
    action: 'CREATE',
    entityType: 'ExitSurveyResponse',
    entityId: invite.id,
    after: { reasonForLeaving, wouldRecommend },
    metadata: { viaForm: 'exit-survey-self-service' },
  })

  revalidatePath(`/vas/${invite.termination.vaProfileId}`)
  revalidateTag(CACHE_TAGS.vas, 'default')

  redirect(`/exit-survey/${token}/done`)
}
