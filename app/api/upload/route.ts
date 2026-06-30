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

const DOC_TYPE_FOLDERS: Record<string, string> = {
  passportPhoto: 'Passport',
  philhealthPhoto: 'Philhealth',
  signedContract: 'Profile Picture',
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

    return NextResponse.json({
      success: true,
      url: res.data.webViewLink,
      field: fieldName,
      folder: docFolderName,
      fullPath: `201 VA | ${vaName}/${docFolderName}`,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upload failed'
    console.error('[Upload] Error:', message)
    return NextResponse.json({ error: message, stack: process.env.NODE_ENV === 'development' ? (e instanceof Error ? e.stack : undefined) : undefined }, { status: 500 })
  }
}
