import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { Readable } from 'stream'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { requireAuth } from '@/lib/auth'
import { makeFilePublic, toDirectImageUrl } from '@/lib/google/drive'

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 // 5 MB

let _rootFolderId: string | null = null

function getDriveAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  if (!email || !key) throw new Error('Google credentials not configured')
  return new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
}

async function getRootFolderId(drive: ReturnType<typeof google.drive>): Promise<string> {
  if (_rootFolderId) return _rootFolderId

  const configuredId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID
  if (!configuredId) {
    throw new Error('GOOGLE_DRIVE_PARENT_FOLDER_ID not configured — must point to a Shared Drive folder')
  }

  await drive.files.get({
    fileId: configuredId,
    fields: 'id',
    supportsAllDrives: true,
  })

  _rootFolderId = configuredId
  return configuredId
}

async function findOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  parentId: string,
  folderName: string
): Promise<string> {
  const existing = await drive.files.list({
    q: `'${parentId}' in parents and name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
    pageSize: 1,
    supportsAllDrives: true,
  })

  if (existing.data.files?.length) {
    return existing.data.files[0].id!
  }

  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  })

  if (!created.data.id) throw new Error('Failed to create folder')
  return created.data.id
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
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

    const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
    const userFolderId = await findOrCreateFolder(drive, rootId, `201 VA | ${displayName}`)
    const picFolderId = await findOrCreateFolder(drive, userFolderId, 'Profile Picture')

    const buffer = Buffer.from(await file.arrayBuffer())
    const cleanFileName = file.name.replace(/[^\w.-]/g, '_')

    const res = await drive.files.create({
      requestBody: {
        name: cleanFileName,
        parents: [picFolderId],
      },
      media: {
        mimeType: file.type || 'application/octet-stream',
        body: Readable.from(buffer),
      },
      fields: 'id',
      supportsAllDrives: true,
    })

    if (!res.data.id) throw new Error('Upload failed')

    await makeFilePublic(drive, res.data.id)
    const directUrl = toDirectImageUrl(res.data.id)

    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: directUrl },
    })

    await logAudit({
      actorId: user.id,
      action: 'FILE_UPLOAD',
      entityType: 'User',
      entityId: user.id,
      after: { avatarUrl: directUrl, fileName: cleanFileName },
    }).catch(() => {})

    revalidatePath('/', 'layout')

    return NextResponse.json({ success: true, url: directUrl })
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const message = e instanceof Error ? e.message : 'Upload failed'
    console.error('[Avatar Upload] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
