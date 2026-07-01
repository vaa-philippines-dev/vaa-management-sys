'use client'

import { useState, useEffect, useCallback } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Upload,
  FileText,
  Check,
  X,
  AlertCircle,
  ChevronRight,
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
import { updateVAProfile, updateUserProfileAction, updateEmployment, updateUserProfileFiles } from '@/app/(dashboard)/vas/actions'
import { format } from 'date-fns'
import type { DriveFile } from '@/lib/google/drive'

type VAData = {
  vaProfile: {
    id: string; isActive: boolean; hybrid: boolean
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
    personalEmail: string | null; payoneerAccount: string | null
    birthDate: string | null; nonCelebrant: boolean
    address: string | null; barangay: string | null
    cityMunicipality: string | null; province: string | null
    zipCode: string | null; landmark: string | null
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
}: {
  data: VAData
  skills: { id: string; name: string; proficiency: string | null }[]
  assignments: { id: string; clientName: string; type: string; agreedHours: number; startDate: string; endDate: string | null; status: string }[]
  documents: { id: string; documentType: string; fileName: string; googleDriveUrl: string }[]
  driveFiles: DriveFile[]
  currentUserId?: string
}) {
  const vaName = `${data.user.firstName} ${data.user.lastName}`.trim()
  const [recentUpload, setRecentUpload] = useState<string | null>(null)

  const handleRecentUpload = (field: string) => {
    setRecentUpload(field)
    setTimeout(() => setRecentUpload(null), 8000)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-0 rounded-2xl border bg-card overflow-hidden shadow-sm">
        <EditRow
          icon={User}
          label="Personal Information"
          dialogTitle="Personal Information"
          renderDialog={(close) => <PersonalFormContent data={data} onClose={close} />}
          preview={
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
              <Mini label="Assigned Email" value={data.user.email} />
              <Mini label="Personal Email" value={data.profile?.personalEmail} />
              <Mini label="WhatsApp" value={data.profile?.whatsappNumber} />
              <Mini label="Emergency" value={
                data.profile?.emergencyContactName
                  ? `${data.profile.emergencyContactName}${data.profile?.emergencyContactPhone ? ` — ${data.profile.emergencyContactPhone}` : ''}`
                  : null
              } />
            </div>
          }
        />

        <Divider />

        <EditRow
          icon={MapPin}
          label="Complete Address"
          dialogTitle="Complete Address"
          renderDialog={(close) => <AddressFormContent data={data} onClose={close} />}
          preview={
            <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
              <Mini label="#, Building & Street" value={data.profile?.address} />
              <Mini label="Province" value={data.profile?.province} />
              <Mini label="City / Municipality" value={data.profile?.cityMunicipality} />
              <Mini label="Barangay" value={data.profile?.barangay} />
              <Mini label="Zip Code" value={data.profile?.zipCode} />
              <Mini label="Landmark" value={data.profile?.landmark} />
            </div>
          }
        />

        <Divider />

        <EditRow
          icon={Briefcase}
          label="Employment & Payment"
          dialogTitle="Employment & Payment"
          renderDialog={(close) => <EmploymentFormContent data={data} onClose={close} />}
          size="md"
          preview={
            <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
              <Mini label="Position" value={data.membership?.positionTitle || data.vaProfile.vaaPosition} />
              <Mini label="Status" value={data.employment?.employmentStatus?.replace(/_/g, ' ')} />
              <Mini label="Base Rate" value={data.vaProfile.baseRate ? `₱${Number(data.vaProfile.baseRate).toLocaleString()}/hr` : null} />
              <Mini label="Hourly Rate" value={data.vaProfile.hourlyRate ? `$${Number(data.vaProfile.hourlyRate).toFixed(2)}/hr` : null} />
              <Mini label="Birth Date" value={data.profile?.birthDate ? format(new Date(data.profile.birthDate), 'MMM dd, yyyy') + (data.profile.nonCelebrant ? ' (NC)' : '') : null} />
              <Mini label="GCash" value={data.profile?.gcashNumber} />
              <Mini label="Payoneer" value={data.profile?.payoneerAccount} />
              <Mini label="Hired" value={data.employment?.startDate ? format(new Date(data.employment.startDate), 'MMM dd, yyyy') : null} />
            </div>
          }
        />

        <Divider />

        <EditRow
          icon={Globe}
          label="Socials"
          dialogTitle="Socials"
          renderDialog={(close) => <SocialsFormContent data={data} onClose={close} />}
          preview={
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
              <Mini label="Facebook Profile" value={data.profile?.facebookName} />
              <Mini label="Facebook URL" value={data.profile?.facebookUrl} link />
            </div>
          }
        />

        <Divider />

        <EditRow
          icon={Shield}
          label="201 Files"
          dialogTitle="201 Files"
          renderDialog={(close) => <Files201Content data={data} vaName={vaName} onJustUploaded={handleRecentUpload} onClose={close} currentUserId={currentUserId} />}
          size="lg"
          preview={
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                <Mini label="Passport Number" value={data.profile?.passportNumber} />
                <Mini label="PhilHealth Number" value={data.profile?.philhealthNumber} />
              </div>
              <div className="flex flex-wrap gap-2">
                <DocBadge icon={IdCard} label="Passport" url={data.profile?.passportPhoto} highlighted={recentUpload === 'passportPhoto'} />
                <DocBadge icon={Camera} label="PhilHealth" url={data.profile?.philhealthPhoto} highlighted={recentUpload === 'philhealthPhoto'} />
                <DocBadge icon={FileText} label="Contract" url={data.profile?.signedContract} highlighted={recentUpload === 'signedContract'} />
              </div>
            </div>
          }
        />
      </div>

      <div className="space-y-4">
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

function EditRow({
  icon: Icon,
  label,
  preview,
  dialogTitle,
  size,
  renderDialog,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  preview: React.ReactNode
  dialogTitle: string
  size?: 'sm' | 'md' | 'lg'
  renderDialog: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left px-5 py-4 hover:bg-muted/30 transition-colors group cursor-pointer"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0 min-w-[160px]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-semibold">{label}</p>
          </div>
          <div className="flex-1 min-w-0 flex items-center justify-end gap-3">
            <div className="flex-1 min-w-0">{preview}</div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
          </div>
        </div>
      </button>
      <Modal open={open} onOpenChange={setOpen} title={dialogTitle} size={size}>
        {renderDialog(close)}
      </Modal>
    </>
  )
}

function Mini({ label, value, link }: { label: string; value: string | null | undefined; link?: boolean }) {
  if (!value) return null
  return (
    <div className="min-w-0">
      <span className="text-[10px] text-muted-foreground/70 block truncate">{label}</span>
      {link ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate block">
          {value}
        </a>
      ) : (
        <span className="text-xs font-medium truncate block">{value}</span>
      )}
    </div>
  )
}

function DocBadge({
  icon: Icon,
  label,
  url,
  highlighted,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  url: string | null | undefined
  highlighted?: boolean
}) {
  if (!url) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border border-dashed border-muted-foreground/20 text-[10px] text-muted-foreground/50">
        <Icon className="h-3 w-3" />
        {label}
      </div>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition-all',
        highlighted
          ? 'bg-green-500/20 border-green-500/50 text-green-800 ring-2 ring-green-500/30 shadow-sm shadow-green-500/20'
          : 'bg-green-500/10 border-green-500/20 text-green-700 hover:bg-green-500/20'
      )}
    >
      <Check className="h-3 w-3" />
      <Icon className="h-3 w-3" />
      {label}
      {highlighted && (
        <span className="text-[9px] font-semibold uppercase tracking-wider mr-0.5">New</span>
      )}
      <ExternalLink className="h-2.5 w-2.5" />
    </a>
  )
}

function StatBox({ label, value, icon: Icon }: { label: string; value: string | null | undefined; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="p-2.5 rounded-xl bg-muted/30 border border-transparent hover:border-border/50 transition-colors">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-semibold truncate">
        {value || <span className="text-muted-foreground/40 font-normal">—</span>}
      </p>
    </div>
  )
}

function Divider() {
  return <div className="border-t mx-5" />
}

function FI({ name, label, defaultValue, type = 'text', placeholder }: { name: string; label: string; defaultValue?: string | null; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name} className="text-xs">{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue ?? ''} type={type} placeholder={placeholder} className="h-8 text-xs" />
    </div>
  )
}

function SavingButton({ label }: { label?: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" className="text-xs h-8" disabled={pending}>
      {pending ? (
        <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Saving...</>
      ) : (
        label ?? 'Save Changes'
      )}
    </Button>
  )
}

function FormSpy({ onSubmitted, label, saving }: { onSubmitted: () => void; label?: string; saving?: boolean }) {
  const { pending: formPending } = useFormStatus()
  const pending = saving ?? formPending

  useEffect(() => {
    if (formPending) return
  }, [formPending])

  return (
    <Button type="submit" size="sm" className="text-xs h-8" disabled={pending}>
      {pending ? (
        <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Saving...</>
      ) : (
        label ?? 'Save Changes'
      )}
    </Button>
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

function ModalCancelBtn({ onCancel }: { onCancel: () => void }) {
  return (
    <button
      type="button"
      onClick={onCancel}
      className="inline-flex items-center justify-center rounded-lg border bg-background hover:bg-muted text-xs font-medium h-8 px-3 transition-colors"
    >
      Cancel
    </button>
  )
}

function PersonalFormContent({ data, onClose }: { data: VAData; onClose: () => void }) {
  return (
    <SaveForm action={(fd) => updateUserProfileAction(data.user.id, fd)} onClose={onClose} toastLabel="Personal info saved" className="flex flex-col gap-4 h-full">
      {(saving) => (<>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 flex-1">
          <FI name="firstName" label="First Name" defaultValue={data.user.firstName} />
          <FI name="lastName" label="Last Name" defaultValue={data.user.lastName} />
          <FI name="personalEmail" label="Personal Email" defaultValue={data.profile?.personalEmail} type="email" placeholder="personal@email.com" />
          <FI name="whatsappNumber" label="WhatsApp Number" defaultValue={data.profile?.whatsappNumber} placeholder="09000000000" />
          <FI name="emergencyContactName" label="Emergency Contact Name" defaultValue={data.profile?.emergencyContactName} />
          <FI name="emergencyContactPhone" label="Emergency Contact Number" defaultValue={data.profile?.emergencyContactPhone} placeholder="09000000000" />
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <button type="button" onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg border bg-background hover:bg-muted text-xs font-medium h-8 px-3 transition-colors">
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
    <SaveForm action={(fd) => updateUserProfileAction(data.user.id, fd)} onClose={onClose} toastLabel="Address saved" className="flex flex-col gap-4 h-full">
      {(saving) => (<>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 flex-1">
          <FI name="address" label="House #, Building & Street Name" defaultValue={data.profile?.address} placeholder="123 Main St, Building A" />
          <FI name="province" label="Province" defaultValue={data.profile?.province} />
          <FI name="cityMunicipality" label="City / Municipality" defaultValue={data.profile?.cityMunicipality} />
          <FI name="barangay" label="Barangay" defaultValue={data.profile?.barangay} />
          <FI name="zipCode" label="Zip Code" defaultValue={data.profile?.zipCode} placeholder="1000" />
          <FI name="landmark" label="Landmark" defaultValue={data.profile?.landmark} />
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <button type="button" onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg border bg-background hover:bg-muted text-xs font-medium h-8 px-3 transition-colors">
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
    <SaveForm action={(fd) => updateEmployment(data.vaProfile.id, data.user.id, fd)} onClose={onClose} toastLabel="Employment & pay saved" className="flex flex-col gap-4 h-full">
      {(saving) => (<>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 flex-1">
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
        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <button type="button" onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg border bg-background hover:bg-muted text-xs font-medium h-8 px-3 transition-colors">
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
    <SaveForm action={(fd) => updateUserProfileAction(data.user.id, fd)} onClose={onClose} toastLabel="Socials saved" className="flex flex-col gap-4 h-full">
      {(saving) => (<>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 flex-1">
          <FI name="facebookName" label="Facebook Name" defaultValue={data.profile?.facebookName} />
          <FI name="facebookUrl" label="Facebook URL" defaultValue={data.profile?.facebookUrl} placeholder="https://facebook.com/..." />
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <button type="button" onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg border bg-background hover:bg-muted text-xs font-medium h-8 px-3 transition-colors">
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
    await updateUserProfileFiles(data.user.id, passportPhoto, philhealthPhoto, signedContract)
    setSaving(false)
    onClose()
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <FI name="passportNumber" label="Passport Number" defaultValue={data.profile?.passportNumber} />
        <FI name="philhealthNumber" label="PhilHealth Number" defaultValue={data.profile?.philhealthNumber} />
      </div>
      <div className="border-t pt-4 flex-1 overflow-y-auto">
        <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-1.5">
          <Upload className="h-3 w-3" /> Upload Documents
        </p>
        <div className="space-y-4">
          <UploadRow label="Passport Photo" icon={IdCard} currentUrl={passportPhoto} fieldName="passportPhoto" vaName={vaName} profileId={data.user.id} uploadedBy={currentUserId} onUploaded={setPassportPhoto} onJustUploaded={handleJustUploaded} />
          <UploadRow label="PhilHealth Photo" icon={Camera} currentUrl={philhealthPhoto} fieldName="philhealthPhoto" vaName={vaName} profileId={data.user.id} uploadedBy={currentUserId} onUploaded={setPhilhealthPhoto} onJustUploaded={handleJustUploaded} />
          <UploadRow label="Signed Contract" icon={FileText} currentUrl={signedContract} fieldName="signedContract" vaName={vaName} profileId={data.user.id} uploadedBy={currentUserId} onUploaded={setSignedContract} onJustUploaded={handleJustUploaded} />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-2 border-t">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center rounded-lg border bg-background hover:bg-muted text-xs font-medium h-8 px-3 transition-colors"
        >
          Cancel
        </button>
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
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadedUrl, setUploadedUrl] = useState(currentUrl)
  const [justUploaded, setJustUploaded] = useState(false)

  const handleFile = (file: File) => {
    setFileName(file.name)
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
      if (xhr.status >= 200 && xhr.status < 300) {
        const res = JSON.parse(xhr.responseText)
        if (res.success) {
          setUploadedUrl(res.url)
          onUploaded(res.url)
          setJustUploaded(true)
          onJustUploaded?.(fieldName)
          setProgress(100)
          toast.success(`${label} uploaded successfully!`, {
            description: `Saved to Drive: ${res.fullPath || fieldName}`,
            duration: 6000,
            action: { label: 'View Document here', onClick: () => window.open(res.url, '_blank') },
          })
        } else {
          const message = res.error || 'Upload failed'
          setError(message)
          toast.error('Upload failed', { description: message })
        }
      } else {
        setError('Upload failed')
        toast.error('Upload failed', { description: `Server returned ${xhr.status}` })
      }
    })
    xhr.addEventListener('error', () => { setUploading(false); setError('Network error'); toast.error('Network error', { description: 'Could not reach the upload server.' }) })
    xhr.open('POST', '/api/upload')
    xhr.send(formData)
  }

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-xl border transition-all duration-300',
      justUploaded ? 'border-green-500/50 bg-green-500/5 ring-2 ring-green-500/20' : 'border bg-muted/10 hover:bg-muted/20'
    )}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium">{label}</p>
          {justUploaded && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-green-600 bg-green-500/15 px-1.5 py-0.5 rounded-full">
              <span className="h-1 w-1 rounded-full bg-green-600 animate-pulse" /> Just uploaded
            </span>
          )}
        </div>
        {uploading ? (
          <div className="mt-1">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground truncate">{fileName}</span>
              <span className="text-[10px] text-primary font-medium ml-auto">{progress}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : uploadedUrl ? (
          <div className="flex items-center gap-2 mt-0.5">
            <Check className="h-3 w-3 text-green-600 shrink-0" />
            <a href={uploadedUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate">View file</a>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">No file uploaded</p>
        )}
        {error && (
          <p className="text-[10px] text-red-500 mt-0.5 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {error}
          </p>
        )}
      </div>
      <label className="cursor-pointer shrink-0 inline-flex items-center justify-center rounded-lg border bg-background hover:bg-muted text-xs font-medium h-7 px-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
        <input type="file" accept="image/*,.pdf" disabled={uploading} className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        <Upload className="h-3 w-3 mr-1" />
        {uploadedUrl ? 'Replace' : 'Upload'}
      </label>
    </div>
  )
}

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
