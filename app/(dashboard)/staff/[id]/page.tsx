import { prisma } from '@/lib/prisma'
import { getCurrentUser, STAFF_MUTATOR_ROLES, VA_SENSITIVE_INFO_EDIT_ROLES } from '@/lib/auth'
import { getStaffPerson } from '@/lib/staff'
import { STAFF_STATUS_TONE, titleCase } from '@/lib/staff-fields'
import { ROLE_LABELS } from '@/lib/role-labels'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { ArrowLeft, Mail } from 'lucide-react'
import { differenceInMonths } from 'date-fns'
import { OnboardingInviteControl } from '@/components/vas/OnboardingInviteControl'
import { StaffProfileEditor } from '@/components/staff/StaffProfileEditor'
import { isTeamScoped } from '@/lib/scope'

const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

// Sheet dates sit at UTC midnight — format in UTC so no timezone shifts them.
const formatDate = (d: Date | null) =>
  d ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(d) : null

function tenure(from: Date | null, until: Date | null): string | null {
  if (!from) return null
  const months = differenceInMonths(until ?? new Date(), from)
  if (months < 0) return null
  const y = Math.floor(months / 12)
  const m = months % 12
  return y === 0 ? `${m}m` : m === 0 ? `${y}y` : `${y}y ${m}m`
}

// The Staff 201 — /vas/[id]'s layout for internal staff. [id] is any of the
// person's StaffRecord ids (the masterlist links their latest).
export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')

  const person = await getStaffPerson(id)
  if (!person) notFound()
  const latest = person.latest
  const userId = latest.userId
  const isSelf = !!userId && userId === currentUser.id
  // Same audience as the masterlist, plus Team Leaders (VA accounts) opening their own.
  if (currentUser.userType === 'VIRTUAL_ASSISTANT' && !isSelf) notFound()
  // A staff-account Team Leader's view stops at their own team (lib/scope.ts),
  // same as the masterlist — only their own 201 is open to them.
  if (isTeamScoped(currentUser) && !isSelf) notFound()

  const canEdit = STAFF_MUTATOR_ROLES.includes(currentUser.systemRole)
  const canViewSensitive = VA_SENSITIVE_INFO_EDIT_ROLES.includes(currentUser.systemRole) || isSelf

  const [user, onboardingInvite] = userId
    ? await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, include: { profile: true, vaProfile: { select: { id: true } } } }),
        prisma.vAOnboardingInvite.findUnique({ where: { userId }, select: { expiresAt: true, completedAt: true } }),
      ])
    : [null, null]

  const onboardingStatus: 'never' | 'pending' | 'expired' | 'completed' = !onboardingInvite
    ? 'never'
    : onboardingInvite.completedAt
      ? 'completed'
      : onboardingInvite.expiresAt < new Date()
        ? 'expired'
        : 'pending'

  const p = user?.profile
  const personData = user
    ? {
        user: {
          id: user.id,
          email: user.email,
          employeeId: user.employeeId ?? null,
          firstName: user.firstName,
          middleName: user.middleName ?? null,
          lastName: user.lastName,
          extName: user.extName ?? null,
        },
        profile: p
          ? {
              gender: p.gender ?? null,
              whatsappNumber: p.whatsappNumber ?? null,
              gcashNumber: canViewSensitive ? (p.gcashNumber ?? null) : null,
              phone: p.phone ?? null,
              personalEmail: p.personalEmail ?? null,
              workEmail: p.workEmail ?? null,
              payoneerAccount: canViewSensitive ? (p.payoneerAccount ?? null) : null,
              birthDate: p.birthDate?.toISOString() ?? null,
              nonCelebrant: p.nonCelebrant,
              address: p.address ?? null,
              houseNumber: p.houseNumber ?? null,
              barangay: p.barangay ?? null,
              cityMunicipality: p.cityMunicipality ?? null,
              province: p.province ?? null,
              zipCode: p.zipCode ?? null,
              landmark: p.landmark ?? null,
              regionCode: p.regionCode ?? null,
              provinceCode: p.provinceCode ?? null,
              cityCode: p.cityCode ?? null,
              barangayCode: p.barangayCode ?? null,
              emergencyContactName: p.emergencyContactName ?? null,
              emergencyContactPhone: p.emergencyContactPhone ?? null,
              emergencyContactRelation: p.emergencyContactRelation ?? null,
              religion: p.religion ?? null,
              payoneerId: canViewSensitive ? (p.payoneerId ?? null) : null,
              facebookName: p.facebookName ?? null,
              facebookUrl: p.facebookUrl ?? null,
              linkedinUrl: p.linkedinUrl ?? null,
              passportNumber: canViewSensitive ? (p.passportNumber ?? null) : null,
              passportPhoto: canViewSensitive ? (p.passportPhoto ?? null) : null,
              philhealthNumber: canViewSensitive ? (p.philhealthNumber ?? null) : null,
              philhealthPhoto: canViewSensitive ? (p.philhealthPhoto ?? null) : null,
              signedContract: canViewSensitive ? (p.signedContract ?? null) : null,
            }
          : null,
      }
    : null

  const offboarded = latest.generalStatus !== 'ACTIVE' && latest.generalStatus !== 'ON HOLD'
  const engagement = {
    recordId: latest.id,
    staffId: latest.staffId,
    department: latest.department,
    subdepartment: latest.subdepartment,
    position: latest.position,
    level: latest.level,
    workEmail: latest.workEmail,
    staffHireDate: isoDay(person.staffHireDate),
    hireDate: isoDay(person.vaaHireDate),
    startDate: isoDay(latest.startDate),
    eocDate: isoDay(latest.eocDate),
    generalStatus: latest.generalStatus,
    employmentStatus: latest.employmentStatus,
    remarks: latest.remarks,
    tenure: tenure(person.staffHireDate, offboarded ? latest.eocDate : null),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/masterlist#staff">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
              {(latest.firstName || 'S')[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight">{person.name}</h2>
                {latest.staffId && <Badge variant="outline" className="text-xs font-mono">{latest.staffId}</Badge>}
                {latest.generalStatus && (
                  <Badge variant={latest.generalStatus === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">{titleCase(latest.generalStatus)}</Badge>
                )}
                {user && (
                  <Badge variant="outline" className="text-xs">
                    {user.userType === 'VIRTUAL_ASSISTANT' ? 'VA account' : ROLE_LABELS[user.systemRole] ?? user.systemRole}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {user && <><Mail className="h-3 w-3 inline mr-1" />{user.email}</>}
                {latest.department && <>{user ? ' • ' : ''}{latest.department}{latest.subdepartment && latest.subdepartment !== latest.department ? ` / ${latest.subdepartment}` : ''}{latest.position ? ` (${latest.position})` : ''}</>}
              </p>
            </div>
          </div>
        </div>
        {canEdit && user && (
          <div className="flex items-center gap-2">
            <OnboardingInviteControl userId={user.id} status={onboardingStatus} expiresAt={onboardingInvite?.expiresAt.toISOString() ?? null} />
            {user.vaProfile && (
              <Link href={`/vas/${user.vaProfile.id}`}>
                <Button variant="outline" size="sm" className="text-xs h-8">VA profile</Button>
              </Link>
            )}
          </div>
        )}
      </div>

      <StaffProfileEditor
        name={person.name}
        engagement={engagement}
        person={personData}
        account={user ? { userType: user.userType, systemRole: user.systemRole } : null}
        currentUserId={currentUser.id}
        canEdit={canEdit}
        canViewSensitive={canViewSensitive}
      />

      {/* One row per engagement, same as the sheet — a promotion or transfer adds a row. */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Engagement History ({person.records.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {person.records.map((r, i) => (
              <div key={r.id} className="flex items-start justify-between gap-3 px-6 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium">{r.position ?? 'No position'}</span>
                    {r.department && <Badge variant="outline" className="text-[10px] py-0 px-1.5">{r.department}{r.subdepartment && r.subdepartment !== r.department ? ` / ${r.subdepartment}` : ''}</Badge>}
                    {r.generalStatus && <StatusIndicator tone={STAFF_STATUS_TONE[r.generalStatus] ?? 'neutral'}>{titleCase(r.generalStatus)}</StatusIndicator>}
                    {i === 0 && <Badge variant="secondary" className="text-[10px] py-0 px-1.5">Current</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {r.employmentStatus ? titleCase(r.employmentStatus) : 'No employment status'}
                    {r.level ? ` • ${r.level}` : ''}
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                  {formatDate(r.startDate) ?? '—'}
                  {r.eocDate && ` → ${formatDate(r.eocDate)}`}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {!canEdit && (
        <p className="text-xs text-muted-foreground text-center py-4">Read-only view. Contact HR for edits.</p>
      )}
    </div>
  )
}
