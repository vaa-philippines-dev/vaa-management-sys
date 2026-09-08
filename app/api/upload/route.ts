import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'
import { Readable } from 'stream'
import { logAudit } from '@/lib/audit'
import { requireAuth } from '@/lib/auth'
import { getDriveAuth, getRootFolderId, findOrCreateFolder } from '@/lib/google/drive'

const HR_UPLOAD_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER', 'HR']

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

const DOC_TYPE_FOLDERS: Record<string, string> = {
  passportPhoto: 'Passport',
  philhealthPhoto: 'Philhealth',
  signedContract: 'Profile Picture',
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const vaName = formData.get('vaName') as string
    const fieldName = formData.get('fieldName') as string
    const profileId = formData.get('profileId') as string

    if (!file || !vaName || !fieldName || !profileId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!(fieldName in DOC_TYPE_FOLDERS)) {
      return NextResponse.json({ error: 'Invalid fieldName' }, { status: 400 })
    }

    const isSelf = user.userType === 'VIRTUAL_ASSISTANT' && user.id === profileId
    if (!isSelf && !HR_UPLOAD_ROLES.includes(user.systemRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 })
    }

    const auth = getDriveAuth()
    const drive = google.drive({ version: 'v3', auth })
    const rootId = await getRootFolderId(drive)

    const vaFolderId = await findOrCreateFolder(drive, rootId, `201 VA | ${vaName}`)
    const docFolderName = DOC_TYPE_FOLDERS[fieldName] || 'Other'
    const docFolderId = await findOrCreateFolder(drive, vaFolderId, docFolderName)

    const buffer = Buffer.from(await file.arrayBuffer())
    const cleanFileName = file.name.replace(/[^\w.-]/g, '_')

    const res = await drive.files.create({
      requestBody: {
        name: cleanFileName,
        parents: [docFolderId],
      },
      media: {
        mimeType: file.type || 'application/octet-stream',
        body: Readable.from(buffer),
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    })

    if (!res.data.webViewLink) throw new Error('Upload failed')

    await prisma.userProfile.upsert({
      where: { userId: profileId },
      create: { userId: profileId, [fieldName]: res.data.webViewLink },
      update: { [fieldName]: res.data.webViewLink },
    })

    await logAudit({
      actorId: user.id,
      action: 'FILE_UPLOAD',
      entityType: 'UserProfile',
      entityId: profileId,
      after: { fieldName, url: res.data.webViewLink, fileName: cleanFileName },
      metadata: { vaName, folder: docFolderName, fullPath: `201 VA | ${vaName}/${docFolderName}` },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      url: res.data.webViewLink,
      field: fieldName,
      folder: docFolderName,
      fullPath: `201 VA | ${vaName}/${docFolderName}`,
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const message = e instanceof Error ? e.message : 'Upload failed'
    console.error('[Upload] Error:', message)
    return NextResponse.json({ error: message, stack: process.env.NODE_ENV === 'development' ? (e instanceof Error ? e.stack : undefined) : undefined }, { status: 500 })
  }
}
