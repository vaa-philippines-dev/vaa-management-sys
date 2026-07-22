'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { TableRow, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/inbox/ConfirmDialog'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { deleteClient } from '@/app/(dashboard)/clients/actions'
import { CLIENT_PLATFORM_META, CLIENT_STATUS_LABEL, CLIENT_STATUS_TONE } from '@/lib/clients/display'
import { ClientNameEditor } from '@/components/clients/ClientNameEditor'
import { ClientEditModal, type ClientEditData } from '@/components/clients/ClientEditModal'

export type ClientAdminData = ClientEditData & {
  department: { id: string; name: string } | null
  manager: { id: string; firstName: string; lastName: string | null; email: string } | null
  assignmentCount: number
}

export function ClientAdminRow({
  client,
  departments,
  managers,
  skills,
  canEdit,
}: {
  client: ClientAdminData
  departments: { id: string; name: string }[]
  managers: { id: string; firstName: string; lastName: string | null; email: string }[]
  skills: string[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    setConfirmDeleteOpen(false)
    startTransition(async () => {
      try {
        await deleteClient(client.id)
        toast.success(`"${client.name}" deleted`)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete client')
      }
    })
  }

  const managerLabel = client.manager
    ? [client.manager.firstName, client.manager.lastName].filter(Boolean).join(' ') || client.manager.email
    : null

  return (
    <>
      <TableRow>
        <TableCell className="px-3 py-2">
          {canEdit ? (
            <ClientNameEditor clientId={client.id} name={client.name} />
          ) : (
            <span className="font-medium">{client.name}</span>
          )}
        </TableCell>
        <TableCell className="px-3 py-2 hidden md:table-cell">
          {client.department ? (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5">{client.department.name}</Badge>
          ) : (
            <span className="text-muted-foreground/50">—</span>
          )}
        </TableCell>
        <TableCell className="px-3 py-2">
          <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${CLIENT_PLATFORM_META[client.platform]?.color ?? ''}`}>
            {CLIENT_PLATFORM_META[client.platform]?.label ?? client.platform}
          </Badge>
        </TableCell>
        <TableCell className="px-3 py-2">
          <StatusIndicator tone={client.onHold ? 'warning' : (CLIENT_STATUS_TONE[client.status] ?? 'neutral')}>
            {client.onHold ? 'On Hold' : (CLIENT_STATUS_LABEL[client.status] ?? client.status)}
          </StatusIndicator>
        </TableCell>
        <TableCell className="px-3 py-2 hidden lg:table-cell text-muted-foreground truncate max-w-[180px]">
          {client.contactEmail || client.contactName || <span className="text-muted-foreground/50">—</span>}
        </TableCell>
        <TableCell className="px-3 py-2 hidden lg:table-cell text-muted-foreground truncate max-w-[160px]">
          {managerLabel || <span className="text-muted-foreground/50">—</span>}
        </TableCell>
        <TableCell className="px-3 py-2 text-right text-muted-foreground">
          {client.assignmentCount}
        </TableCell>
        <TableCell className="px-3 py-2 w-0">
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`${client.name} options`}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setConfirmDeleteOpen(true)} disabled={isPending}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </TableCell>
      </TableRow>

      {editOpen && (
        <ClientEditModal
          client={client}
          departments={departments}
          managers={managers}
          skills={skills}
          open={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={`Delete "${client.name}"?`}
        description={
          client.assignmentCount > 0
            ? `This permanently deletes the client AND all ${client.assignmentCount} of its assignment${client.assignmentCount === 1 ? '' : 's'} (including their logged hours). This cannot be undone.`
            : 'This permanently removes the client. This cannot be undone.'
        }
        confirmLabel="Delete Client"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </>
  )
}
