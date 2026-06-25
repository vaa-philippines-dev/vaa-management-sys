'use client'

import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { TaskStatusBadge, TaskPriorityBadge } from '@/components/tasks/TaskStatusBadge'
import { updateTaskStatus } from '@/app/(dashboard)/tasks/actions'
import Link from 'next/link'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type TaskRow = {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string | null
  department: string | null
  assignedTo: { user: { name: string | null; email: string } }
  assignedBy: { name: string | null; email: string }
  googleDriveFolder: string | null
}

const columnHelper = createColumnHelper<TaskRow>()

export function TaskDataGrid({
  tasks,
  currentUserRole,
}: {
  tasks: TaskRow[]
  currentUserRole: string
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const columns = useMemo(
    () => [
      columnHelper.accessor('title', {
        header: 'Title',
        cell: (info) => (
          <Link
            href={`/tasks/${info.row.original.id}`}
            className="font-medium hover:underline"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor((row) => row.assignedTo.user.name ?? row.assignedTo.user.email, {
        id: 'va',
        header: 'VA',
      }),
      columnHelper.accessor('priority', {
        header: 'Priority',
        cell: (info) => <TaskPriorityBadge priority={info.getValue()} />,
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => {
          const status = info.getValue()
          const taskId = info.row.original.id
          const canUpdate =
            currentUserRole === 'MANAGER' ||
            (currentUserRole === 'VA')

          if (!canUpdate) return <TaskStatusBadge status={status} />

          return (
            <Select
              defaultValue={status}
              onValueChange={(value: string | null) => { if (value) updateTaskStatus(taskId, value); }}
            >
              <SelectTrigger className="h-7 w-[130px]">
                <SelectValue>
                  <TaskStatusBadge status={status} />
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED'].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        },
      }),
      columnHelper.accessor('dueDate', {
        header: 'Due Date',
        cell: (info) => {
          const date = info.getValue()
          return date ? format(new Date(date), 'MMM dd, yyyy') : '-'
        },
      }),
      columnHelper.accessor('department', {
        header: 'Dept',
        cell: (info) => info.getValue() ?? '-',
      }),
    ],
    [currentUserRole]
  )

  const table = useReactTable({
    data: tasks,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Filter by title..."
          value={(table.getColumn('title')?.getFilterValue() as string) ?? ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => table.getColumn('title')?.setFilterValue(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="cursor-pointer"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? null}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                  No tasks found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
