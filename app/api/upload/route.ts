import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'
import { Readable } from 'stream'

let _rootFolderId: string | null = null

function getDriveAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  if (!email || !key) throw new Error('Google credentials not configured')
  return new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  })
}

async function getRootFolderId(drive: ReturnType<typeof google.drive>): Promise<string> {
  if (_rootFolderId) return _rootFolderId

  const configuredId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID

  if (configuredId) {
    try {
      await drive.files.get({
        fileId: configuredId,
        fields: 'id',
        supportsAllDrives: true,
      })
      _rootFolderId = configuredId
      return configuredId
    } catch {
      console.warn('[Upload] Configured folder not accessible, falling back to service account root')
    }
  }

  const rootFolderName = 'VAA Philippines - VA Documents'
  const existing = await drive.files.list({
    q: `'root' in parents and name = '${rootFolderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
    pageSize: 1,
  })

  if (existing.data.files?.length) {
    _rootFolderId = existing.data.files[0].id!
    return _rootFolderId
  }

  const created = await drive.files.create({
    requestBody: {
      name: rootFolderName,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  })

  if (!created.data.id) throw new Error('Failed to create root folder')
  _rootFolderId = created.data.id
  return _rootFolderId
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
  })

  if (!created.data.id) throw new Error('Failed to create folder')
  return created.data.id
}

export async function POST(req: NextRequest) {
  try {
    const auth = getDriveAuth()
    const drive = google.drive({ version: 'v3', auth })
    const rootId = await getRootFolderId(drive)

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const vaName = formData.get('vaName') as string
    const fieldName = formData.get('fieldName') as string
    const profileId = formData.get('profileId') as string

    if (!file || !vaName || !fieldName || !profileId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const folderName = `201 VA | ${vaName} - /Proof of Documents`
    const proofFolderId = await findOrCreateFolder(drive, rootId, folderName)

    const buffer = Buffer.from(await file.arrayBuffer())
    const cleanFileName = file.name.replace(/[^\w.-]/g, '_')

    const res = await drive.files.create({
      requestBody: {
        name: `${fieldName}_${cleanFileName}`,
        parents: [proofFolderId],
      },
      media: {
        mimeType: file.type || 'application/octet-stream',
        body: Readable.from(buffer),
      },
      fields: 'id, webViewLink',
    })

    if (!res.data.webViewLink) throw new Error('Upload failed')

    await prisma.userProfile.upsert({
      where: { userId: profileId },
      create: { userId: profileId, [fieldName]: res.data.webViewLink },
      update: { [fieldName]: res.data.webViewLink },
    })

    return NextResponse.json({
      success: true,
      url: res.data.webViewLink,
      field: fieldName,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upload failed'
    console.error('[Upload] Error:', message)
    return NextResponse.json({ error: message, stack: process.env.NODE_ENV === 'development' ? (e instanceof Error ? e.stack : undefined) : undefined }, { status: 500 })
  }
}
