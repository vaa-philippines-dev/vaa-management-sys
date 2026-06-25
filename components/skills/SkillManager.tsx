'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, X } from 'lucide-react'
import { createSkill, deleteSkill } from '@/app/(dashboard)/skills/actions'

type Category = 'AMAZON' | 'WALMART' | 'TIKTOK_SHOP' | 'SHOPIFY' | 'GENERAL'

const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  AMAZON: { label: 'Amazon Services', color: 'bg-orange-500/15 text-orange-700 border-orange-500/20' },
  WALMART: { label: 'Walmart Services', color: 'bg-blue-500/15 text-blue-700 border-blue-500/20' },
  TIKTOK_SHOP: { label: 'TikTok Shop', color: 'bg-pink-500/15 text-pink-700 border-pink-500/20' },
  SHOPIFY: { label: 'Shopify', color: 'bg-green-500/15 text-green-700 border-green-500/20' },
  GENERAL: { label: 'General Services', color: 'bg-gray-500/15 text-gray-700 border-gray-500/20' },
}

const CATEGORY_ORDER: Category[] = ['AMAZON', 'WALMART', 'TIKTOK_SHOP', 'SHOPIFY', 'GENERAL']

export function SkillManager({
  skills,
}: {
  skills: { id: string; name: string; category: string; vaCount: number }[]
}) {
  const byCategory = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: skills.filter((s) => s.category === cat),
  }))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add a New Service</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createSkill} className="flex gap-2 flex-wrap">
            <Input name="name" placeholder="Service name" required className="flex-1 min-w-[200px]" />
            <select
              name="category"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              defaultValue="GENERAL"
            >
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>{CATEGORY_META[c].label}</option>
              ))}
            </select>
            <Button type="submit">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {byCategory.map(({ category, items }) => (
          <Card key={category}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{CATEGORY_META[category as Category].label}</CardTitle>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No services in this category.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {items.map((s) => (
                    <div
                      key={s.id}
                      className={`flex items-center gap-1 rounded-full border pl-3 pr-1 py-1 ${CATEGORY_META[category as Category].color}`}
                    >
                      <span className="text-xs font-medium">{s.name}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        {s.vaCount}
                      </Badge>
                      <form action={deleteSkill.bind(null, s.id)}>
                        <button
                          type="submit"
                          className="ml-1 rounded-full p-1 hover:bg-black/10"
                          aria-label={`Delete ${s.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}