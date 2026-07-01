import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { listDriveFiles } from '@/lib/google/drive'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Mail } from 'lucide-react'
import { format } from 'date-fns'
import { VAProfileEditor } from '@/components/vas/VAProfileEditor'

const hrgRoles = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'EXECUTIVE']

export default async function VADetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const currentUser = await getCurrentUser()
  const isHRE = currentUser ? hrgRoles.includes(currentUser.systemRole) : false

  const va = await cached('vas:detail', [CACHE_TAGS.vas], 30, () =>
    prisma.vAProfile.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            profile: true,
            memberships: {
              where: { endedAt: null },
              include: { department: true, position: true },
            },
            employmentRecords: { where: { isCurrent: true }, take: 1 },
          },
        },
        vaSkills: { include: { skill: true } },
        assignments: {
          include: { client: true, workLogs: true },
          orderBy: { startDate: 'desc' },
        },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    })
  )

  if (!va) notFound()
  const profile = va.user.profile
  const emp = va.user.employmentRecords?.[0]
  const primaryMem = va.user.memberships?.find((m) => m.isPrimary) ?? va.user.memberships?.[0]

  const driveFiles = await listDriveFiles().catch(() => [])

  const editorData = {
    vaProfile: {
      id: va.id,
      isActive: va.isActive,
      hybrid: va.hybrid,
      hourlyRate: va.hourlyRate ? Number(va.hourlyRate) : null,
      baseRate: va.baseRate ? Number(va.baseRate) : null,
      vaaPosition: va.vaaPosition ?? null,
      level: va.level ?? null,
      availabilityStatus: va.availabilityStatus,
      preferredWorkHours: va.preferredWorkHours ? Number(va.preferredWorkHours) : null,
      availableSchedule: va.availableSchedule ?? null,
      notes: va.notes ?? null,
      contractLink: va.contractLink ?? null,
      folder201Link: va.folder201Link ?? null,
      file201Link: va.file201Link ?? null,
      vaClientFileLink: va.vaClientFileLink ?? null,
      healthCheckFileLink: va.healthCheckFileLink ?? null,
      portfolioUrl: va.portfolioUrl ?? null,
      vaProfileLink: va.vaProfileLink ?? null,
      payoutSummaryLink: va.payoutSummaryLink ?? null,
      dept201FolderLink: va.dept201FolderLink ?? null,
    },
    user: {
      id: va.user.id,
      email: va.user.email,
      firstName: va.user.firstName,
      lastName: va.user.lastName,
    },
    profile: profile ? {
      gender: profile.gender ?? null,
      whatsappNumber: profile.whatsappNumber ?? null,
      gcashNumber: profile.gcashNumber ?? null,
      phone: profile.phone ?? null,
      personalEmail: profile.personalEmail ?? null,
      payoneerAccount: profile.payoneerAccount ?? null,
      birthDate: profile.birthDate ? profile.birthDate.toISOString() : null,
      nonCelebrant: profile.nonCelebrant,
      address: profile.address ?? null,
      barangay: profile.barangay ?? null,
      cityMunicipality: profile.cityMunicipality ?? null,
      province: profile.province ?? null,
      zipCode: profile.zipCode ?? null,
      landmark: profile.landmark ?? null,
      emergencyContactName: profile.emergencyContactName ?? null,
      emergencyContactPhone: profile.emergencyContactPhone ?? null,
      emergencyContactRelation: profile.emergencyContactRelation ?? null,
      facebookName: profile.facebookName ?? null,
      facebookUrl: profile.facebookUrl ?? null,
      linkedinUrl: profile.linkedinUrl ?? null,
      passportNumber: profile.passportNumber ?? null,
      passportPhoto: profile.passportPhoto ?? null,
      philhealthNumber: profile.philhealthNumber ?? null,
      philhealthPhoto: profile.philhealthPhoto ?? null,
      signedContract: profile.signedContract ?? null,
    } : null,
    membership: primaryMem ? {
      departmentName: primaryMem.department.name,
      positionTitle: primaryMem.position?.title ?? null,
    } : null,
    employment: emp ? {
      contractType: emp.contractType,
      employmentStatus: emp.employmentStatus,
      startDate: emp.startDate.toISOString(),
      endDate: emp.endDate ? emp.endDate.toISOString() : null,
    } : null,
  }

  const skillsData = va.vaSkills.map((s) => ({
    id: s.id,
    name: s.skill.name,
    proficiency: s.proficiency ?? null,
  }))

  const assignmentData = va.assignments.map((a) => ({
    id: a.id,
    clientName: a.client.name,
    type: a.type,
    agreedHours: Number(a.agreedHours),
    startDate: a.startDate.toISOString(),
    endDate: a.endDate ? a.endDate.toISOString() : null,
    status: a.status,
  }))

  const docData = va.documents.map((d) => ({
    id: d.id,
    documentType: d.documentType,
    fileName: d.fileName,
    googleDriveUrl: d.googleDriveUrl,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/vas">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
              {(va.user.firstName || 'V')[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">{va.user.firstName} {va.user.lastName}</h2>
                <Badge variant={va.isActive ? 'default' : 'secondary'} className="text-xs">{va.isActive ? 'Active' : 'Inactive'}</Badge>
                {va.hybrid && <Badge variant="outline" className="text-xs bg-purple-500/15 text-purple-700 border-purple-500/20">Hybrid</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                <Mail className="h-3 w-3 inline mr-1" />{va.user.email}
                {primaryMem && <> • {primaryMem.department.name}{primaryMem.position ? ` (${primaryMem.position.title})` : ''}</>}
              </p>
            </div>
          </div>
        </div>
      </div>

      {isHRE ? (
        <VAProfileEditor
          data={editorData}
          skills={skillsData}
          assignments={assignmentData}
          documents={docData}
          driveFiles={driveFiles}
          currentUserId={currentUser?.id ?? ''}
        />
      ) : (
        <>
          <VAProfileEditor
            data={editorData}
            skills={skillsData}
            assignments={assignmentData}
            documents={docData}
            driveFiles={driveFiles}
            currentUserId={currentUser?.id ?? ''}
          />

          {/* Non-HR just sees read-only; edit buttons are hidden via component props */}
        </>
      )}

      {/* Skills */}
      {va.vaSkills.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Skills ({va.vaSkills.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {va.vaSkills.map((s) => (
                <Badge key={s.id} variant="outline">{s.skill.name} {s.proficiency && `— ${s.proficiency}`}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assignments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Assignments ({va.assignments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {va.assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No assignments.</p>
          ) : (
            <div className="space-y-3">
              {va.assignments.map((a) => (
                <Link key={a.id} href={`/assignments/${a.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{a.client.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.type} • {Number(a.agreedHours)}h • {format(a.startDate, 'MMM dd, yyyy')}
                      {a.endDate && ` → ${format(a.endDate, 'MMM dd, yyyy')}`}
                    </p>
                  </div>
                  <Badge variant={a.status === 'ACTIVE' ? 'default' : 'secondary'}>{a.status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!isHRE && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Read-only view. Contact HR for edits.
        </p>
      )}
    </div>
  )
}
