'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import { Briefcase, Building2, Camera, FileText, Globe, IdCard, Layers, Loader2, MapPin, Shield, User, UserPlus, Wallet } from 'lucide-react'
import {
  EditableSection,
  TableRow,
  FI,
  SaveForm,
  PersonalFormContent,
  AddressFormContent,
  SocialsFormContent,
  Files201Content,
  DocBadge,
  StatBox,
  type PersonData,
} from '@/components/vas/VAProfileEditor'
import { updateUserProfileAction } from '@/app/(dashboard)/vas/actions'
import { updateStaffEngagement, changeStaffStatus, offboardStaff, demoteStaffToVA, createStaffAccount } from '@/app/(dashboard)/staff/actions'
import {
  STAFF_STATUS_OPTIONS,
  STAFF_EMPLOYMENT_OPTIONS,
  STAFF_OFFBOARDED_STATUSES,
  STAFF_OFFBOARD_OUTCOMES,
  titleCase,
} from '@/lib/staff-fields'

export type StaffEngagement = {
  recordId: string
  staffId: string | null
  department: string | null
  subdepartment: string | null
  position: string | null
  level: string | null
  workEmail: string | null
  hireDate: string | null // yyyy-mm-dd
  startDate: string | null
  eocDate: string | null
  generalStatus: string | null
  employmentStatus: string | null
  remarks: string | null
  tenure: string | null
}

type Account = { userType: string; systemRole: string } | null

const fmt = (d: string | null) => (d ? format(new Date(`${d}T00:00:00`), 'MMM dd, yyyy') : null)

const cancelBtn = 'inline-flex items-center justify-center rounded-lg border bg-background hover:bg-muted text-xs font-medium h-8 px-3 transition-colors'

// Mirrors VAProfileEditor's layout. The personal/address/socials/201 sections
// are the VA 201's own components (they're keyed on the User); Employment,
// Statuses and Offboarding are staff-specific because a staff member's
// position lives on their StaffRecord, not a VAProfile.
export function StaffProfileEditor({
  name,
  engagement,
  person,
  account,
  currentUserId,
  canEdit,
  canViewSensitive,
}: {
  name: string
  engagement: StaffEngagement
  person: PersonData | null // null = no login account yet
  account: Account
  currentUserId: string
  canEdit: boolean
  canViewSensitive: boolean
}) {
  const [recentUpload, setRecentUpload] = useState<string | null>(null)
  const handleRecentUpload = (field: string) => {
    setRecentUpload(field)
    setTimeout(() => setRecentUpload(null), 8000)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {person ? (
          <>
            {canViewSensitive && (
              <EditableSection
                icon={User}
                label="Personal Information"
                renderEdit={(onClose) => <PersonalFormContent data={person} onClose={onClose} />}
                canEdit={canEdit}
              >
                <TableRow label="Assigned Email" value={person.user.email} />
                <TableRow label="Work Email" value={person.profile?.workEmail ?? engagement.workEmail} />
                <TableRow label="Personal Email" value={person.profile?.personalEmail} />
                <TableRow label="WhatsApp" value={person.profile?.whatsappNumber} />
                <TableRow
                  label="Emergency Contact"
                  value={person.profile?.emergencyContactName
                    ? `${person.profile.emergencyContactName}${person.profile.emergencyContactPhone ? ` — ${person.profile.emergencyContactPhone}` : ''}`
                    : person.profile?.emergencyContactPhone}
                />
                <TableRow label="Religion" value={person.profile?.religion} />
              </EditableSection>
            )}

            {canViewSensitive && (
              <EditableSection
                icon={MapPin}
                label="Complete Address"
                renderEdit={(onClose) => <AddressFormContent data={person} onClose={onClose} />}
                canEdit={canEdit}
              >
                <TableRow label="#, Building & Street" value={person.profile?.address} />
                <TableRow label="Province" value={person.profile?.province} />
                <TableRow label="City / Municipality" value={person.profile?.cityMunicipality} />
                <TableRow label="Barangay" value={person.profile?.barangay} />
                <TableRow label="Zip Code" value={person.profile?.zipCode} />
                <TableRow label="Landmark" value={person.profile?.landmark} />
              </EditableSection>
            )}
          </>
        ) : (
          <NoAccountCard recordId={engagement.recordId} name={name} canEdit={canEdit} />
        )}

        <EditableSection
          icon={Briefcase}
          label="Employment & Payment"
          renderEdit={(onClose) => <EmploymentForm engagement={engagement} person={person} onClose={onClose} />}
          canEdit={canEdit}
        >
          <TableRow label="Staff ID" value={engagement.staffId} />
          <TableRow label="Department" value={engagement.department} />
          <TableRow label="Subdepartment" value={engagement.subdepartment} />
          <TableRow label="Position" value={engagement.position} />
          <TableRow label="Level" value={engagement.level} />
          <TableRow label="VAA Hire Date" value={fmt(engagement.hireDate)} />
          <TableRow label="Start Date (this role)" value={fmt(engagement.startDate)} />
          <TableRow label="EOC Date" value={fmt(engagement.eocDate)} />
          {canViewSensitive && person && (
            <>
              <TableRow label="Birth Date" value={person.profile?.birthDate ? format(new Date(person.profile.birthDate), 'MMM dd, yyyy') + (person.profile.nonCelebrant ? ' (NC)' : '') : null} />
              <TableRow label="GCash" value={person.profile?.gcashNumber} />
              <TableRow label="Payoneer Email" value={person.profile?.payoneerAccount} />
              <TableRow label="Payoneer ID" value={person.profile?.payoneerId} />
            </>
          )}
        </EditableSection>

        {person && (
          <EditableSection
            icon={Globe}
            label="Socials"
            renderEdit={(onClose) => <SocialsFormContent data={person} onClose={onClose} />}
            canEdit={canEdit}
          >
            <TableRow label="Facebook Profile" value={person.profile?.facebookName} />
            <TableRow label="Facebook URL" value={person.profile?.facebookUrl} link />
          </EditableSection>
        )}

        {person && canViewSensitive && (
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm font-semibold">201 Files</p>
            </div>
            <div className="border-t px-5 py-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <TableRow label="Passport Number" value={person.profile?.passportNumber} />
                <TableRow label="PhilHealth Number" value={person.profile?.philhealthNumber} />
              </div>
              <div className="flex flex-wrap gap-2">
                <DocBadge icon={IdCard} label="Passport" url={person.profile?.passportPhoto ?? null} highlighted={recentUpload === 'passportPhoto'} />
                <DocBadge icon={Camera} label="PhilHealth" url={person.profile?.philhealthPhoto ?? null} highlighted={recentUpload === 'philhealthPhoto'} />
                <DocBadge icon={FileText} label="Contract" url={person.profile?.signedContract ?? null} highlighted={recentUpload === 'signedContract'} />
              </div>
              {canEdit && (
                <Files201Content data={person} vaName={name} onJustUploaded={handleRecentUpload} onClose={() => {}} currentUserId={currentUserId} />
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <StaffStatusCard engagement={engagement} canEdit={canEdit} />
        <StaffOffboardingCard engagement={engagement} name={name} account={account} canEdit={canEdit} />

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Overview</p>
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Department" value={engagement.department} icon={Building2} />
            <StatBox label="Level" value={engagement.level} icon={Layers} />
            <StatBox label="Staff ID" value={engagement.staffId} icon={IdCard} />
            <StatBox label="Tenure" value={engagement.tenure} icon={Wallet} />
          </div>
        </div>

        {engagement.remarks && (
          <div className="rounded-2xl border bg-muted/20 p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Remarks</p>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{engagement.remarks}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Staff engagement fields save to the StaffRecord; payment fields to the
// UserProfile (the same action the VA 201 uses). Two writes, one form.
function EmploymentForm({ engagement, person, onClose }: { engagement: StaffEngagement; person: PersonData | null; onClose: () => void }) {
  const save = async (fd: FormData) => {
    await updateStaffEngagement(engagement.recordId, fd)
    if (person) {
      const profileFd = new FormData()
      for (const key of ['birthDate', 'gcashNumber', 'payoneerAccount', 'payoneerId']) profileFd.set(key, (fd.get(key) as string) ?? '')
      profileFd.set('nonCelebrant', fd.get('nonCelebrant') === 'true' ? 'true' : 'false')
      await updateUserProfileAction(person.user.id, profileFd)
    }
  }
  return (
    <SaveForm action={save} onClose={onClose} toastLabel="Employment & pay saved" className="flex flex-col gap-4">
      {(saving) => (<>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <FI name="staffId" label="Staff ID" defaultValue={engagement.staffId} placeholder="26-001" />
          <FI name="position" label="VAA Position" defaultValue={engagement.position} />
          <FI name="department" label="Department" defaultValue={engagement.department} />
          <FI name="subdepartment" label="Subdepartment" defaultValue={engagement.subdepartment} />
          <FI name="level" label="Level" defaultValue={engagement.level} />
          <FI name="workEmail" label="Work Email" defaultValue={engagement.workEmail} type="email" />
          <FI name="hireDate" label="VAA Hire Date" defaultValue={engagement.hireDate} type="date" />
          <FI name="startDate" label="Start Date (this role)" defaultValue={engagement.startDate} type="date" />
          {person && (
            <>
              <FI name="birthDate" label="Birth Date" defaultValue={person.profile?.birthDate?.slice(0, 10)} type="date" />
              <div className="flex items-center gap-2 self-end pb-2">
                <input type="checkbox" id="nonCelebrant" name="nonCelebrant" value="true" defaultChecked={person.profile?.nonCelebrant} className="rounded" />
                <Label htmlFor="nonCelebrant" className="text-xs cursor-pointer">Doesn&apos;t celebrate birthdays</Label>
              </div>
              <FI name="gcashNumber" label="GCash Number" defaultValue={person.profile?.gcashNumber} placeholder="09000000000" />
              <FI name="payoneerAccount" label="Payoneer Email" defaultValue={person.profile?.payoneerAccount} type="email" />
              <FI name="payoneerId" label="Payoneer ID" defaultValue={person.profile?.payoneerId} />
            </>
          )}
          <div className="sm:col-span-2">
            <FI name="remarks" label="Remarks" defaultValue={engagement.remarks} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button type="button" onClick={onClose} className={cancelBtn}>Cancel</button>
          <Button type="submit" size="sm" className="text-xs h-8" disabled={saving}>
            {saving ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Saving...</> : 'Save Changes'}
          </Button>
        </div>
      </>)}
    </SaveForm>
  )
}

function StaffStatusCard({ engagement, canEdit }: { engagement: StaffEngagement; canEdit: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState<{ field: 'GENERAL' | 'EMPLOYMENT'; value: string } | null>(null)
  const [effectiveDate, setEffectiveDate] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const openConfirm = (field: 'GENERAL' | 'EMPLOYMENT', value: string) => {
    setPending({ field, value })
    setEffectiveDate(format(new Date(), 'yyyy-MM-dd'))
    setReason('')
  }

  const handleConfirm = async () => {
    if (!pending) return
    setSaving(true)
    try {
      await changeStaffStatus(engagement.recordId, pending.field, pending.value, effectiveDate || undefined, reason || undefined)
      toast.success(pending.field === 'GENERAL' ? 'Status updated' : 'Employment status updated')
      setPending(null)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setSaving(false)
    }
  }

  const select = (field: 'GENERAL' | 'EMPLOYMENT', value: string | null, options: readonly string[]) => (
    <select
      value={value ?? ''}
      disabled={!canEdit}
      onChange={(e) => e.target.value && openConfirm(field, e.target.value)}
      className="w-full h-8 text-xs rounded-md border bg-background px-2 disabled:opacity-60"
    >
      {!value && <option value="">— Not set —</option>}
      {options.map((opt) => <option key={opt} value={opt}>{titleCase(opt)}</option>)}
    </select>
  )

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Statuses</p>
      <div className="space-y-3">
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">General Status</Label>
          {select('GENERAL', engagement.generalStatus, STAFF_STATUS_OPTIONS)}
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Employment Status</Label>
          {select('EMPLOYMENT', engagement.employmentStatus, STAFF_EMPLOYMENT_OPTIONS)}
        </div>
      </div>

      <Modal
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending?.field === 'GENERAL' ? 'Change General Status' : 'Change Employment Status'}
        description="Choose the date this status change took effect."
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setPending(null)} className={cancelBtn}>Cancel</button>
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
            <Input value={reason} onChange={(e) => setReason(e.target.value)} className="h-8 text-xs" />
          </div>
        </div>
      </Modal>
    </div>
  )
}

// Active staff: an Offboard modal (Resigned / Removed / Back to VA). Already
// offboarded but still on an internal-staff account: a "Move to VA
// Masterlist" demotion on its own.
function StaffOffboardingCard({ engagement, name, account, canEdit }: { engagement: StaffEngagement; name: string; account: Account; canEdit: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState<'offboard' | 'demote' | null>(null)
  const [outcome, setOutcome] = useState<string>('RESIGNED')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  if (!canEdit) return null
  const offboarded = STAFF_OFFBOARDED_STATUSES.has(engagement.generalStatus ?? '')
  const isVAAccount = account?.userType === 'VIRTUAL_ASSISTANT'
  const canDemote = !!account && !isVAAccount
  if (offboarded && !canDemote) return null

  const openModal = (kind: 'offboard' | 'demote') => {
    setOutcome('RESIGNED')
    setEffectiveDate(format(new Date(), 'yyyy-MM-dd'))
    setReason('')
    setOpen(kind)
  }

  const submit = async () => {
    setSaving(true)
    try {
      if (open === 'demote') {
        await demoteStaffToVA(engagement.recordId, reason)
        toast.success(`${name} moved to the VA Masterlist`)
      } else {
        const fd = new FormData()
        fd.set('outcome', outcome)
        fd.set('effectiveDate', effectiveDate)
        fd.set('reason', reason)
        await offboardStaff(engagement.recordId, fd)
        toast.success(outcome === 'RETURN_TO_VA' ? `${name} offboarded and moved to the VA Masterlist` : `${name} offboarded`)
      }
      setOpen(null)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to offboard')
    } finally {
      setSaving(false)
    }
  }

  const outcomes = STAFF_OFFBOARD_OUTCOMES.filter((o) => o.value !== 'RETURN_TO_VA' || canDemote)

  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 shadow-sm">
      <p className="text-xs font-medium text-destructive mb-3 uppercase tracking-wider">Offboarding</p>
      {offboarded ? (
        <>
          <p className="text-[11px] text-muted-foreground mb-2">Offboarded as staff, but still on an internal-staff account.</p>
          <Button type="button" variant="outline" size="sm" className="text-xs h-8 w-full" onClick={() => openModal('demote')}>
            Move to VA Masterlist
          </Button>
        </>
      ) : (
        <Button type="button" variant="destructive" size="sm" className="text-xs h-8 w-full" onClick={() => openModal('offboard')}>
          Offboard
        </Button>
      )}

      <Modal
        open={!!open}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open === 'demote' ? `Move ${name} to VA` : `Offboard ${name}`}
        description={
          open === 'demote' || outcome === 'RETURN_TO_VA'
            ? 'Their account becomes a VA account and they reappear on the VA Masterlist, with their earlier VA profile and history.'
            : 'Ends their current staff engagement.'
        }
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setOpen(null)} className={cancelBtn}>Cancel</button>
            <Button type="button" size="sm" variant="destructive" className="text-xs h-8" disabled={saving || (open === 'offboard' && !effectiveDate)} onClick={submit}>
              {saving ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Saving...</> : open === 'demote' || outcome === 'RETURN_TO_VA' ? 'Move to VA' : 'Offboard'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {open === 'offboard' && (
            <>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Outcome</Label>
                <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="w-full h-8 text-xs rounded-md border bg-background px-2">
                  {outcomes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Effective Date</Label>
                <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="h-8 text-xs" />
              </div>
            </>
          )}
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} className="h-8 text-xs" />
          </div>
        </div>
      </Modal>
    </div>
  )
}

function NoAccountCard({ recordId, name, canEdit }: { recordId: string; name: string; canEdit: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  const create = async () => {
    setSaving(true)
    try {
      await createStaffAccount(recordId, email)
      toast.success(`Account created for ${name}`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-dashed bg-card p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          <UserPlus className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold">No login account</p>
      </div>
      <p className="text-xs text-muted-foreground">
        The sheet had no usable email for {name}. Personal info, the onboarding link and 201 uploads need an account.
      </p>
      {canEdit && (
        <div className="flex gap-2 mt-3">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="login email" type="email" className="h-8 text-xs" />
          <Button type="button" size="sm" className="text-xs h-8 shrink-0" disabled={saving || !email} onClick={create}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Create account'}
          </Button>
        </div>
      )}
    </div>
  )
}
