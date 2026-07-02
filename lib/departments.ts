import { prisma } from '@/lib/prisma'

export type DepartmentLevel = 'EXECUTIVE' | 'MANAGEMENT' | 'SERVICE'
export type DepartmentStatus = 'ACTIVE' | 'MERGED' | 'SPLIT' | 'INACTIVE'

export const DEPARTMENT_LEVELS: DepartmentLevel[] = ['EXECUTIVE', 'MANAGEMENT', 'SERVICE']
export const LEVEL_RECORD_NAMES = ['Executive', 'Management', 'Service']

export type ValidationError = { field: string; message: string }
export class DepartmentValidationError extends Error {
  errors: ValidationError[]
  constructor(errors: ValidationError[]) {
    super(errors.map(e => `${e.field}: ${e.message}`).join('; '))
    this.errors = errors
    this.name = 'DepartmentValidationError'
  }
}

const MAX_NAME_LENGTH = 100
const MAX_SHORT_NAME_LENGTH = 50
const ACRONYM_MIN = 2
const ACRONYM_MAX = 6
const ACRONYM_REGEX = /^[A-Z]{2,6}$/

export function normalizeName(input: string): string {
  return (input ?? '').trim()
}

export function normalizeShortName(input: string | null | undefined): string | null {
  if (input == null) return null
  const trimmed = input.trim()
  return trimmed.length === 0 ? null : trimmed
}

export function normalizeAcronym(input: string | null | undefined): string | null {
  if (input == null) return null
  const trimmed = input.trim().toUpperCase()
  return trimmed.length === 0 ? null : trimmed
}

export function validateName(name: string, errors: ValidationError[]): string {
  const trimmed = normalizeName(name)
  if (!trimmed) {
    errors.push({ field: 'name', message: 'Department name is required' })
  } else if (trimmed.length > MAX_NAME_LENGTH) {
    errors.push({ field: 'name', message: `Must not exceed ${MAX_NAME_LENGTH} characters` })
  }
  return trimmed
}

export function validateShortName(shortName: string | null | undefined, errors: ValidationError[]): string | null {
  const normalized = normalizeShortName(shortName)
  if (normalized && normalized.length > MAX_SHORT_NAME_LENGTH) {
    errors.push({ field: 'shortName', message: `Must not exceed ${MAX_SHORT_NAME_LENGTH} characters` })
  }
  return normalized
}

export function validateAcronym(acronym: string | null | undefined, errors: ValidationError[]): string | null {
  const normalized = normalizeAcronym(acronym)
  if (!normalized) {
    errors.push({ field: 'acronym', message: 'Acronym is required' })
    return null
  }
  if (normalized.length < ACRONYM_MIN || normalized.length > ACRONYM_MAX) {
    errors.push({ field: 'acronym', message: `Must be ${ACRONYM_MIN}-${ACRONYM_MAX} characters` })
  }
  if (!ACRONYM_REGEX.test(normalized)) {
    errors.push({ field: 'acronym', message: 'Letters only, must be uppercase' })
  }
  return normalized
}

export function validateLevel(level: string | null | undefined, errors: ValidationError[]): DepartmentLevel | null {
  if (!level) {
    errors.push({ field: 'level', message: 'Level is required' })
    return null
  }
  const upper = level.toUpperCase() as DepartmentLevel
  if (!DEPARTMENT_LEVELS.includes(upper)) {
    errors.push({ field: 'level', message: `Must be one of: ${DEPARTMENT_LEVELS.join(', ')}` })
    return null
  }
  return upper
}

export async function isLevelRecord(departmentId: string): Promise<boolean> {
  const dept = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { name: true, level: true, parentId: true },
  })
  if (!dept) return false
  if (dept.parentId === null) return true
  return LEVEL_RECORD_NAMES.includes(dept.name) && dept.level === dept.name
}

export async function checkCircularReference(departmentId: string, newParentId: string | null): Promise<boolean> {
  if (!newParentId) return false
  if (newParentId === departmentId) return true
  let current: string | null = newParentId
  const visited = new Set<string>()
  while (current) {
    if (visited.has(current)) return true
    visited.add(current)
    if (current === departmentId) return true
    const parent: { parentId: string | null } | null = await prisma.department.findUnique({
      where: { id: current },
      select: { parentId: true },
    })
    current = parent?.parentId ?? null
  }
  return false
}

export async function hasChildren(departmentId: string): Promise<boolean> {
  const count = await prisma.department.count({
    where: { parentId: departmentId, status: { in: ['ACTIVE', 'INACTIVE'] } },
  })
  return count > 0
}

export async function isServiceLevel(departmentId: string): Promise<boolean> {
  const dept = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { level: true },
  })
  return dept?.level === 'SERVICE'
}

export async function validateCreate(input: {
  name: string
  shortName?: string | null
  acronym?: string | null
  level?: string | null
  parentId?: string | null
}) {
  const errors: ValidationError[] = []
  const cleanName = validateName(input.name, errors)
  const cleanShort = validateShortName(input.shortName, errors)
  const cleanAcronym = validateAcronym(input.acronym, errors)
  const cleanLevel = validateLevel(input.level, errors)

  if (cleanAcronym) {
    const existing = await prisma.department.findUnique({ where: { acronym: cleanAcronym } })
    if (existing) errors.push({ field: 'acronym', message: 'Acronym already in use' })
  }
  if (cleanName) {
    const existing = await prisma.department.findUnique({ where: { name: cleanName } })
    if (existing) errors.push({ field: 'name', message: 'Department name already exists' })
  }
  if (cleanName && LEVEL_RECORD_NAMES.includes(cleanName)) {
    errors.push({ field: 'name', message: 'Cannot use reserved Level name' })
  }
  if (input.parentId) {
    const parent = await prisma.department.findUnique({ where: { id: input.parentId }, select: { id: true } })
    if (!parent) errors.push({ field: 'parentId', message: 'Parent department not found' })
  }

  if (errors.length > 0) throw new DepartmentValidationError(errors)
  return { name: cleanName, shortName: cleanShort, acronym: cleanAcronym, level: cleanLevel, parentId: input.parentId ?? null }
}

export async function validateUpdate(id: string, input: {
  name?: string
  shortName?: string | null
  acronym?: string | null
  level?: string | null
  parentId?: string | null
}) {
  const errors: ValidationError[] = []
  const existing = await prisma.department.findUnique({ where: { id } })
  if (!existing) throw new DepartmentValidationError([{ field: 'id', message: 'Department not found' }])

  const isLevel = await isLevelRecord(id)
  if (isLevel) {
    if (input.level && input.level.toUpperCase() !== existing.level) {
      errors.push({ field: 'level', message: 'Cannot change Level of a system Level record' })
    }
    if (input.parentId !== undefined && input.parentId !== null && input.parentId !== existing.parentId) {
      errors.push({ field: 'parentId', message: 'Cannot reassign parent of a system Level record' })
    }
  }

  let cleanName = existing.name
  if (input.name !== undefined) {
    cleanName = validateName(input.name, errors)
    if (cleanName !== existing.name) {
      const dup = await prisma.department.findUnique({ where: { name: cleanName } })
      if (dup) errors.push({ field: 'name', message: 'Department name already exists' })
    }
  }

  let cleanAcronym = existing.acronym
  if (input.acronym !== undefined) {
    cleanAcronym = validateAcronym(input.acronym, errors)
    if (cleanAcronym && cleanAcronym !== existing.acronym) {
      const dup = await prisma.department.findUnique({ where: { acronym: cleanAcronym } })
      if (dup) errors.push({ field: 'acronym', message: 'Acronym already in use' })
    }
  }

  const cleanShort = input.shortName !== undefined
    ? validateShortName(input.shortName, errors)
    : existing.shortName

  const cleanLevel = input.level !== undefined
    ? validateLevel(input.level, errors)
    : existing.level

  let finalParentId = existing.parentId
  if (input.parentId !== undefined) {
    if (input.parentId && (await checkCircularReference(id, input.parentId))) {
      errors.push({ field: 'parentId', message: 'Circular reference detected' })
    } else {
      finalParentId = input.parentId
    }
  }

  if (errors.length > 0) throw new DepartmentValidationError(errors)
  return {
    name: cleanName,
    shortName: cleanShort,
    acronym: cleanAcronym,
    level: cleanLevel,
    parentId: finalParentId,
  }
}
