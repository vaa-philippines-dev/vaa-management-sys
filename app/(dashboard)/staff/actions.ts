'use server'

import { prisma } from '@/lib/prisma'
import { requireRole, STAFF_MUTATOR_ROLES } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { getStaffPerson } from '@/lib/staff'
import { STAFF_EMPLOYMENT_OPTIONS, STAFF_STATUS_OPTIONS } from '@/lib/staff-fields'

const text = (fd: FormData, key: string) => {
  const v = fd.get(key)
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

// <input type="date"> values are bare calendar dates — anchor them at UTC
// midnight like every imported sheet date (see parseDmfDate).
const dateValue = (fd: FormData, key: string) => {
  const v = text(fd, key)
  if (!v) return null
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) throw new Error(`Invalid date for ${key}`)
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

function revalidateStaff() {
  revalidatePath('/masterlist')
  revalidatePath('/staff', 'layout')
  revalidatePath('/vas', 'layout')
  revalidateTag(CACHE_TAGS.vas, 'default')
  revalidateTag(CACHE_TAGS.users, 'default')
}

async function loadPerson(recordId: string) {
  const person = await getStaffPerson(recordId)
  if (!person) throw new Error('Staff record not found')
  return person
}

// The Employment section of the Staff 201 — edits the person's latest
// engagement (their current position), same fields as the sheet's row.
export async function updateStaffEngagement(recordId: string, formData: FormData) {
  const actor = await requireRole(...STAFF_MUTATOR_ROLES)
  const person = await loadPerson(recordId)
  const latest = person.latest

  const data = {
    staffId: text(formData, 'staffId'),
    department: text(formData, 'department'),
    subdepartment: text(formData, 'subdepartment'),
    position: text(formData, 'position'),
    level: text(formData, 'level'),
    workEmail: text(formData, 'workEmail')?.toLowerCase() ?? null,
    hireDate: dateValue(formData, 'hireDate'),
    startDate: dateValue(formData, 'startDate'),
    remarks: text(formData, 'remarks'),
  }

  await prisma.staffRecord.update({ where: { id: latest.id }, data })
  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'StaffRecord',
    entityId: latest.id,
    before: {
      staffId: latest.staffId, department: latest.department, subdepartment: latest.subdepartment,
      position: latest.position, level: latest.level, workEmail: latest.workEmail,
      hireDate: latest.hireDate, startDate: latest.startDate, remarks: latest.remarks,
    },
    after: data,
  })
  revalidateStaff()
}

// The Statuses card: a status change with an effective date, same as the VA 201.
export async function changeStaffStatus(
  recordId: string,
  field: 'GENERAL' | 'EMPLOYMENT',
  value: string,
  effectiveDate?: string,
  reason?: string
) {
  const actor = await requireRole(...STAFF_MUTATOR_ROLES)
  const allowed: readonly string[] = field === 'GENERAL' ? STAFF_STATUS_OPTIONS : STAFF_EMPLOYMENT_OPTIONS
  if (!allowed.includes(value)) throw new Error(`Invalid status: ${value}`)
  const person = await loadPerson(recordId)
  const latest = person.latest

  const fd = new FormData()
  if (effectiveDate) fd.set('effectiveDate', effectiveDate)
  const effective = dateValue(fd, 'effectiveDate') ?? new Date()

  const data = field === 'GENERAL'
    ? { generalStatus: value, statusDate: effective }
    : { employmentStatus: value, ...(value === 'END OF CONTRACT' && !latest.eocDate ? { eocDate: effective } : {}) }

  await prisma.staffRecord.update({ where: { id: latest.id }, data })
  await logAudit({
    actorId: actor.id,
    action: 'STATUS_CHANGE',
    entityType: 'StaffRecord',
    entityId: latest.id,
    before: field === 'GENERAL' ? { generalStatus: latest.generalStatus } : { employmentStatus: latest.employmentStatus },
    after: data,
    metadata: { reason: reason ?? null },
  })
  revalidateStaff()
}

// Turns the person's account back into a VA account so they reappear on the
// VA Masterlist. Their VA profile (rates, history, documents) is kept from
// before they became staff; one is created if they never had it.
async function demoteToVA(actorId: string, userId: string, effective: Date, reason: string | null) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, userType: true, systemRole: true, vaProfile: { select: { id: true, status: true } } },
  })
  if (!user) throw new Error('Account not found')
  if (user.userType === 'VIRTUAL_ASSISTANT' && user.systemRole === 'VA') return

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { userType: 'VIRTUAL_ASSISTANT', systemRole: 'VA' } })
    if (user.vaProfile) {
      await tx.vAProfile.update({ where: { id: user.vaProfile.id }, data: { status: 'ACTIVE' } })
    } else {
      await tx.vAProfile.create({ data: { userId, status: 'ACTIVE' } })
    }
    // Shows on the VA 201's History card.
    await tx.vAHistory.create({
      data: {
        userId,
        eventType: 'STATUS_CHANGE',
        oldValue: `Internal staff (${user.systemRole})`,
        newValue: 'Virtual Assistant',
        effectiveDate: effective,
        reason: reason ?? 'Moved back to VA from the Staff Masterlist',
        changedById: actorId,
      },
    })
  })

  await logAudit({
    actorId,
    action: 'ROLE_CHANGE',
    entityType: 'User',
    entityId: userId,
    before: { userType: user.userType, systemRole: user.systemRole },
    after: { userType: 'VIRTUAL_ASSISTANT', systemRole: 'VA' },
    metadata: { source: 'staff_offboarding', reason },
  })
}

// Offboarding for staff. Unlike a VA's, there's no client relationship to
// unwind, so it's a direct status change on the latest engagement rather than
// an offboarding ticket. RETURN_TO_VA ends the engagement as TRANSFERRED and
// demotes the account (see demoteToVA).
export async function offboardStaff(recordId: string, formData: FormData) {
  const actor = await requireRole(...STAFF_MUTATOR_ROLES)
  const outcome = text(formData, 'outcome')
  if (outcome !== 'RESIGNED' && outcome !== 'REMOVED' && outcome !== 'RETURN_TO_VA') throw new Error('Choose an outcome')
  const effective = dateValue(formData, 'effectiveDate')
  if (!effective) throw new Error('Effective date is required')
  const reason = text(formData, 'reason')

  const person = await loadPerson(recordId)
  const latest = person.latest
  if (outcome === 'RETURN_TO_VA' && !latest.userId) throw new Error('This person has no account to move back to VA')

  const data = {
    generalStatus: outcome === 'RETURN_TO_VA' ? 'TRANSFERRED' : outcome,
    employmentStatus: outcome === 'RETURN_TO_VA' ? 'TRANSFERRED' : 'END OF CONTRACT',
    statusDate: effective,
    eocDate: effective,
    remarks: reason ? [latest.remarks, reason].filter(Boolean).join(' | ') : latest.remarks,
  }
  await prisma.staffRecord.update({ where: { id: latest.id }, data })
  await logAudit({
    actorId: actor.id,
    action: 'STATUS_CHANGE',
    entityType: 'StaffRecord',
    entityId: latest.id,
    before: { generalStatus: latest.generalStatus, employmentStatus: latest.employmentStatus, eocDate: latest.eocDate },
    after: data,
    metadata: { source: 'staff_offboarding', outcome, reason },
  })

  if (outcome === 'RETURN_TO_VA') await demoteToVA(actor.id, latest.userId!, effective, reason)
  revalidateStaff()
}

// For someone already offboarded as staff whose account is still internal:
// move them back onto the VA Masterlist without changing their staff record.
export async function demoteStaffToVA(recordId: string, reason?: string) {
  const actor = await requireRole(...STAFF_MUTATOR_ROLES)
  const person = await loadPerson(recordId)
  if (!person.latest.userId) throw new Error('This person has no account to move back to VA')
  await demoteToVA(actor.id, person.latest.userId, new Date(), reason?.trim() || null)
  revalidateStaff()
}

// Sheet rows imported without an account (no usable email) — gives the person
// a STAFF login so they can get an onboarding link and 201 uploads.
export async function createStaffAccount(recordId: string, email: string) {
  const actor = await requireRole(...STAFF_MUTATOR_ROLES)
  const normalized = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Enter a valid email address')
  const person = await loadPerson(recordId)
  if (person.latest.userId) throw new Error('This person already has an account')
  if (await prisma.user.findUnique({ where: { email: normalized }, select: { id: true } })) {
    throw new Error('That email already belongs to another account')
  }

  const latest = person.latest
  const user = await prisma.user.create({
    data: {
      email: normalized,
      firstName: latest.firstName,
      lastName: latest.lastName ?? '',
      userType: 'INTERNAL_STAFF',
      systemRole: 'STAFF',
      profile: { create: { workEmail: latest.workEmail } },
    },
    select: { id: true },
  })
  await prisma.staffRecord.updateMany({ where: { id: { in: person.records.map((r) => r.id) } }, data: { userId: user.id } })
  await logAudit({
    actorId: actor.id,
    action: 'CREATE',
    entityType: 'User',
    entityId: user.id,
    after: { email: normalized, userType: 'INTERNAL_STAFF', systemRole: 'STAFF' },
    metadata: { source: 'staff_masterlist', staffRecordId: latest.id },
  })
  revalidateStaff()
  return { userId: user.id }
}

// "Add Staff" on the masterlist: a new STAFF account plus its first engagement.
export async function addStaff(formData: FormData) {
  const actor = await requireRole(...STAFF_MUTATOR_ROLES)
  const firstName = text(formData, 'firstName')
  const lastName = text(formData, 'lastName')
  const email = text(formData, 'email')?.toLowerCase() ?? null
  if (!firstName || !lastName) throw new Error('First and last name are required')
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address')
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new Error('That email already belongs to another account')
  }

  const hireDate = dateValue(formData, 'hireDate')
  const user = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      userType: 'INTERNAL_STAFF',
      systemRole: 'STAFF',
      profile: { create: { workEmail: text(formData, 'workEmail')?.toLowerCase() ?? null } },
    },
    select: { id: true },
  })
  const record = await prisma.staffRecord.create({
    data: {
      userId: user.id,
      firstName,
      lastName,
      department: text(formData, 'department'),
      subdepartment: text(formData, 'subdepartment'),
      position: text(formData, 'position'),
      level: text(formData, 'level'),
      workEmail: text(formData, 'workEmail')?.toLowerCase() ?? null,
      hireDate,
      startDate: hireDate,
      generalStatus: 'ACTIVE',
      employmentStatus: 'EMPLOYED',
    },
    select: { id: true },
  })
  await logAudit({
    actorId: actor.id,
    action: 'CREATE',
    entityType: 'StaffRecord',
    entityId: record.id,
    after: { userId: user.id, email, firstName, lastName },
  })
  revalidateStaff()
  return { recordId: record.id, userId: user.id }
}
