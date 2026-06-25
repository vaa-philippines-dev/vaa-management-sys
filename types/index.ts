export type {
  UserRole,
  TaskPriority,
  TaskStatus,
} from "@/src/generated/prisma/enums"

export type TaskWithRelations = {
  id: string
  title: string
  description: string | null
  priority: string
  status: string
  dueDate: string | null
  googleDriveFolder: string | null
  department: string | null
  createdAt: string
  updatedAt: string
  assignedTo: {
    id: string
    user: { id: string; name: string | null; email: string }
  }
  assignedBy: { id: string; name: string | null; email: string }
}

export type VAProfileWithUser = {
  id: string
  userId: string
  phone: string | null
  hourlyRate: number | null
  notes: string | null
  isActive: boolean
  user: { id: string; name: string | null; email: string; department: string | null }
}

export type TaskFormData = {
  title: string
  description?: string
  priority: string
  status: string
  dueDate?: string
  assignedToId: string
}

export type VAFormData = {
  email: string
  name: string
  password: string
  department: string
  phone?: string
  hourlyRate?: number
  notes?: string
}
