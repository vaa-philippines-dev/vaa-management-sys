import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Shield,
  Briefcase,
  FileText,
  DollarSign,
  Calendar,
  User,
  Users,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { format } from 'date-fns'

const hrgRoles = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'EXECUTIVE']

export default async function VADetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const currentUser = await getCurrentUser()
  const isHRE = currentUser ? hrgRoles.includes(currentUser.systemRole) : false

  const va = await prisma.vAProfile.findUnique({
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

  if (!va) notFound()
  const profile = va.user.profile
  const emp = va.user.employmentRecords?.[0]
  const primaryMem = va.user.memberships?.find((m) => m.isPrimary) ?? va.user.memberships?.[0]

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
                {va.user.email}
                {primaryMem && <> • {primaryMem.department.name}{primaryMem.position ? ` (${primaryMem.position.title})` : ''}</>}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <Section title="Personal Information" icon={User} canEdit={isHRE} vaId={va.id}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 text-sm">
          <Field label="First Name" value={va.user.firstName} />
          <Field label="Last Name" value={va.user.lastName} />
          <Field label="Gender" value={profile?.gender} />
          <Field label="Birthday" value={profile?.birthDate ? format(profile.birthDate, 'MMM dd, yyyy') : null} />
          <Field label="Non-Celebrant" value={profile?.nonCelebrant ? 'Yes' : null} />
          <Field label="Work Email" value={va.user.email} />
          <Field label="WhatsApp" value={profile?.whatsappNumber} link={`https://wa.me/${profile?.whatsappNumber?.replace(/\D/g, '')}`} />
          <Field label="GCASH" value={profile?.gcashNumber} />
        </div>
      </Section>

      {/* Address */}
      {profile && (
        <Section title="Address" icon={MapPin} canEdit={isHRE} vaId={va.id}>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 text-sm">
            <Field label="Barangay" value={profile.barangay} />
            <Field label="City / Municipality" value={profile.cityMunicipality} />
            <Field label="Province" value={profile.province} />
            <Field label="Zip Code" value={profile.zipCode} />
            <Field label="Landmark" value={profile.landmark} />
          </div>
        </Section>
      )}

      {/* Employment */}
      <Section title="Employment" icon={Briefcase} canEdit={isHRE} vaId={va.id}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 text-sm">
          <Field label="Contract Type" value={emp?.contractType?.replace(/_/g, ' ')} />
          <Field label="Employment Status" value={emp?.employmentStatus?.replace(/_/g, ' ')} />
          <Field label="Hire Date" value={emp?.startDate ? format(emp.startDate, 'MMM dd, yyyy') : null} />
          <Field label="EOC / End Date" value={emp?.endDate ? format(emp.endDate, 'MMM dd, yyyy') : '—'} />
          <Field label="VAA Position" value={va.vaaPosition} />
          <Field label="Level" value={va.level} />
          <Field label="Base Rate (PHP)" value={va.baseRate ? `₱${Number(va.baseRate).toLocaleString()}/hr` : null} />
          <Field label="Hourly Rate (USD)" value={va.hourlyRate ? `$${Number(va.hourlyRate).toFixed(2)}/hr` : null} />
          <Field label="Preferred Hours" value={va.preferredWorkHours ? `${Number(va.preferredWorkHours)}h/week` : null} />
          <Field label="Available Schedule" value={va.availableSchedule} />
          <Field label="Availability" value={va.availabilityStatus?.replace(/_/g, ' ')} badge />
          <Field label="Hybrid" value={va.hybrid ? 'Yes (multiple departments)' : 'No'} />
        </div>
      </Section>

      {/* Emergency Contact */}
      {profile && (profile.emergencyContactName || profile.emergencyContactPhone) && (
        <Section title="Emergency Contact" icon={Phone} canEdit={isHRE} vaId={va.id}>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <Field label="Contact Name" value={profile.emergencyContactName} />
            <Field label="Contact Number" value={profile.emergencyContactPhone} />
            <Field label="Relationship" value={profile.emergencyContactRelation} />
          </div>
        </Section>
      )}

      {/* Socials */}
      {profile && (profile.facebookUrl || profile.linkedinUrl) && (
        <Section title="Socials" icon={Users} canEdit={isHRE} vaId={va.id}>
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <Field label="Facebook" value={profile.facebookUrl} link={profile.facebookUrl} />
            <Field label="LinkedIn" value={profile.linkedinUrl} link={profile.linkedinUrl} />
          </div>
        </Section>
      )}

      {/* Identification */}
      {profile && (
        <Section title="Identification" icon={Shield} canEdit={isHRE} vaId={va.id}>
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <Field label="Passport Number" value={profile.passportNumber} />
            <Field label="Passport Photo" value={profile.passportPhoto ? 'Uploaded' : null} link={profile.passportPhoto} />
            <Field label="PhilHealth Number" value={profile.philhealthNumber} />
            <Field label="PhilHealth Photo" value={profile.philhealthPhoto ? 'Uploaded' : null} link={profile.philhealthPhoto} />
          </div>
        </Section>
      )}

      {/* Documents */}
      <Section title="Documents" icon={FileText} canEdit={isHRE} vaId={va.id}>
        <div className="grid gap-2 text-sm">
          {[
            { label: 'Contract', link: va.contractLink },
            { label: '201 Folder', link: va.folder201Link },
            { label: '201 File', link: va.file201Link },
            { label: 'VA-Client File', link: va.vaClientFileLink },
            { label: 'Health Check File', link: va.healthCheckFileLink },
            { label: 'VA Portfolio', link: va.portfolioUrl },
            { label: 'VA Profile', link: va.vaProfileLink },
            { label: 'Payout Summary', link: va.payoutSummaryLink },
            { label: '201 Dept Folder', link: va.dept201FolderLink },
          ].filter((d) => d.link).map((doc) => (
            <DocRow key={doc.label} label={doc.label} link={doc.link!} />
          ))}
          {va.documents.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">Uploaded Files</p>
              {va.documents.map((d) => (
                <DocRow key={d.id} label={`${d.documentType.replace(/_/g, ' ')} — ${d.fileName}`} link={d.googleDriveUrl} />
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* Skills */}
      {va.vaSkills.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {va.vaSkills.map((s) => (
                <Badge key={s.id} variant="outline">{s.skill.name} {s.proficiency && `(${s.proficiency})`}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assignments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active Assignments ({va.assignments.length})</CardTitle>
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
                      {a.type} • {Number(a.agreedHours)}h agreed • {format(a.startDate, 'MMM dd, yyyy')}
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

      {/* Notes */}
      {va.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{va.notes}</CardContent>
        </Card>
      )}

      {/* Permission notice */}
      {!isHRE && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Read-only view. Contact HR for updates.
        </p>
      )}
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  canEdit,
  vaId,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  canEdit: boolean
  vaId: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          {canEdit && (
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Field({
  label,
  value,
  link,
  badge,
}: {
  label: string
  value: string | null | undefined
  link?: string | null
  badge?: boolean
}) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      {badge ? (
        <Badge variant="outline" className="text-xs">{value}</Badge>
      ) : link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
          {value} <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <p className="text-sm">{value}</p>
      )}
    </div>
  )
}

function DocRow({ label, link }: { label: string; link: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm">{label}</span>
      <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
        <FileText className="h-3 w-3" /> View
      </a>
    </div>
  )
}
