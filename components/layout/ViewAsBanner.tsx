'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/role-labels'
import { clearViewAsRole } from '@/app/(dashboard)/_view-as/actions'

export function ViewAsBanner({ role }: { role: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleExit = () => {
    startTransition(async () => {
      await clearViewAsRole()
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
      <Eye className="h-3.5 w-3.5" />
      <span>Viewing as {ROLE_LABELS[role] ?? role}</span>
      <button
        type="button"
        onClick={handleExit}
        disabled={isPending}
        className="font-semibold underline decoration-dotted hover:no-underline disabled:opacity-50"
      >
        Exit
      </button>
    </div>
  )
}
