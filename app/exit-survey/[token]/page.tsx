import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ExitSurveyForm } from '@/components/exit-survey/ExitSurveyForm'

export default async function ExitSurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const invite = await prisma.exitSurveyInvite.findUnique({
    where: { token },
    include: {
      termination: {
        include: {
          vaProfile: { include: { user: true } },
        },
      },
    },
  })

  const invalidReason = !invite
    ? 'This exit survey link is invalid.'
    : invite.completedAt
      ? 'This exit survey has already been submitted.'
      : invite.expiresAt < new Date()
        ? 'This exit survey link has expired.'
        : null

  if (invalidReason || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Link no longer works</CardTitle>
            <CardDescription>{invalidReason}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Contact HR if you believe this is a mistake.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { user } = invite.termination.vaProfile

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Exit Survey</CardTitle>
          <CardDescription>
            Hi {user.firstName}, thank you for your time with VAA Philippines. This short survey helps us improve — no account or login needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExitSurveyForm token={token} />
        </CardContent>
      </Card>
    </div>
  )
}
