'use client'

import { useState, useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Pencil,
  Check,
  X,
  ExternalLink,
  FileText,
  MapPin,
  Shield,
  Briefcase,
  Phone,
  User,
  Users,
  HardDrive,
} from 'lucide-react'
import { updateVAProfile, updateUserProfile } from '@/app/(dashboard)/vas/actions'
import { format } from 'date-fns'
import type { DriveFile } from '@/lib/google/drive'

type VAData = {
  vaProfile: {
    id: string
    isActive: boolean
    hybrid: boolean
    hourlyRate: number | null
    baseRate: number | null
    vaaPosition: string | null
    level: string | null
    availabilityStatus: string
    preferredWorkHours: number | null
    availableSchedule: string | null
    notes: string | null
    contractLink: string | null
    folder201Link: string | null
    file201Link: string | null
    vaClientFileLink: string | null
    healthCheckFileLink: string | null
    portfolioUrl: string | null
    vaProfileLink: string | null
    payoutSummaryLink: string | null
    dept201FolderLink: string | null
  }
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
  }
  profile: {
    gender: string | null
    whatsappNumber: string | null
    gcashNumber: string | null
    phone: string | null
    birthDate: string | null
    nonCelebrant: boolean
    barangay: string | null
    cityMunicipality: string | null
    province: string | null
    zipCode: string | null
    landmark: string | null
    emergencyContactName: string | null
    emergencyContactPhone: string | null
    emergencyContactRelation: string | null
    facebookUrl: string | null
    linkedinUrl: string | null
    passportNumber: string | null
    passportPhoto: string | null
    philhealthNumber: string | null
    philhealthPhoto: string | null
  } | null
  membership: { departmentName: string; positionTitle: string | null } | null
  employment: { contractType: string; employmentStatus: string; startDate: string; endDate: string | null } | null
}

export function VAProfileEditor({
  data,
  skills,
  assignments,
  documents,
  driveFiles,
}: {
  data: VAData
  skills: { id: string; name: string; proficiency: string | null }[]
  assignments: { id: string; clientName: string; type: string; agreedHours: number; startDate: string; endDate: string | null; status: string }[]
  documents: { id: string; documentType: string; fileName: string; googleDriveUrl: string }[]
  driveFiles: DriveFile[]
}) {
  const [editSection, setEditSection] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const closeEdit = () => setEditSection(null)

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <EditableSection
        title="Personal Information"
        icon={User}
        isEditing={editSection === 'personal'}
        onEdit={() => setEditSection('personal')}
        onCancel={closeEdit}
        saving={saving}
      >
        {editSection === 'personal' ? (
          <PersonalForm data={data} onSaved={closeEdit} setSaving={setSaving} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 text-sm">
            <F label="First Name" value={data.user.firstName} />
            <F label="Last Name" value={data.user.lastName} />
            <F label="Gender" value={data.profile?.gender} />
            <F label="Birthday" value={data.profile?.birthDate ? format(new Date(data.profile.birthDate), 'MMM dd, yyyy') : null} />
            <F label="Non-Celebrant" value={data.profile?.nonCelebrant ? 'Yes' : null} />
            <F label="Work Email" value={data.user.email} />
            <F label="WhatsApp" value={data.profile?.whatsappNumber} link={data.profile?.whatsappNumber ? `https://wa.me/${data.profile.whatsappNumber.replace(/\D/g, '')}` : null} />
            <F label="GCASH" value={data.profile?.gcashNumber} />
          </div>
        )}
      </EditableSection>

      {/* Address */}
      <EditableSection
        title="Address"
        icon={MapPin}
        isEditing={editSection === 'address'}
        onEdit={() => setEditSection('address')}
        onCancel={closeEdit}
        saving={saving}
      >
        {editSection === 'address' ? (
          <AddressForm data={data} onSaved={closeEdit} setSaving={setSaving} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 text-sm">
            <F label="Barangay" value={data.profile?.barangay} />
            <F label="City / Municipality" value={data.profile?.cityMunicipality} />
            <F label="Province" value={data.profile?.province} />
            <F label="Zip Code" value={data.profile?.zipCode} />
            <F label="Landmark" value={data.profile?.landmark} />
          </div>
        )}
      </EditableSection>

      {/* Employment */}
      <EditableSection
        title="Employment"
        icon={Briefcase}
        isEditing={editSection === 'employment'}
        onEdit={() => setEditSection('employment')}
        onCancel={closeEdit}
        saving={saving}
      >
        {editSection === 'employment' ? (
          <EmploymentForm data={data} onSaved={closeEdit} setSaving={setSaving} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 text-sm">
            <F label="Contract Type" value={data.employment?.contractType?.replace(/_/g, ' ')} />
            <F label="Employment Status" value={data.employment?.employmentStatus?.replace(/_/g, ' ')} />
            <F label="Hire Date" value={data.employment?.startDate ? format(new Date(data.employment.startDate), 'MMM dd, yyyy') : null} />
            <F label="EOC / End Date" value={data.employment?.endDate ? format(new Date(data.employment.endDate), 'MMM dd, yyyy') : 'N/A'} />
            <F label="VAA Position" value={data.vaProfile.vaaPosition} />
            <F label="Level" value={data.vaProfile.level} />
            <F label="Base Rate (PHP)" value={data.vaProfile.baseRate ? `₱${Number(data.vaProfile.baseRate).toLocaleString()}/hr` : null} />
            <F label="Hourly Rate (USD)" value={data.vaProfile.hourlyRate ? `$${Number(data.vaProfile.hourlyRate).toFixed(2)}/hr` : null} />
            <F label="Preferred Hours" value={data.vaProfile.preferredWorkHours ? `${Number(data.vaProfile.preferredWorkHours)}h/week` : null} />
            <F label="Available Schedule" value={data.vaProfile.availableSchedule} />
            <F label="Availability" value={data.vaProfile.availabilityStatus?.replace(/_/g, ' ')} badge />
            <F label="Hybrid" value={data.vaProfile.hybrid ? 'Yes' : 'No'} />
          </div>
        )}
      </EditableSection>

      {/* Emergency Contact */}
      <EditableSection
        title="Emergency Contact"
        icon={Phone}
        isEditing={editSection === 'emergency'}
        onEdit={() => setEditSection('emergency')}
        onCancel={closeEdit}
        saving={saving}
      >
        {editSection === 'emergency' ? (
          <EmergencyForm data={data} onSaved={closeEdit} setSaving={setSaving} />
        ) : (
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <F label="Contact Name" value={data.profile?.emergencyContactName} />
            <F label="Contact Number" value={data.profile?.emergencyContactPhone} />
            <F label="Relationship" value={data.profile?.emergencyContactRelation} />
          </div>
        )}
      </EditableSection>

      {/* Socials */}
      <EditableSection
        title="Socials"
        icon={Users}
        isEditing={editSection === 'socials'}
        onEdit={() => setEditSection('socials')}
        onCancel={closeEdit}
        saving={saving}
      >
        {editSection === 'socials' ? (
          <SocialsForm data={data} onSaved={closeEdit} setSaving={setSaving} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <F label="Facebook" value={data.profile?.facebookUrl} link={data.profile?.facebookUrl} />
            <F label="LinkedIn" value={data.profile?.linkedinUrl} link={data.profile?.linkedinUrl} />
          </div>
        )}
      </EditableSection>

      {/* Identification */}
      <EditableSection
        title="Identification"
        icon={Shield}
        isEditing={editSection === 'identification'}
        onEdit={() => setEditSection('identification')}
        onCancel={closeEdit}
        saving={saving}
      >
        {editSection === 'identification' ? (
          <IDForm data={data} onSaved={closeEdit} setSaving={setSaving} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <F label="Passport Number" value={data.profile?.passportNumber} />
            <F label="Passport Photo" value={data.profile?.passportPhoto ? 'Uploaded' : null} link={data.profile?.passportPhoto} />
            <F label="PhilHealth Number" value={data.profile?.philhealthNumber} />
            <F label="PhilHealth Photo" value={data.profile?.philhealthPhoto ? 'Uploaded' : null} link={data.profile?.philhealthPhoto} />
          </div>
        )}
      </EditableSection>

      {/* Documents */}
      <EditableSection
        title="Documents"
        icon={FileText}
        isEditing={editSection === 'docs'}
        onEdit={() => setEditSection('docs')}
        onCancel={closeEdit}
        saving={saving}
      >
        {editSection === 'docs' ? (
          <DocsForm data={data} onSaved={closeEdit} setSaving={setSaving} />
        ) : (
          <div className="space-y-2 text-sm">
            {[
              { label: 'Contract', link: data.vaProfile.contractLink },
              { label: '201 Folder', link: data.vaProfile.folder201Link },
              { label: '201 File', link: data.vaProfile.file201Link },
              { label: 'VA-Client File', link: data.vaProfile.vaClientFileLink },
              { label: 'Health Check File', link: data.vaProfile.healthCheckFileLink },
              { label: 'VA Portfolio', link: data.vaProfile.portfolioUrl },
              { label: 'VA Profile', link: data.vaProfile.vaProfileLink },
              { label: 'Payout Summary', link: data.vaProfile.payoutSummaryLink },
              { label: '201 Dept Folder', link: data.vaProfile.dept201FolderLink },
            ].filter((d) => d.link).map((doc) => (
              <div key={doc.label} className="flex items-center justify-between py-1">
                <span>{doc.label}</span>
                <a href={doc.link!} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                  <FileText className="h-3 w-3" /> View
                </a>
              </div>
            ))}
            {documents.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-2">Uploaded Files</p>
                {documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between py-1">
                    <span className="text-sm">{d.documentType.replace(/_/g, ' ')} — {d.fileName}</span>
                    <a href={d.googleDriveUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                      View
                    </a>
                  </div>
                ))}
              </div>
            )}
            {driveFiles.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <HardDrive className="h-3 w-3" /> Google Drive
                </p>
                {driveFiles.map((f) => (
                  <div key={f.id} className="flex items-center justify-between py-1">
                    <span className="text-sm">{f.name}</span>
                    <a href={f.webViewLink} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                      View
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </EditableSection>
    </div>
  )
}

function EditableSection({
  title,
  icon: Icon,
  isEditing,
  onEdit,
  onCancel,
  saving,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  saving: boolean
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
          {isEditing ? (
            <div className="flex gap-1">
              <Button form={`form-${title.toLowerCase().replace(/\s+/g, '-')}`} type="submit" size="sm" className="text-xs h-7" disabled={saving}>
                <Check className="h-3 w-3 mr-1" /> Save
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onCancel} disabled={saving}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={onEdit}>
              <Pencil className="h-3 w-3 mr-1" /> Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function F({ label, value, link, badge }: { label: string; value: string | null | undefined; link?: string | null; badge?: boolean }) {
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

function I({ name, label, defaultValue, type = 'text' }: { name: string; label: string; defaultValue?: string | null; type?: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name} className="text-xs">{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue ?? ''} type={type} className="h-8 text-xs" />
    </div>
  )
}

function PersonalForm({ data, onSaved, setSaving }: { data: VAData; onSaved: () => void; setSaving: (v: boolean) => void }) {
  return (
    <form id="form-personal-information" action={async (fd) => {
      setSaving(true)
      await updateUserProfile(data.user.id, fd)
      setSaving(false)
      onSaved()
    }} className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      <I name="firstName" label="First Name" defaultValue={data.user.firstName} />
      <I name="lastName" label="Last Name" defaultValue={data.user.lastName} />
      <I name="gender" label="Gender" defaultValue={data.profile?.gender} />
      <I name="birthDate" label="Birthday" defaultValue={data.profile?.birthDate} type="date" />
      <I name="whatsappNumber" label="WhatsApp" defaultValue={data.profile?.whatsappNumber} />
      <I name="gcashNumber" label="GCASH" defaultValue={data.profile?.gcashNumber} />
      <I name="phone" label="Phone" defaultValue={data.profile?.phone} />
    </form>
  )
}

function AddressForm({ data, onSaved, setSaving }: { data: VAData; onSaved: () => void; setSaving: (v: boolean) => void }) {
  return (
    <form id="form-address" action={async (fd) => { setSaving(true); await updateUserProfile(data.user.id, fd); setSaving(false); onSaved() }} className="grid gap-3 md:grid-cols-2">
      <I name="barangay" label="Barangay" defaultValue={data.profile?.barangay} />
      <I name="cityMunicipality" label="City / Municipality" defaultValue={data.profile?.cityMunicipality} />
      <I name="province" label="Province" defaultValue={data.profile?.province} />
      <I name="zipCode" label="Zip Code" defaultValue={data.profile?.zipCode} />
      <I name="landmark" label="Landmark" defaultValue={data.profile?.landmark} />
    </form>
  )
}

function EmploymentForm({ data, onSaved, setSaving }: { data: VAData; onSaved: () => void; setSaving: (v: boolean) => void }) {
  return (
    <form id="form-employment" action={async (fd) => { setSaving(true); await updateVAProfile(data.vaProfile.id, fd); setSaving(false); onSaved() }} className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      <I name="vaaPosition" label="VAA Position" defaultValue={data.vaProfile.vaaPosition} />
      <I name="level" label="Level" defaultValue={data.vaProfile.level} />
      <I name="baseRate" label="Base Rate (PHP)" defaultValue={data.vaProfile.baseRate?.toString()} type="number" />
      <I name="hourlyRate" label="Hourly Rate (USD)" defaultValue={data.vaProfile.hourlyRate?.toString()} type="number" />
      <I name="preferredWorkHours" label="Preferred Hours" defaultValue={data.vaProfile.preferredWorkHours?.toString()} type="number" />
      <I name="availableSchedule" label="Schedule" defaultValue={data.vaProfile.availableSchedule} />
      <I name="notes" label="Notes" defaultValue={data.vaProfile.notes} />
    </form>
  )
}

function EmergencyForm({ data, onSaved, setSaving }: { data: VAData; onSaved: () => void; setSaving: (v: boolean) => void }) {
  return (
    <form id="form-emergency-contact" action={async (fd) => { setSaving(true); await updateUserProfile(data.user.id, fd); setSaving(false); onSaved() }} className="grid gap-3 md:grid-cols-3">
      <I name="emergencyContactName" label="Contact Name" defaultValue={data.profile?.emergencyContactName} />
      <I name="emergencyContactPhone" label="Contact Number" defaultValue={data.profile?.emergencyContactPhone} />
      <I name="emergencyContactRelation" label="Relationship" defaultValue={data.profile?.emergencyContactRelation} />
    </form>
  )
}

function SocialsForm({ data, onSaved, setSaving }: { data: VAData; onSaved: () => void; setSaving: (v: boolean) => void }) {
  return (
    <form id="form-socials" action={async (fd) => { setSaving(true); await updateUserProfile(data.user.id, fd); setSaving(false); onSaved() }} className="grid gap-3 md:grid-cols-2">
      <I name="facebookUrl" label="Facebook URL" defaultValue={data.profile?.facebookUrl} />
      <I name="linkedinUrl" label="LinkedIn URL" defaultValue={data.profile?.linkedinUrl} />
    </form>
  )
}

function IDForm({ data, onSaved, setSaving }: { data: VAData; onSaved: () => void; setSaving: (v: boolean) => void }) {
  return (
    <form id="form-identification" action={async (fd) => { setSaving(true); await updateUserProfile(data.user.id, fd); setSaving(false); onSaved() }} className="grid gap-3 md:grid-cols-2">
      <I name="passportNumber" label="Passport Number" defaultValue={data.profile?.passportNumber} />
      <I name="passportPhoto" label="Passport Photo URL" defaultValue={data.profile?.passportPhoto} />
      <I name="philhealthNumber" label="PhilHealth Number" defaultValue={data.profile?.philhealthNumber} />
      <I name="philhealthPhoto" label="PhilHealth Photo URL" defaultValue={data.profile?.philhealthPhoto} />
    </form>
  )
}

function DocsForm({ data, onSaved, setSaving }: { data: VAData; onSaved: () => void; setSaving: (v: boolean) => void }) {
  return (
    <form id="form-documents" action={async (fd) => { setSaving(true); await updateVAProfile(data.vaProfile.id, fd); setSaving(false); onSaved() }} className="grid gap-3 md:grid-cols-2">
      <I name="contractLink" label="Contract Link" defaultValue={data.vaProfile.contractLink} />
      <I name="folder201Link" label="201 Folder Link" defaultValue={data.vaProfile.folder201Link} />
      <I name="file201Link" label="201 File Link" defaultValue={data.vaProfile.file201Link} />
      <I name="vaClientFileLink" label="VA-Client File Link" defaultValue={data.vaProfile.vaClientFileLink} />
      <I name="healthCheckFileLink" label="Health Check File Link" defaultValue={data.vaProfile.healthCheckFileLink} />
      <I name="portfolioUrl" label="Portfolio URL" defaultValue={data.vaProfile.portfolioUrl} />
      <I name="vaProfileLink" label="VA Profile Link" defaultValue={data.vaProfile.vaProfileLink} />
      <I name="payoutSummaryLink" label="Payout Summary Link" defaultValue={data.vaProfile.payoutSummaryLink} />
      <I name="dept201FolderLink" label="201 Dept Folder Link" defaultValue={data.vaProfile.dept201FolderLink} />
    </form>
  )
}
