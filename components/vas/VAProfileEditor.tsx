'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Pencil } from 'lucide-react'
import {
  Upload,
  FileText,
  AlertCircle,
  Shield,
  ExternalLink,
  Globe,
  IdCard,
  Camera,
  MapPin,
  Briefcase,
  Building2,
  Wallet,
  User,
} from 'lucide-react'
import { updateUserProfileAction, updateEmployment, updateUserProfileFiles, changeVAStatus } from '@/app/(dashboard)/vas/actions'
import { Modal } from '@/components/ui/modal'
import { format } from 'date-fns'
import type { DriveFile } from '@/lib/google/drive'
import { AddressFields } from '@/components/vas/AddressFields'

type VAData = {
  vaProfile: {
    id: string; status: string; engagementStatus: string | null; hybrid: boolean
    hourlyRate: number | null; baseRate: number | null
    vaaPosition: string | null; level: string | null
    availabilityStatus: string; preferredWorkHours: number | null
    availableSchedule: string | null; notes: string | null
    contractLink: string | null; folder201Link: string | null
    file201Link: string | null; vaClientFileLink: string | null
    healthCheckFileLink: string | null; portfolioUrl: string | null
    vaProfileLink: string | null; payoutSummaryLink: string | null
    dept201FolderLink: string | null
  }
  user: { id: string; email: string; firstName: string; lastName: string }
  profile: {
    gender: string | null; whatsappNumber: string | null
    gcashNumber: string | null; phone: string | null
    personalEmail: string | null; workEmail: string | null
    payoneerAccount: string | null
    birthDate: string | null; nonCelebrant: boolean
    address: string | null; barangay: string | null
    cityMunicipality: string | null; province: string | null
    zipCode: string | null; landmark: string | null
    regionCode: string | null; provinceCode: string | null
    cityCode: string | null; barangayCode: string | null
    emergencyContactName: string | null; emergencyContactPhone: string | null
    emergencyContactRelation: string | null
    facebookName: string | null; facebookUrl: string | null
    linkedinUrl: string | null
    passportNumber: string | null; passportPhoto: string | null
    philhealthNumber: string | null; philhealthPhoto: string | null
    signedContract: string | null
  } | null
  membership: { departmentName: string; positionTitle: string | null } | null
  employment: { contractType: string; employmentStatus: string; startDate: string; endDate: string | null } | null
}

export function VAProfileEditor({
  data,
  driveFiles,
  currentUserId,
  canEdit = false,
}: {
  data: VAData
  skills: { id: string; name: string; proficiency: string | null }[]
  assignments: { id: string; clientName: string; type: string; agreedHours: number; startDate: string; endDate: string | null; status: string }[]
  documents: { id: string; documentType: string; fileName: string; googleDriveUrl: string }[]
  driveFiles: DriveFile[]
  currentUserId?: string
  canEdit?: boolean
}) {
  const vaName = `${data.user.firstName} ${data.user.lastName}`.trim()
  const [recentUpload, setRecentUpload] = useState<string | null>(null)

  const handleRecentUpload = (field: string) => {
    setRecentUpload(field)
    setTimeout(() => setRecentUpload(null), 8000)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <EditableSection
          icon={User}
          label="Personal Information"
          renderEdit={(onClose) => <PersonalFormContent data={data} onClose={onClose} />}
          canEdit={canEdit}
        >
          <TableRow label="Assigned Email" value={data.user.email} />
          <TableRow label="Work Email" value={data.profile?.workEmail} />
          <TableRow label="Personal Email" value={data.profile?.personalEmail} />
          <TableRow label="WhatsApp" value={data.profile?.whatsappNumber} />
          <TableRow
            label="Emergency Contact"
            value={data.profile?.emergencyContactName
              ? `${data.profile.emergencyContactName}${data.profile?.emergencyContactPhone ? ` — ${data.profile.emergencyContactPhone}` : ''}`
              : null}
          />
        </EditableSection>

        <EditableSection
          icon={MapPin}
          label="Complete Address"
          renderEdit={(onClose) => <AddressFormContent data={data} onClose={onClose} />}
          canEdit={canEdit}
        >
          <TableRow label="#, Building & Street" value={data.profile?.address} />
          <TableRow label="Province" value={data.profile?.province} />
          <TableRow label="City / Municipality" value={data.profile?.cityMunicipality} />
          <TableRow label="Barangay" value={data.profile?.barangay} />
          <TableRow label="Zip Code" value={data.profile?.zipCode} />
          <TableRow label="Landmark" value={data.profile?.landmark} />
        </EditableSection>

        <EditableSection
          icon={Briefcase}
          label="Employment & Payment"
          renderEdit={(onClose) => <EmploymentFormContent data={data} onClose={onClose} />}
          canEdit={canEdit}
        >
          <TableRow label="Position" value={data.membership?.positionTitle || data.vaProfile.vaaPosition} />
          <TableRow label="Status" value={data.employment?.employmentStatus?.replace(/_/g, ' ')} />
          <TableRow label="Base Rate" value={data.vaProfile.baseRate ? `₱${Number(data.vaProfile.baseRate).toLocaleString()}/hr` : null} />
          <TableRow label="Hourly Rate" value={data.vaProfile.hourlyRate ? `$${Number(data.vaProfile.hourlyRate).toFixed(2)}/hr` : null} />
          <TableRow label="Birth Date" value={data.profile?.birthDate ? format(new Date(data.profile.birthDate), 'MMM dd, yyyy') + (data.profile.nonCelebrant ? ' (NC)' : '') : null} />
          <TableRow label="GCash" value={data.profile?.gcashNumber} />
          <TableRow label="Payoneer" value={data.profile?.payoneerAccount} />
          <TableRow label="Hired" value={data.employment?.startDate ? format(new Date(data.employment.startDate), 'MMM dd, yyyy') : null} />
        </EditableSection>

        <EditableSection
          icon={Globe}
          label="Socials"
          renderEdit={(onClose) => <SocialsFormContent data={data} onClose={onClose} />}
          canEdit={canEdit}
        >
          <TableRow label="Facebook Profile" value={data.profile?.facebookName} />
          <TableRow label="Facebook URL" value={data.profile?.facebookUrl} link />
        </EditableSection>

        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm font-semibold">201 Files</p>
            </div>
          </div>
          <div className="border-t px-5 py-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <TableRow label="Passport Number" value={data.profile?.passportNumber} />
              <TableRow label="PhilHealth Number" value={data.profile?.philhealthNumber} />
            </div>
            <div className="flex flex-wrap gap-2">
              <DocBadge icon={IdCard} label="Passport" url={data.profile?.passportPhoto ?? null} highlighted={recentUpload === 'passportPhoto'} />
              <DocBadge icon={Camera} label="PhilHealth" url={data.profile?.philhealthPhoto ?? null} highlighted={recentUpload === 'philhealthPhoto'} />
              <DocBadge icon={FileText} label="Contract" url={data.profile?.signedContract ?? null} highlighted={recentUpload === 'signedContract'} />
            </div>
            {canEdit && (
              <Files201Content data={data} vaName={vaName} onJustUploaded={handleRecentUpload} onClose={() => {}} currentUserId={currentUserId} />
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <StatusCard vaProfileId={data.vaProfile.id} status={data.vaProfile.status} engagementStatus={data.vaProfile.engagementStatus} canEdit={canEdit} />

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Overview</p>
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Department" value={data.membership?.departmentName} icon={Building2} />
            <StatBox label="Contract" value={data.employment?.contractType?.replace(/_/g, ' ')} icon={Briefcase} />
            <StatBox
              label="Schedule"
              value={data.vaProfile.availableSchedule ? `${data.vaProfile.preferredWorkHours || '-'}h/wk` : null}
              icon={Wallet}
            />
            <StatBox
              label="Availability"
              value={data.vaProfile.availabilityStatus?.replace(/_/g, ' ')}
              icon={User}
            />
          </div>
        </div>

        {driveFiles.length > 0 && (
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-1.5">
              <Upload className="h-3 w-3" /> Drive Files
              <a
                href="https://drive.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-normal normal-case tracking-normal text-[10px] ml-auto"
              >
                ↗ Google Drive
              </a>
            </p>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {driveFiles.map((f) => (
                <a
                  key={f.id}
                  href={f.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted transition-colors group"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="truncate group-hover:text-primary transition-colors">{f.name}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground transition-all" />
                </a>
              ))}
            </div>
          </div>
        )}

        {data.vaProfile.notes && (
          <div className="rounded-2xl border bg-muted/20 p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Notes</p>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{data.vaProfile.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function EditableSection({
  icon: Icon,
  label,
  children,
  renderEdit,
  canEdit = true,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
  renderEdit: (onClose: () => void) => React.ReactNode
  canEdit?: boolean
}) {
  const [editing, setEditing] = useState(false)

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm font-semibold">{label}</p>
        </div>
        {!editing && canEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3 w-3 mr-1.5" />Edit
          </Button>
        )}
      </div>
      <div className="border-t">
        {editing ? (
          <div className="p-5">
            {renderEdit(() => setEditing(false))}
          </div>
        ) : (
          <div className="px-5 py-4 space-y-2">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}

function TableRow({ label, value, link }: { label: string; value: string | null | undefined; link?: boolean }) {
  if (!value) return null
  return (
    <div className="flex items-center py-1.5 gap-4">
      <span className="text-[11px] text-muted-foreground w-[140px] shrink-0">{label}</span>
      {link ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate">
          {value}
        </a>
      ) : (
        <span className="text-xs font-medium truncate">{value}</span>
      )}
    </div>
  )
}

// ── Forms (unchanged) ──

function FI({ name, label, defaultValue, type, placeholder }: { name: string; label: string; defaultValue?: string | null; type?: string; placeholder?: string }) {
  return (
    <div>
      <Label htmlFor={`fi-${name}`} className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">{label}</Label>
      <Input
        id={`fi-${name}`}
        name={name}
        defaultValue={defaultValue ?? ''}
        type={type ?? 'text'}
        placeholder={placeholder}
        className="h-8 text-xs"
      />
    </div>
  )
}

function SaveForm({ action, onClose, className, children, toastLabel }: {
  action: (formData: FormData) => Promise<void>
  onClose: () => void
  className?: string
  children: (saving: boolean) => React.ReactNode
  toastLabel?: string
}) {
  const [saving, setSaving] = useState(false)

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    try {
      await action(fd)
    } catch (err) {
      console.error(err)
      setSaving(false)
      toast.error(err instanceof Error ? err.message : 'Failed to save changes')
      return
    }
    setSaving(false)
    if (toastLabel) toast.success(toastLabel)
    setTimeout(() => onClose(), 400)
  }, [action, onClose, toastLabel])

  return (
    <form onSubmit={handleSubmit} className={className}>
      {children(saving)}
    </form>
  )
}

function PersonalFormContent({ data, onClose }: { data: VAData; onClose: () => void }) {
  return (
    <SaveForm action={(fd) => updateUserProfileAction(data.user.id, fd)} onClose={onClose} toastLabel="Personal info saved" className="flex flex-col gap-4">
      {(saving) => (<>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <FI name="firstName" label="First Name" defaultValue={data.user.firstName} />
          <FI name="lastName" label="Last Name" defaultValue={data.user.lastName} />
          <FI name="workEmail" label="Work Email" defaultValue={data.profile?.workEmail} type="email" placeholder="work@vaa.com" />
          <FI name="personalEmail" label="Personal Email" defaultValue={data.profile?.personalEmail} type="email" placeholder="personal@email.com" />
          <FI name="whatsappNumber" label="WhatsApp Number" defaultValue={data.profile?.whatsappNumber} placeholder="09000000000" />
          <FI name="emergencyContactName" label="Emergency Contact Name" defaultValue={data.profile?.emergencyContactName} />
          <FI name="emergencyContactPhone" label="Emergency Contact Number" defaultValue={data.profile?.emergencyContactPhone} placeholder="09000000000" />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button type="button" onClick={onClose} className="inline-flex items-center justify-center rounded-lg border bg-background hover:bg-muted text-xs font-medium h-8 px-3 transition-colors">
            Cancel
          </button>
          <Button type="submit" size="sm" className="text-xs h-8" disabled={saving}>
            {saving ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Saving...</> : 'Save Changes'}
          </Button>
        </div>
      </>)}
    </SaveForm>
  )
}

function AddressFormContent({ data, onClose }: { data: VAData; onClose: () => void }) {
  return (
    <SaveForm action={(fd) => updateUserProfileAction(data.user.id, fd)} onClose={onClose} toastLabel="Address saved" className="flex flex-col gap-4">
      {(saving) => (<>
        <div className="space-y-3">
          <AddressFields
            defaultValues={{
              regionCode: data.profile?.regionCode ?? undefined,
              provinceCode: data.profile?.provinceCode ?? undefined,
              cityCode: data.profile?.cityCode ?? undefined,
              barangayCode: data.profile?.barangayCode ?? undefined,
            }}
            namePrefix="address"
          />
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            <FI name="address" label="House #, Building & Street Name" defaultValue={data.profile?.address} placeholder="123 Main St, Building A" />
            <FI name="zipCode" label="Zip Code" defaultValue={data.profile?.zipCode} placeholder="1000" />
            <FI name="landmark" label="Landmark" defaultValue={data.profile?.landmark} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button type="button" onClick={onClose} className="inline-flex items-center justify-center rounded-lg border bg-background hover:bg-muted text-xs font-medium h-8 px-3 transition-colors">
            Cancel
          </button>
          <Button type="submit" size="sm" className="text-xs h-8" disabled={saving}>
            {saving ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Saving...</> : 'Save Changes'}
          </Button>
        </div>
      </>)}
    </SaveForm>
  )
}

function EmploymentFormContent({ data, onClose }: { data: VAData; onClose: () => void }) {
  return (
    <SaveForm action={(fd) => updateEmployment(data.vaProfile.id, data.user.id, fd)} onClose={onClose} toastLabel="Employment & pay saved" className="flex flex-col gap-4">
      {(saving) => (<>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <FI name="vaaPosition" label="VAA Position" defaultValue={data.vaProfile.vaaPosition} />
          <FI name="level" label="Level" defaultValue={data.vaProfile.level} />
          <FI name="baseRate" label="Base Rate (PHP)" defaultValue={data.vaProfile.baseRate?.toString()} type="number" />
          <FI name="hourlyRate" label="Hourly Rate (USD)" defaultValue={data.vaProfile.hourlyRate?.toString()} type="number" />
          <FI name="preferredWorkHours" label="Preferred Hours (Weekly)" defaultValue={data.vaProfile.preferredWorkHours?.toString()} type="number" />
          <FI name="birthDate" label="Birth Date" defaultValue={data.profile?.birthDate} type="date" />
          <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
            <input type="checkbox" id="nonCelebrant" name="nonCelebrant" value="true" defaultChecked={data.profile?.nonCelebrant} className="rounded" />
            <Label htmlFor="nonCelebrant" className="text-xs cursor-pointer">I don&apos;t celebrate birthdays</Label>
          </div>
          <FI name="gcashNumber" label="GCash Number" defaultValue={data.profile?.gcashNumber} placeholder="09000000000" />
          <FI name="payoneerAccount" label="Payoneer Account" defaultValue={data.profile?.payoneerAccount} type="email" placeholder="email@example.com" />
          <FI name="notes" label="Notes" defaultValue={data.vaProfile.notes} />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button type="button" onClick={onClose} className="inline-flex items-center justify-center rounded-lg border bg-background hover:bg-muted text-xs font-medium h-8 px-3 transition-colors">
            Cancel
          </button>
          <Button type="submit" size="sm" className="text-xs h-8" disabled={saving}>
            {saving ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Saving...</> : 'Save Changes'}
          </Button>
        </div>
      </>)}
    </SaveForm>
  )
}

function SocialsFormContent({ data, onClose }: { data: VAData; onClose: () => void }) {
  return (
    <SaveForm action={(fd) => updateUserProfileAction(data.user.id, fd)} onClose={onClose} toastLabel="Socials saved" className="flex flex-col gap-4">
      {(saving) => (<>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <FI name="facebookName" label="Facebook Name" defaultValue={data.profile?.facebookName} />
          <FI name="facebookUrl" label="Facebook URL" defaultValue={data.profile?.facebookUrl} placeholder="https://facebook.com/..." />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button type="button" onClick={onClose} className="inline-flex items-center justify-center rounded-lg border bg-background hover:bg-muted text-xs font-medium h-8 px-3 transition-colors">
            Cancel
          </button>
          <Button type="submit" size="sm" className="text-xs h-8" disabled={saving}>
            {saving ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Saving...</> : 'Save Changes'}
          </Button>
        </div>
      </>)}
    </SaveForm>
  )
}

function Files201Content({
  data,
  vaName,
  onJustUploaded,
  onClose,
  currentUserId,
}: {
  data: VAData
  vaName: string
  onJustUploaded?: (field: string) => void
  onClose: () => void
  currentUserId?: string
}) {
  const [passportPhoto, setPassportPhoto] = useState(data.profile?.passportPhoto ?? null)
  const [philhealthPhoto, setPhilhealthPhoto] = useState(data.profile?.philhealthPhoto ?? null)
  const [signedContract, setSignedContract] = useState(data.profile?.signedContract ?? null)
  const [saving, setSaving] = useState(false)

  const handleJustUploaded = (field: string) => {
    onJustUploaded?.(field)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateUserProfileFiles(data.user.id, passportPhoto, philhealthPhoto, signedContract)
      toast.success('201 files saved')
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to save files')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <UploadRow label="Passport Photo" icon={IdCard} currentUrl={passportPhoto} fieldName="passportPhoto" vaName={vaName} profileId={data.user.id} uploadedBy={currentUserId} onUploaded={setPassportPhoto} onJustUploaded={handleJustUploaded} />
      <UploadRow label="PhilHealth Photo" icon={Camera} currentUrl={philhealthPhoto} fieldName="philhealthPhoto" vaName={vaName} profileId={data.user.id} uploadedBy={currentUserId} onUploaded={setPhilhealthPhoto} onJustUploaded={handleJustUploaded} />
      <UploadRow label="Signed Contract" icon={FileText} currentUrl={signedContract} fieldName="signedContract" vaName={vaName} profileId={data.user.id} uploadedBy={currentUserId} onUploaded={setSignedContract} onJustUploaded={handleJustUploaded} />
      <div className="flex justify-end pt-2 border-t">
        <Button onClick={handleSave} type="button" size="sm" className="text-xs h-8" disabled={saving}>
          {saving ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Saving...</> : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}

function UploadRow({
  label,
  icon: Icon,
  currentUrl,
  fieldName,
  vaName,
  profileId,
  onUploaded,
  onJustUploaded,
  uploadedBy,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  currentUrl: string | null
  fieldName: string
  vaName: string
  profileId: string
  onUploaded: (url: string) => void
  onJustUploaded?: (fieldName: string) => void
  uploadedBy?: string
}) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(currentUrl)
  const [recentlyUploaded, setRecentlyUploaded] = useState(false)

  const handleFile = (file: File) => {
    setUploading(true)
    setProgress(0)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('vaName', vaName)
    formData.append('fieldName', fieldName)
    formData.append('profileId', profileId)
    if (uploadedBy) formData.append('uploadedBy', uploadedBy)

    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('load', () => {
      setUploading(false)
      try {
        const res = JSON.parse(xhr.responseText)
        if (res.error) { setError(res.error); return }
        setUrl(res.url)
        onUploaded(res.url)
        onJustUploaded?.(fieldName)
        setRecentlyUploaded(true)
        setTimeout(() => setRecentlyUploaded(false), 8000)
        toast.success(label + ' uploaded successfully!', {
          action: { label: 'View Document', onClick: () => window.open(res.url, '_blank') },
        })
      } catch {
        setError('Failed to parse response')
      }
    })
    xhr.addEventListener('error', () => { setUploading(false); setError('Upload failed') })
    xhr.open('POST', '/api/upload')
    xhr.send(formData)
  }

  const borderClass = recentlyUploaded ? 'border-success/40 ring-1 ring-success/30 bg-success/10' : error ? 'border-destructive/30 bg-destructive/10' : ''

  return (
    <div className={`rounded-lg border p-3 transition-colors ${borderClass}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium flex items-center gap-2">
            {label}
            {recentlyUploaded && (
              <span className="text-[10px] text-success bg-success/15 px-1.5 py-0.5 rounded-full">Just uploaded</span>
            )}
          </p>
          {url && !uploading && (
            <a href={url} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 hover:underline truncate block">{url}</a>
          )}
          {!url && !uploading && !error && (
            <span className="text-[11px] text-muted-foreground">No file uploaded</span>
          )}
          {error && (
            <span className="text-[11px] text-destructive flex items-center gap-1 mt-0.5">
              <AlertCircle className="h-3 w-3" />{error}
            </span>
          )}
        </div>
        <label className="shrink-0">
          <input
            type="file"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          <Button type="button" variant="outline" size="sm" className="text-xs h-7" disabled={uploading}>
            {uploading ? `${progress}%` : url ? 'Replace' : 'Upload'}
          </Button>
        </label>
      </div>
      {uploading && (
        <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-info transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}

function DocBadge({ icon: Icon, label, url, highlighted }: { icon: React.ComponentType<{ className?: string }>; label: string; url: string | null; highlighted?: boolean }) {
  const borderClass = highlighted ? 'border-success/40 ring-1 ring-success/30 bg-success/10' : ''
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-all duration-300 ${borderClass}`}>
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="font-medium">{label}</span>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          View ↗
        </a>
      ) : (
        <span className="text-muted-foreground">Missing</span>
      )}
    </div>
  )
}

const GENERAL_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'INACTIVE', label: 'Inactive' },
]

const ENGAGEMENT_STATUS_OPTIONS = [
  { value: 'EMPLOYED', label: 'Employed' },
  { value: 'ENGAGED', label: 'Engaged' },
  { value: 'CONTRACTED', label: 'Contracted' },
  { value: 'END_OF_CONTRACT', label: 'End of Contract' },
  { value: 'TRANSFERRED', label: 'Transferred' },
  { value: 'RESIGNED', label: 'Resigned' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'BLACKLISTED', label: 'Blacklisted' },
]

function StatusCard({
  vaProfileId,
  status,
  engagementStatus,
  canEdit,
}: {
  vaProfileId: string
  status: string
  engagementStatus: string | null
  canEdit: boolean
}) {
  const [currentStatus, setCurrentStatus] = useState(status)
  const [currentEngagement, setCurrentEngagement] = useState(engagementStatus ?? '')
  const [pending, setPending] = useState<{ field: 'status' | 'engagementStatus'; value: string } | null>(null)
  const [effectiveDate, setEffectiveDate] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const openConfirm = (field: 'status' | 'engagementStatus', value: string) => {
    setPending({ field, value })
    setEffectiveDate(format(new Date(), 'yyyy-MM-dd'))
    setReason('')
  }

  const handleConfirm = async () => {
    if (!pending) return
    setSaving(true)
    try {
      await changeVAStatus(
        vaProfileId,
        pending.field === 'status' ? 'GENERAL' : 'ENGAGEMENT',
        pending.value,
        effectiveDate || undefined,
        reason || undefined
      )
      if (pending.field === 'status') setCurrentStatus(pending.value)
      else setCurrentEngagement(pending.value)
      toast.success(pending.field === 'status' ? 'Active status updated' : 'Engagement status updated')
      setPending(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Statuses</p>
      <div className="space-y-3">
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Active Status</Label>
          <select
            value={currentStatus}
            disabled={!canEdit}
            onChange={(e) => openConfirm('status', e.target.value)}
            className="w-full h-8 text-xs rounded-md border bg-background px-2 disabled:opacity-60"
          >
            {GENERAL_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Engagement Status</Label>
          <select
            value={currentEngagement}
            disabled={!canEdit}
            onChange={(e) => openConfirm('engagementStatus', e.target.value)}
            className="w-full h-8 text-xs rounded-md border bg-background px-2 disabled:opacity-60"
          >
            <option value="">— Not set —</option>
            {ENGAGEMENT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <Modal
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending?.field === 'status' ? 'Change Active Status' : 'Change Engagement Status'}
        description="Choose the date this status change took effect."
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setPending(null)} className="inline-flex items-center justify-center rounded-lg border bg-background hover:bg-muted text-xs font-medium h-8 px-3 transition-colors">
              Cancel
            </button>
            <Button type="button" size="sm" className="text-xs h-8" disabled={saving || !effectiveDate} onClick={handleConfirm}>
              {saving ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Saving...</> : 'Confirm'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Effective Date</Label>
            <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Client contract ended" className="h-8 text-xs" />
          </div>
        </div>
      </Modal>
    </div>
  )
}

function StatBox({ label, value, icon: Icon }: { label: string; value: string | null | undefined; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm font-semibold truncate">{value || '—'}</p>
    </div>
  )
}
