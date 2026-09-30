import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MARKETPLACE_OPTIONS, TIMEZONE_OPTIONS } from '@/lib/clients/form-options'

const SELECT_CLASS = 'flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm'

// Older clients hold free-text timezones ("ET", "PST", "London") that match
// no preset — keep the stored value selectable rather than blanking it on
// the next save.
export function TimezoneSelect({ defaultValue }: { defaultValue?: string | null }) {
  const current = defaultValue?.trim() || ''
  const isLegacy = !!current && !TIMEZONE_OPTIONS.includes(current)
  return (
    <div className="space-y-1.5">
      <Label htmlFor="timezone">Timezone</Label>
      <select id="timezone" name="timezone" defaultValue={current} className={SELECT_CLASS}>
        <option value="">Select…</option>
        {isLegacy && <option value={current}>{current} (current)</option>}
        {TIMEZONE_OPTIONS.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}

// Checkbox group posting one `marketplace` value per tick plus a free-text
// `marketplaceOther`; buildFormDetails() joins them into one string.
export function MarketplacePicker({ defaultValue }: { defaultValue?: string | null }) {
  const saved = (defaultValue ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const other = saved.filter((s) => !MARKETPLACE_OPTIONS.includes(s)).join(', ')
  return (
    <div className="space-y-1.5 md:col-span-2">
      <Label>Marketplace/s</Label>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
        {MARKETPLACE_OPTIONS.map((o) => (
          <label key={o} className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" name="marketplace" value={o} defaultChecked={saved.includes(o)} className="h-3.5 w-3.5" />
            {o}
          </label>
        ))}
      </div>
      <Input name="marketplaceOther" defaultValue={other} placeholder="Other marketplace(s)" className="h-9" />
    </div>
  )
}
