import { google } from 'googleapis'
import { Readable } from 'stream'

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')

  if (!email || !key) {
    return null
  }

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key,
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })
}

function getParentFolderId(): string | null {
  return process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || null
}

export type DriveFile = {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  size: string | null
  createdTime: string | null
}

export async function listDriveFiles(folderId?: string): Promise<DriveFile[]> {
  const auth = getAuth()
  const parentId = folderId || getParentFolderId()

  if (!auth) {
    console.warn('[Drive] Google credentials not configured — returning empty list')
    return []
  }

  if (!parentId) {
    console.warn('[Drive] GOOGLE_DRIVE_PARENT_FOLDER_ID not set — returning empty list')
    return []
  }

  const drive = google.drive({ version: 'v3', auth })

  const res = await drive.files.list({
    q: `'${parentId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, webViewLink, size, createdTime)',
    orderBy: 'name',
    pageSize: 100,
  })

  return (res.data.files || []).map((f) => ({
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType!,
    webViewLink: f.webViewLink!,
    size: f.size || null,
    createdTime: f.createdTime || null,
  }))
}

export async function createDriveFolder(title: string): Promise<string> {
  const auth = getAuth()
  if (!auth) throw new Error('Google credentials not configured')

  const parentId = getParentFolderId()
  const drive = google.drive({ version: 'v3', auth })

  const res = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id, webViewLink',
  })

  if (!res.data.webViewLink) throw new Error('Failed to create folder')
  return res.data.webViewLink
}

export async function uploadFileToDrive(
  folderUrl: string | null,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const auth = getAuth()
  if (!auth) throw new Error('Google credentials not configured')

  const drive = google.drive({ version: 'v3', auth })
  const folderId = folderUrl?.split('/').pop() ?? undefined
  const parentId = folderId || getParentFolderId()

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: parentId ? [parentId] : undefined,
    },
    media: {
      mimeType,
      body: Readable.from(fileBuffer),
    },
    fields: 'id, webViewLink',
  })

  if (!res.data.webViewLink) throw new Error('Failed to upload file')
  return res.data.webViewLink
}
