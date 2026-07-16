import { prisma } from '@/lib/prisma'
import { getCurrentUser, VA_MUTATOR_ROLES } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { listDriveFiles } from '@/lib/google/drive'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Mail } from 'lucide-react'
import { format } from 'date-fns'
import { VAProfileEditor } from '@/components/vas/VAProfileEditor'
import { TransferVAModal } from '@/components/vas/TransferVAModal'
import { AddSkillCard } from '@/components/vas/AddSkillCard'
import { VADetailPanel } from '@/components/vas/VADetailPanel'

const hrgRoles = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER', 'EXECUTIVE']

const STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-success',
  PENDING: 'bg-warning',
  TRANSFERRED: 'bg-info',
  RESIGNED: 'bg-destructive',
  REMOVED: 'bg-destructive',
  PROJECT_ENDED: 'bg-muted-foreground',
  CANCELLED: 'bg-destructive',
  BLACKLISTED: 'bg-destructive',
  UNIDENTIFIED: 'bg-muted-foreground',
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  PENDING: 'Pending',
  TRANSFERRED: 'Transferred',
  RESIGNED: 'Resigned',
  REMOVED: 'Removed',
  PROJECT_ENDED: 'Project Ended',
  CANCELLED: 'Cancelled',
  BLACKLISTED: 'Blacklisted',
  UNIDENTIFIED: 'Unidentified',
}

const AVAILABILITY_LABEL: Record<string, string> = {
  AVAILABLE: 'Available',
  PARTIALLY_ASSIGNED: 'Partially assigned',
  FULLY_ASSIGNED: 'Fully assigned',
  ON_LEAVE: 'On leave',
  UNAVAILABLE: 'Unavailable',
}

const HISTORY_EVENT_LABELS: Record<string, string> = {
  STATUS_CHANGE: 'Active Status',
  ENGAGEMENT_CHANGE: 'Engagement Status',
  UPSKILL: 'Upskill',
  RATE_CHANGE: 'Rate Change',
  PROMOTION: 'Promotion',
  DEPARTMENT_TRANSFER: 'Department Transfer',
}

function toDateString(value: Date | string | null | undefined): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  return value.toISOString()
}

export default async function VADetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')
  const isHRE = hrgRoles.includes(currentUser.systemRole)

  const va = await cached(`vas:detail:${id}`, [CACHE_TAGS.vas], 30, () =>
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
  const activeMemberships = va.user.memberships ?? []
  const primaryMem = activeMemberships.find((m) => m.isPrimary) ?? activeMemberships[0]
  const canViewSensitive = isHRE || currentUser.id === va.user.id
  const canEdit = VA_MUTATOR_ROLES.includes(currentUser.systemRole)

  const statusHistory = await cached(`vas:history:${va.user.id}`, [CACHE_TAGS.vas], 30, () =>
    prisma.vAHistory.findMany({
      where: { userId: va.user.id },
      include: { changedBy: { select: { firstName: true, lastName: true } }, department: { select: { name: true } } },
      orderBy: { effectiveDate: 'desc' },
    })
  )

  const assignedSkillIds = new Set(va.vaSkills.map((s) => s.skillId))
  const availableSkills = await cached('skills:catalog:active', [CACHE_TAGS.skills], 300, () =>
    prisma.skill.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } })
  )
  const skillOptions = availableSkills.filter((s) => !assignedSkillIds.has(s.id))

  const allDepartments = await cached('departments:catalog:assignable', [CACHE_TAGS.departments], 300, () =>
    prisma.department.findMany({
      where: { status: 'ACTIVE', parentId: { not: null } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, positions: { where: { isActive: true }, select: { id: true, title: true } } },
    })
  )

  const driveFiles = await listDriveFiles().catch(() => [])

  const editorData = {
    vaProfile: {
      id: va.id,
      status: va.status,
      engagementStatus: va.engagementStatus ?? null,
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
      gcashNumber: canViewSensitive ? (profile.gcashNumber ?? null) : null,
      phone: profile.phone ?? null,
      personalEmail: profile.personalEmail ?? null,
      workEmail: profile.workEmail ?? null,
      payoneerAccount: canViewSensitive ? (profile.payoneerAccount ?? null) : null,
      birthDate: toDateString(profile.birthDate),
      nonCelebrant: profile.nonCelebrant,
      address: profile.address ?? null,
      barangay: profile.barangay ?? null,
      cityMunicipality: profile.cityMunicipality ?? null,
      province: profile.province ?? null,
      zipCode: profile.zipCode ?? null,
      landmark: profile.landmark ?? null,
      regionCode: profile.regionCode ?? null,
      provinceCode: profile.provinceCode ?? null,
      cityCode: profile.cityCode ?? null,
      barangayCode: profile.barangayCode ?? null,
      emergencyContactName: profile.emergencyContactName ?? null,
      emergencyContactPhone: profile.emergencyContactPhone ?? null,
      emergencyContactRelation: profile.emergencyContactRelation ?? null,
      facebookName: profile.facebookName ?? null,
      facebookUrl: profile.facebookUrl ?? null,
      linkedinUrl: profile.linkedinUrl ?? null,
      passportNumber: canViewSensitive ? (profile.passportNumber ?? null) : null,
      passportPhoto: canViewSensitive ? (profile.passportPhoto ?? null) : null,
      philhealthNumber: canViewSensitive ? (profile.philhealthNumber ?? null) : null,
      philhealthPhoto: canViewSensitive ? (profile.philhealthPhoto ?? null) : null,
      signedContract: canViewSensitive ? (profile.signedContract ?? null) : null,
    } : null,
    membership: primaryMem ? {
      departmentName: primaryMem.department.name,
      positionTitle: primaryMem.position?.title ?? null,
    } : null,
    employment: emp ? {
      contractType: emp.contractType,
      employmentStatus: emp.employmentStatus,
      startDate: toDateString(emp.startDate)!,
      endDate: toDateString(emp.endDate),
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
    startDate: toDateString(a.startDate)!,
    endDate: toDateString(a.endDate),
    status: a.status,
  }))

  const statusHistoryData = statusHistory.map((h) => ({
    id: h.id,
    eventType: h.eventType,
    oldValue: h.oldValue,
    newValue: h.newValue,
    departmentName: h.department?.name ?? null,
    effectiveDate: toDateString(h.effectiveDate)!,
    reason: h.reason,
    changedByName: `${h.changedBy.firstName} ${h.changedBy.lastName}`.trim(),
    createdAt: toDateString(h.createdAt)!,
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
                <Badge variant={va.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">{STATUS_LABEL[va.status] ?? va.status}</Badge>
                {va.onHold && <Badge variant="outline" className="text-xs bg-warning/15 text-warning border-warning/20">On Hold</Badge>}
                {va.hybrid && <Badge variant="outline" className="text-xs bg-info/15 text-info border-info/20">Hybrid</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                <Mail className="h-3 w-3 inline mr-1" />{va.user.email}
                {activeMemberships.length > 0 && (
                  <> • {activeMemberships.map((m) => `${m.department.name}${m.position ? ` (${m.position.title})` : ''}`).join(' + ')}</>
                )}
              </p>
            </div>
          </div>
        </div>
        {canEdit && (
          <TransferVAModal
            vaProfileId={va.id}
            currentDepartmentName={primaryMem?.department.name ?? null}
            departments={allDepartments}
            canEdit={canEdit}
          />
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0 space-y-6">
          <VAProfileEditor
            data={editorData}
            skills={skillsData}
            assignments={assignmentData}
            documents={docData}
            driveFiles={driveFiles}
            currentUserId={currentUser.id}
            canEdit={canEdit}
          />

          {/* History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">History ({statusHistoryData.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {statusHistoryData.length === 0 ? (
                <p className="text-sm text-muted-foreground px-6 pb-4">No history recorded yet.</p>
              ) : (
                <div className="divide-y">
                  {statusHistoryData.map((h) => (
                    <div key={h.id} className="flex items-start justify-between gap-3 px-6 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                            {HISTORY_EVENT_LABELS[h.eventType] ?? h.eventType}
                          </Badge>
                          <span className="text-xs">
                            {h.oldValue ? `${h.oldValue.replace(/_/g, ' ')} → ` : ''}
                            <span className="font-medium">{(h.newValue ?? '—').replace(/_/g, ' ')}</span>
                          </span>
                          {h.departmentName && (
                            <span className="text-[10px] text-muted-foreground">({h.departmentName})</span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          by {h.changedByName || 'Unknown'}{h.reason ? ` — ${h.reason}` : ''}
                        </p>
                      </div>
                      <p className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                        {format(new Date(h.effectiveDate), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Skills */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Skills ({va.vaSkills.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {va.vaSkills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {va.vaSkills.map((s) => (
                    <Badge key={s.id} variant="outline">{s.skill.name} {s.proficiency && `— ${s.proficiency}`}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No services assigned yet.</p>
              )}
              {canEdit && <AddSkillCard vaProfileId={va.id} skillOptions={skillOptions} />}
            </CardContent>
          </Card>

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
        </div>
        <VADetailPanel
          statusLabel={va.onHold ? 'On Hold' : (STATUS_LABEL[va.status] ?? va.status)}
          statusDotClassName={va.onHold ? 'bg-warning' : (STATUS_DOT[va.status] ?? 'bg-muted-foreground')}
          availabilityLabel={AVAILABILITY_LABEL[va.availabilityStatus] ?? null}
          weeklyHours={va.preferredWorkHours ? Number(va.preferredWorkHours) : null}
          managerName={null}
          departmentName={primaryMem?.department.name ?? null}
          positionTitle={primaryMem?.position?.title ?? null}
          hourlyRate={va.hourlyRate ? Number(va.hourlyRate) : null}
          location={profile?.cityMunicipality ?? null}
        />
      </div>

      {!canEdit && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Read-only view. Contact HR for edits.
        </p>
      )}
    </div>
  )
}
