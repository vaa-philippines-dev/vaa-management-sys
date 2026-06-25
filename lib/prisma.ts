/**
 * In-memory Prisma mock for development without a database.
 * Drop-in replacement for `@/lib/prisma` when DATABASE_URL is not set.
 *
 * Supports basic CRUD operations used by the app so the UI works end-to-end.
 */

import { randomUUID } from 'node:crypto'

// ── Types ──────────────────────────────────────────────────────────────

type User = {
  id: string
  email: string
  name: string | null
  role: string
  department: string | null
  avatarUrl: string | null
  createdAt: Date
  updatedAt: Date
}

type VAProfile = {
  id: string
  userId: string
  phone: string | null
  hourlyRate: number | null
  notes: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  user: User | null
}

type Task = {
  id: string
  title: string
  description: string | null
  priority: string
  status: string
  dueDate: Date | null
  googleDriveFolder: string | null
  department: string | null
  createdAt: Date
  updatedAt: Date
  assignedToId: string
  assignedById: string
  // Populated on include
  assignedTo: (VAProfile & { user: User }) | null
  assignedBy: User | null
}

// ── In-memory store ────────────────────────────────────────────────────

const users: User[] = []
const vaProfiles: VAProfile[] = []
const tasks: Task[] = []

// Seed some demo data so pages don't show empty
function seedDemoData() {
  if (users.length > 0) return

  const manager: User = { id: 'mock-manager-1', email: 'manager@example.com', name: 'Alice Manager', role: 'MANAGER', department: 'Editorial', avatarUrl: null, createdAt: new Date(), updatedAt: new Date() }
  users.push(manager)

  const va1User: User = { id: 'mock-va-user-1', email: 'va1@example.com', name: 'Bob Assistant', role: 'VA', department: 'Editorial', avatarUrl: null, createdAt: new Date(), updatedAt: new Date() }
  users.push(va1User)
  const va1: VAProfile = { id: 'mock-va-1', userId: va1User.id, phone: '+1-555-0101', hourlyRate: 25, notes: 'Content writing', isActive: true, createdAt: new Date(), updatedAt: new Date(), user: va1User }
  vaProfiles.push(va1)

  const va2User: User = { id: 'mock-va-user-2', email: 'va2@example.com', name: 'Carol Helper', role: 'VA', department: 'Editorial', avatarUrl: null, createdAt: new Date(), updatedAt: new Date() }
  users.push(va2User)
  const va2: VAProfile = { id: 'mock-va-2', userId: va2User.id, phone: '+1-555-0102', hourlyRate: 30, notes: 'Research & data entry', isActive: true, createdAt: new Date(), updatedAt: new Date(), user: va2User }
  vaProfiles.push(va2)

  const sampleTaskData = [
    { title: 'Draft weekly newsletter', desc: 'Write and format the weekly newsletter.', priority: 'HIGH', status: 'IN_PROGRESS', due: new Date('2026-07-01') },
    { title: 'Research competitor blogs', desc: 'Compile top 10 competitor blogs.', priority: 'MEDIUM', status: 'TODO', due: new Date('2026-06-28') },
    { title: 'Update social media calendar', desc: 'Plan next month posts.', priority: 'LOW', status: 'BACKLOG', due: null },
    { title: 'Proofread Q3 report', desc: 'Review grammar and formatting.', priority: 'URGENT', status: 'REVIEW', due: new Date('2026-06-26') },
    { title: 'Organize Drive files', desc: 'Clean up shared Drive folder.', priority: 'LOW', status: 'DONE', due: new Date('2026-06-20') },
  ]

  sampleTaskData.forEach((t, i) => {
    const va = i % 2 === 0 ? va1 : va2
    tasks.push({
      id: `mock-task-${i}`,
      title: t.title,
      description: t.desc,
      priority: t.priority,
      status: t.status,
      dueDate: t.due,
      googleDriveFolder: null,
      department: va.user!.department,
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedToId: va.id,
      assignedById: manager.id,
      assignedTo: { ...va, user: va.user! },
      assignedBy: manager,
    })
  })
}

seedDemoData()

// Wait helper to simulate async DB call
const delay = (ms = 5) => new Promise((r) => setTimeout(r, ms))

// ── Exported query helpers (match Prisma API shape) ────────────────────

export const prisma = {
  user: {
    findUnique: async (args: { where: { email?: string; id?: string }; include?: { vaProfile?: boolean } }) => {
      await delay()
      const u = users.find((u) => (args.where.email && u.email === args.where.email) || (args.where.id && u.id === args.where.id)) ?? null
      if (!u) return null
      return includeVa(u, args.include?.vaProfile)
    },
    update: async (args: { where: { id: string }; data: any }) => {
      await delay()
      const idx = users.findIndex((u) => u.id === args.where.id)
      if (idx === -1) throw new Error('User not found')
      users[idx] = { ...users[idx], ...args.data, updatedAt: new Date() }
      return users[idx]
    },
    create: async (args: { data: any }) => {
      await delay()
      const u: User = { id: args.data.id || `mock-user-${randomUUID().slice(0, 8)}`, email: args.data.email, name: args.data.name ?? null, role: args.data.role, department: args.data.department ?? null, avatarUrl: null, createdAt: new Date(), updatedAt: new Date() }
      users.push(u)
      if (args.data.vaProfile?.create) {
        const vp: VAProfile = { id: `mock-va-${randomUUID().slice(0, 8)}`, userId: u.id, phone: args.data.vaProfile.create.phone ?? null, hourlyRate: args.data.vaProfile.create.hourlyRate ?? null, notes: args.data.vaProfile.create.notes ?? null, isActive: true, createdAt: new Date(), updatedAt: new Date(), user: u }
        vaProfiles.push(vp)
      }
      return u
    },
    upsert: async (args: { where: { email: string }; update: any; create: any }) => {
      await delay()
      const existing = users.find((u) => u.email === args.where.email)
      if (existing) {
        Object.assign(existing, args.update, { updatedAt: new Date() })
        return includeVa(existing, true)
      }
      return prisma.user.create({ data: args.create, include: { vaProfile: true } })
    },
    findMany: async (args?: { where?: any; include?: any; orderBy?: any }) => {
      await delay()
      let result = [...users]
      if (args?.where?.department) result = result.filter((u) => u.department === args.where.department)
      return result.map((u) => includeVa(u, args?.include?.vaProfile === true))
    },
  },

  vAProfile: {
    findUnique: async (args: { where: { id: string }; include?: { user?: boolean; tasks?: any } }) => {
      await delay()
      const vp = vaProfiles.find((v) => v.id === args.where.id) ?? null
      if (!vp) return null
      if (args.include?.user) vp.user = users.find((u) => u.id === vp.userId) ?? null
      return vp
    },
    findMany: async (args?: { where?: any; include?: any; orderBy?: any }) => {
      await delay()
      let result = [...vaProfiles]
      if (args?.where?.user?.department) result = result.filter((v) => users.find((u) => u.id === v.userId)?.department === args.where.user.department)
      if (args?.where?.user?.role) result = result.filter((v) => users.find((u) => u.id === v.userId)?.role === args.where.user.role)
      if (args?.where?.isActive !== undefined) result = result.filter((v) => v.isActive === args.where.isActive)
      result.forEach((v) => {
        if (args?.include?.user) v.user = users.find((u) => u.id === v.userId) ?? null
      })
      return result
    },
    update: async (args: { where: { id: string }; data: any }) => {
      await delay()
      const idx = vaProfiles.findIndex((v) => v.id === args.where.id)
      if (idx === -1) throw new Error('VAProfile not found')
      vaProfiles[idx] = { ...vaProfiles[idx], ...args.data, updatedAt: new Date() }
      return vaProfiles[idx]
    },
  },

  task: {
    findUnique: async (args: { where: { id: string }; include?: any }) => {
      await delay()
      const t = tasks.find((t) => t.id === args.where.id) ?? null
      if (!t) return null
      return populateTask(t)
    },
    findMany: async (args?: { where?: any; include?: any; orderBy?: any }) => {
      await delay()
      let result = [...tasks]
      if (args?.where?.assignedTo?.userId) result = result.filter((t) => {
        const vp = vaProfiles.find((v) => v.id === t.assignedToId)
        return vp?.userId === args.where.assignedTo.userId
      })
      if (args?.where?.department) result = result.filter((t) => t.department === args.where.department)
      return result.map((t) => populateTask(t))
    },
    create: async (args: { data: any }) => {
      await delay()
      const t: Task = { id: `mock-task-${randomUUID().slice(0, 8)}`, title: args.data.title, description: args.data.description ?? null, priority: args.data.priority ?? 'MEDIUM', status: args.data.status ?? 'TODO', dueDate: args.data.dueDate ?? null, googleDriveFolder: args.data.googleDriveFolder ?? null, department: args.data.department ?? null, createdAt: new Date(), updatedAt: new Date(), assignedToId: args.data.assignedToId, assignedById: args.data.assignedById, assignedTo: null, assignedBy: null }
      tasks.push(t)
      return populateTask(t)
    },
    update: async (args: { where: { id: string }; data: any }) => {
      await delay()
      const idx = tasks.findIndex((t) => t.id === args.where.id)
      if (idx === -1) throw new Error('Task not found')
      tasks[idx] = { ...tasks[idx], ...args.data, updatedAt: new Date() }
      return populateTask(tasks[idx])
    },
    delete: async (args: { where: { id: string } }) => {
      await delay()
      const idx = tasks.findIndex((t) => t.id === args.where.id)
      if (idx === -1) throw new Error('Task not found')
      const [deleted] = tasks.splice(idx, 1)
      return deleted
    },
  },
}

// ── Helpers ────────────────────────────────────────────────────────────

function includeVa(u: User, includeVa?: boolean) {
  if (!includeVa) return u as any
  const vp = vaProfiles.find((v) => v.userId === u.id) ?? null
  return { ...u, vaProfile: vp }
}

function populateTask(t: Task) {
  const vp = vaProfiles.find((v) => v.id === t.assignedToId) ?? null
  const u = users.find((u) => u.id === t.assignedById) ?? null
  const vaUser = vp ? (users.find((u) => u.id === vp.userId) ?? null) : null
  return { ...t, assignedTo: vp ? { ...vp, user: vaUser } : null, assignedBy: u }
}
