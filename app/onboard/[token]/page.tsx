import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { OnboardingForm } from '@/components/onboarding/OnboardingForm'

export default async function OnboardingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const invite = await prisma.vAOnboardingInvite.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          profile: true,
          memberships: { where: { isPrimary: true }, include: { department: true } },
        },
      },
    },
  })

  const invalidReason = !invite
    ? 'This onboarding link is invalid.'
    : invite.completedAt
      ? 'This onboarding link has already been used.'
      : invite.expiresAt < new Date()
        ? 'This onboarding link has expired.'
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
              Contact HR to request a new onboarding link.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { user } = invite
  const department = user.memberships[0]?.department.name ?? null

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Welcome, {user.firstName}!</CardTitle>
          <CardDescription>
            {department ? `${department} — ` : ''}Complete your profile below so HR and payroll have everything they need.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm
            token={token}
            firstName={user.firstName}
            lastName={user.lastName}
            prefill={{
              middleName: user.middleName,
              extName: user.extName,
              whatsappNumber: user.profile?.whatsappNumber ?? null,
              gcashNumber: user.profile?.gcashNumber ?? null,
              houseNumber: user.profile?.houseNumber ?? null,
              address: user.profile?.address ?? null,
              zipCode: user.profile?.zipCode ?? null,
              landmark: user.profile?.landmark ?? null,
              regionCode: user.profile?.regionCode ?? null,
              provinceCode: user.profile?.provinceCode ?? null,
              cityCode: user.profile?.cityCode ?? null,
              barangayCode: user.profile?.barangayCode ?? null,
              facebookName: user.profile?.facebookName ?? null,
              facebookUrl: user.profile?.facebookUrl ?? null,
              linkedinUrl: user.profile?.linkedinUrl ?? null,
              passportNumber: user.profile?.passportNumber ?? null,
              philhealthNumber: user.profile?.philhealthNumber ?? null,
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
