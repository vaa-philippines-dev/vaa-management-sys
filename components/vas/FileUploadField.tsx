'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, Check, AlertCircle, FileText, X } from 'lucide-react'

export function FileUploadField({
  label,
  currentUrl,
  fieldName,
  vaName,
  profileId,
  onUploaded,
  accept = 'image/*,.pdf',
}: {
  label: string
  currentUrl: string | null
  fieldName: string
  vaName: string
  profileId: string
  onUploaded: (url: string) => void
  accept?: string
}) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadedUrl, setUploadedUrl] = useState(currentUrl)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setFileName(file.name)
    setUploading(true)
    setProgress(0)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('vaName', vaName)
    formData.append('fieldName', fieldName)
    formData.append('profileId', profileId)

    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      setUploading(false)
      if (xhr.status >= 200 && xhr.status < 300) {
        const res = JSON.parse(xhr.responseText)
        if (res.success) {
          setUploadedUrl(res.url)
          onUploaded(res.url)
          setProgress(100)
        } else {
          setError(res.error || 'Upload failed')
        }
      } else {
        setError('Upload failed')
      }
    })

    xhr.addEventListener('error', () => {
      setUploading(false)
      setError('Network error')
    })

    xhr.open('POST', '/api/upload')
    xhr.send(formData)
  }

  const clearFile = () => {
    setFileName(null)
    setProgress(0)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          disabled={uploading}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs h-8"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-3 w-3 mr-1" />
          {uploadedUrl ? 'Replace' : 'Upload'}
        </Button>
        {uploading ? (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="text-xs text-muted-foreground truncate">{fileName}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : uploadedUrl ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Check className="h-3 w-3 shrink-0 text-green-600" />
            <a
              href={uploadedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline truncate"
            >
              View uploaded file
            </a>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No file uploaded</span>
        )}
        {error && (
          <div className="flex items-center gap-1 text-red-600">
            <AlertCircle className="h-3 w-3" />
            <span className="text-xs">{error}</span>
            <button onClick={clearFile} className="ml-1"><X className="h-3 w-3" /></button>
          </div>
        )}
      </div>
    </div>
  )
}
