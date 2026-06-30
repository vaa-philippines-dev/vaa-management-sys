'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Pencil,
  Check,
  X,
  FileText,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Users,
  User,
  Cake,
  Wallet,
  Building2,
} from 'lucide-react'
import { updateVAProfile, updateUserProfile } from '@/app/(dashboard)/vas/actions'
import { FileUploadField } from '@/components/vas/FileUploadField'
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
    personalEmail: string | null
    payoneerAccount: string | null
    birthDate: string | null
    nonCelebrant: boolean
    address: string | null
    barangay: string | null
    cityMunicipality: string | null
    province: string | null
    zipCode: string | null
    landmark: string | null
    emergencyContactName: string | null
    emergencyContactPhone: string | null
    emergencyContactRelation: string | null
    facebookName: string | null
    facebookUrl: string | null
    linkedinUrl: string | null
    passportNumber: string | null
    passportPhoto: string | null
    philhealthNumber: string | null
    philhealthPhoto: string | null
    signedContract: string | null
  } | null
  membership: { departmentName: string; positionTitle: string | null } | null
  employment: { contractType: string; employmentStatus: string; startDate: string; endDate: string | null } | null
}

export function VAProfileEditor({
  data,
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
  const isEditing = (s: string) => editSection === s

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <SectionCard
        title="Personal Information"
        icon={User}
        isEditing={isEditing('personal')}
        onEdit={() => setEditSection('personal')}
        onCancel={closeEdit}
        saving={saving}
      >
        {isEditing('personal') ? (
          <PersonalForm data={data} onSaved={closeEdit} setSaving={setSaving} />
        ) : (
          <div className="grid gap-x-6 gap-y-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <FV label="Assigned Email" value={data.user.email} icon={Mail} />
            <FV label="Personal Email" value={data.profile?.personalEmail} icon={Mail} />
            <FV label="WhatsApp" value={data.profile?.whatsappNumber} icon={Phone} />
            <FV label="Emergency Contact" value={data.profile?.emergencyContactName || data.profile?.emergencyContactPhone ? `${data.profile?.emergencyContactName || ''}${data.profile?.emergencyContactPhone ? ` — ${data.profile.emergencyContactPhone}` : ''}` : null} />
          </div>
        )}
      </SectionCard>

      {/* Address */}
      <SectionCard
        title="Complete Address"
        icon={MapPin}
        isEditing={isEditing('address')}
        onEdit={() => setEditSection('address')}
        onCancel={closeEdit}
        saving={saving}
      >
        {isEditing('address') ? (
          <AddressForm data={data} onSaved={closeEdit} setSaving={setSaving} />
        ) : (
          <div className="grid gap-x-6 gap-y-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <FV label="House #, Building & Street" value={data.profile?.address} />
            <FV label="Province" value={data.profile?.province} />
            <FV label="City / Municipality" value={data.profile?.cityMunicipality} />
            <FV label="Barangay" value={data.profile?.barangay} />
            <FV label="Zip Code" value={data.profile?.zipCode} />
            <FV label="Landmark" value={data.profile?.landmark} />
          </div>
        )}
      </SectionCard>

      {/* Employment */}
      <SectionCard
        title="Employment"
        icon={Briefcase}
        isEditing={isEditing('employment')}
        onEdit={() => setEditSection('employment')}
        onCancel={closeEdit}
        saving={saving}
      >
        {isEditing('employment') ? (
          <EmploymentForm data={data} onSaved={closeEdit} setSaving={setSaving} />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-x-6 gap-y-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <FV label="Contract Type" value={data.employment?.contractType?.replace(/_/g, ' ')} />
              <FV label="Employment Status" value={data.employment?.employmentStatus?.replace(/_/g, ' ')} badge />
              <FV label="Hire Date" value={data.employment?.startDate ? format(new Date(data.employment.startDate), 'MMM dd, yyyy') : null} />
              <FV label="Position" value={data.membership?.positionTitle || data.vaProfile.vaaPosition} />
              <FV label="Base Rate (PHP)" value={data.vaProfile.baseRate ? `₱${Number(data.vaProfile.baseRate).toLocaleString()}/hr` : null} />
              <FV label="Hourly Rate (USD)" value={data.vaProfile.hourlyRate ? `$${Number(data.vaProfile.hourlyRate).toFixed(2)}/hr` : null} />
            </div>
            <div className="border-t pt-4 mt-2">
              <p className="text-xs font-medium text-muted-foreground mb-3">Payment Details</p>
              <div className="grid gap-x-6 gap-y-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                <FV
                  label="Birth Date"
                  value={
                    data.profile?.birthDate
                      ? `${format(new Date(data.profile.birthDate), 'MMM dd, yyyy')}${data.profile.nonCelebrant ? ' (non-celebrant)' : ''}`
                      : null
                  }
                  icon={Cake}
                />
                <FV label="GCash" value={data.profile?.gcashNumber} icon={Wallet} />
                <FV label="Payoneer" value={data.profile?.payoneerAccount} icon={Building2} />
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Socials */}
      <SectionCard
        title="Socials"
        icon={Users}
        isEditing={isEditing('socials')}
        onEdit={() => setEditSection('socials')}
        onCancel={closeEdit}
        saving={saving}
      >
        {isEditing('socials') ? (
          <SocialsForm data={data} onSaved={closeEdit} setSaving={setSaving} />
        ) : (
          <div className="grid gap-x-6 gap-y-3 grid-cols-1 sm:grid-cols-2">
            <FV label="Facebook Name" value={data.profile?.facebookName} />
            <FV label="Facebook URL" value={data.profile?.facebookUrl} link={data.profile?.facebookUrl} />
          </div>
        )}
      </SectionCard>

      {/* 201 Files (Identification + Documents merged) */}
      <SectionCard
        title="201 Files"
        icon={FileText}
        isEditing={isEditing('201files')}
        onEdit={() => setEditSection('201files')}
        onCancel={closeEdit}
        saving={saving}
      >
        {isEditing('201files') ? (
          <Files201Form data={data} onSaved={closeEdit} setSaving={setSaving} />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-x-6 gap-y-3 grid-cols-1 sm:grid-cols-2">
              <FV label="Passport Number" value={data.profile?.passportNumber} />
              <FV label="PhilHealth Number" value={data.profile?.philhealthNumber} />
            </div>
            <div className="border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Uploaded Documents</p>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                <DocView label="Passport Photo" url={data.profile?.passportPhoto} />
                <DocView label="PhilHealth Photo" url={data.profile?.philhealthPhoto} />
                <DocView label="Signed Contract" url={data.profile?.signedContract} />
              </div>
            </div>
            {driveFiles.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Google Drive Files</p>
                <div className="grid gap-1">
                  {driveFiles.map((f) => (
                    <a
                      key={f.id}
                      href={f.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-primary hover:underline py-1"
                    >
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function SectionCard({
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
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{title}</h3>
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
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7" onClick={onEdit}>
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
        )}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function FV({
  label,
  value,
  icon: Icon,
  link,
  badge,
}: {
  label: string
  value: string | null | undefined
  icon?: React.ComponentType<{ className?: string }>
  link?: string | null
  badge?: boolean
}) {
  if (!value) return null
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground mb-0.5 flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3 shrink-0" />}
        {label}
      </p>
      {badge ? (
        <Badge variant="outline" className="text-xs">{value}</Badge>
      ) : link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline block truncate">
          {value}
        </a>
      ) : (
        <p className="text-sm truncate">{value}</p>
      )}
    </div>
  )
}

function DocView({ label, url }: { label: string; url: string | null | undefined }) {
  if (!url) return null
  return (
    <div className="flex items-center justify-between py-1 px-3 rounded-lg border bg-muted/20">
      <span className="text-xs">{label}</span>
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
        <FileText className="h-3 w-3" /> View
      </a>
    </div>
  )
}

function FI({ name, label, defaultValue, type = 'text', placeholder }: { name: string; label: string; defaultValue?: string | null; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name} className="text-xs">{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue ?? ''} type={type} placeholder={placeholder} className="h-8 text-xs" />
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
    }} className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <FI name="firstName" label="First Name" defaultValue={data.user.firstName} />
      <FI name="lastName" label="Last Name" defaultValue={data.user.lastName} />
      <FI name="personalEmail" label="Personal Email" defaultValue={data.profile?.personalEmail} type="email" placeholder="personal@email.com" />
      <FI name="whatsappNumber" label="WhatsApp Number" defaultValue={data.profile?.whatsappNumber} placeholder="09000000000" />
      <FI name="emergencyContactName" label="Emergency Contact Name" defaultValue={data.profile?.emergencyContactName} />
      <FI name="emergencyContactPhone" label="Emergency Contact Number" defaultValue={data.profile?.emergencyContactPhone} placeholder="09000000000" />
    </form>
  )
}

function AddressForm({ data, onSaved, setSaving }: { data: VAData; onSaved: () => void; setSaving: (v: boolean) => void }) {
  return (
    <form id="form-complete-address" action={async (fd) => { setSaving(true); await updateUserProfile(data.user.id, fd); setSaving(false); onSaved() }} className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <FI name="address" label="House #, Building & Street Name" defaultValue={data.profile?.address} placeholder="123 Main St, Building A" />
      <FI name="province" label="Province" defaultValue={data.profile?.province} />
      <FI name="cityMunicipality" label="City / Municipality" defaultValue={data.profile?.cityMunicipality} />
      <FI name="barangay" label="Barangay" defaultValue={data.profile?.barangay} />
      <FI name="zipCode" label="Zip Code" defaultValue={data.profile?.zipCode} placeholder="1000" />
      <FI name="landmark" label="Landmark" defaultValue={data.profile?.landmark} />
    </form>
  )
}

function EmploymentForm({ data, onSaved, setSaving }: { data: VAData; onSaved: () => void; setSaving: (v: boolean) => void }) {
  return (
    <form id="form-employment" action={async (fd) => {
      setSaving(true)
      await updateVAProfile(data.vaProfile.id, fd)
      await updateUserProfile(data.user.id, fd)
      setSaving(false)
      onSaved()
    }} className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <FI name="vaaPosition" label="VAA Position" defaultValue={data.vaProfile.vaaPosition} />
      <FI name="level" label="Level" defaultValue={data.vaProfile.level} />
      <FI name="baseRate" label="Base Rate (PHP)" defaultValue={data.vaProfile.baseRate?.toString()} type="number" />
      <FI name="hourlyRate" label="Hourly Rate (USD)" defaultValue={data.vaProfile.hourlyRate?.toString()} type="number" />
      <FI name="preferredWorkHours" label="Preferred Hours (Weekly)" defaultValue={data.vaProfile.preferredWorkHours?.toString()} type="number" />
      <FI name="birthDate" label="Birth Date" defaultValue={data.profile?.birthDate} type="date" />
      <div className="flex items-center gap-2 pt-5">
        <input type="checkbox" id="nonCelebrant" name="nonCelebrant" value="true" defaultChecked={data.profile?.nonCelebrant} className="rounded" />
        <Label htmlFor="nonCelebrant" className="text-xs cursor-pointer">I don&apos;t celebrate birthdays</Label>
      </div>
      <FI name="gcashNumber" label="GCash Number" defaultValue={data.profile?.gcashNumber} placeholder="09000000000" />
      <FI name="payoneerAccount" label="Payoneer Account" defaultValue={data.profile?.payoneerAccount} type="email" placeholder="email@example.com" />
      <FI name="notes" label="Notes" defaultValue={data.vaProfile.notes} />
    </form>
  )
}

function SocialsForm({ data, onSaved, setSaving }: { data: VAData; onSaved: () => void; setSaving: (v: boolean) => void }) {
  return (
    <form id="form-socials" action={async (fd) => { setSaving(true); await updateUserProfile(data.user.id, fd); setSaving(false); onSaved() }} className="grid gap-3 grid-cols-1 sm:grid-cols-2">
      <FI name="facebookName" label="Facebook Name" defaultValue={data.profile?.facebookName} />
      <FI name="facebookUrl" label="Facebook URL" defaultValue={data.profile?.facebookUrl} placeholder="https://facebook.com/..." />
    </form>
  )
}

function Files201Form({ data, onSaved, setSaving }: { data: VAData; onSaved: () => void; setSaving: (v: boolean) => void }) {
  const vaName = `${data.user.firstName} ${data.user.lastName}`.trim()
  const [passportPhoto, setPassportPhoto] = useState(data.profile?.passportPhoto ?? null)
  const [philhealthPhoto, setPhilhealthPhoto] = useState(data.profile?.philhealthPhoto ?? null)
  const [signedContract, setSignedContract] = useState(data.profile?.signedContract ?? null)

  return (
    <form id="form-201-files" action={async (fd) => {
      setSaving(true)
      if (passportPhoto) fd.set('passportPhoto', passportPhoto)
      if (philhealthPhoto) fd.set('philhealthPhoto', philhealthPhoto)
      if (signedContract) fd.set('signedContract', signedContract)
      await updateUserProfile(data.user.id, fd)
      setSaving(false)
      onSaved()
    }} className="space-y-4">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <FI name="passportNumber" label="Passport Number" defaultValue={data.profile?.passportNumber} />
        <FI name="philhealthNumber" label="PhilHealth Number" defaultValue={data.profile?.philhealthNumber} />
      </div>
      <div className="border-t pt-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">Upload Documents to Google Drive</p>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <FileUploadField
            label="Passport Photo"
            currentUrl={passportPhoto}
            fieldName="passport_photo"
            vaName={vaName}
            profileId={data.user.id}
            onUploaded={setPassportPhoto}
            accept="image/*,.pdf"
          />
          <FileUploadField
            label="PhilHealth Photo"
            currentUrl={philhealthPhoto}
            fieldName="philhealth_photo"
            vaName={vaName}
            profileId={data.user.id}
            onUploaded={setPhilhealthPhoto}
            accept="image/*,.pdf"
          />
          <FileUploadField
            label="Signed Contract"
            currentUrl={signedContract}
            fieldName="signed_contract"
            vaName={vaName}
            profileId={data.user.id}
            onUploaded={setSignedContract}
            accept="image/*,.pdf"
          />
        </div>
      </div>
    </form>
  )
}
