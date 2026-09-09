'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { completeKpiCheck } from '@/app/(dashboard)/assignments/actions'

export function MarkKpiCheckDoneButton({ checkId }: { checkId: string }) {
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const router = useRouter()

  if (done) return null

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-6 text-[10px] px-2 gap-1"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          try {
            await completeKpiCheck(checkId)
            setDone(true)
            router.refresh()
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to mark done')
          }
        })
      }}
    >
      {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
      Mark Done
    </Button>
  )
}
