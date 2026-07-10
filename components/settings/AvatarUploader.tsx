'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 // 5 MB

type AvatarUploaderProps = {
  avatarUrl: string | null
  displayName: string
}

export function AvatarUploader({ avatarUrl, displayName }: AvatarUploaderProps) {
  const [preview, setPreview] = useState<string | null>(avatarUrl)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const initial = (displayName || 'U')[0].toUpperCase()

  const handleFile = async (file: File) => {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      toast.error('Please upload a JPEG, PNG, or WEBP image.')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('Image must be 5MB or smaller.')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload/avatar', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setPreview(data.url)
      toast.success('Profile picture updated.')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-medium text-primary-foreground overflow-hidden">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={displayName} className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </div>

      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Change picture'}
        </button>
        <p className="text-[11px] text-muted-foreground">JPEG, PNG, or WEBP. Max 5MB.</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
