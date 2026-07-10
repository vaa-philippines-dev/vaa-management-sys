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
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
}

export type DriveFile = {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  size: string | null
  createdTime: string | null
}

let _listRootId: string | null = null

async function getListRootId(drive: ReturnType<typeof google.drive>): Promise<string | null> {
  if (_listRootId) return _listRootId

  const configuredId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID
  if (!configuredId) {
    console.warn('[Drive] GOOGLE_DRIVE_PARENT_FOLDER_ID not set')
    return null
  }

  try {
    await drive.files.get({ fileId: configuredId, fields: 'id', supportsAllDrives: true })
    _listRootId = configuredId
    return configuredId
  } catch {
    console.warn('[Drive] Configured folder not accessible')
    return null
  }
}

export async function listDriveFiles(): Promise<DriveFile[]> {
  const auth = getAuth()
  if (!auth) return []

  const drive = google.drive({ version: 'v3', auth })
  const parentId = await getListRootId(drive)
  if (!parentId) return []

  const res = await drive.files.list({
    q: `'${parentId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, webViewLink, size, createdTime)',
    orderBy: 'name',
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
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

  const drive = google.drive({ version: 'v3', auth })
  const parentId = await getListRootId(drive)

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
  const parentId = await getListRootId(drive)

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

export async function makeFilePublic(
  drive: ReturnType<typeof google.drive>,
  fileId: string
): Promise<void> {
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  })
}

export function toDirectImageUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`
}
