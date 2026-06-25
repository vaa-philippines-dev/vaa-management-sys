'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function MonthlyReportControls({ currentMonth }: { currentMonth: string }) {
  const router = useRouter()

  const shift = (delta: number) => {
    const [y, m] = currentMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    router.push(`/reports?month=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" onClick={() => shift(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <input
        type="month"
        value={currentMonth}
        onChange={(e) => router.push(`/reports?month=${e.target.value}`)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      />
      <Button variant="outline" size="icon" onClick={() => shift(1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}