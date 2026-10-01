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

const FOLDER_MIME = 'application/vnd.google-apps.folder'

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export type VADriveFiles = { folderUrl: string | null; files: DriveFile[] }

// Lists the files in one VA's own "201 VA | {vaName}" folder tree (the same
// folder the upload routes write into), one level of doc-type subfolders deep.
// Read-only: never creates the folder. Matches every folder with that name,
// since concurrent first uploads have produced duplicates.
export async function listVADriveFiles(vaName: string): Promise<VADriveFiles> {
  const empty: VADriveFiles = { folderUrl: null, files: [] }
  const auth = getAuth()
  if (!auth || !vaName.trim()) return empty

  const drive = google.drive({ version: 'v3', auth })
  const rootId = await getListRootId(drive)
  if (!rootId) return empty

  const listOpts = {
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    pageSize: 200,
  } as const

  const vaFolders = await drive.files.list({
    ...listOpts,
    q: `'${rootId}' in parents and name = '${escapeDriveQuery(`201 VA | ${vaName.trim()}`)}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: 'files(id, webViewLink)',
  })
  const vaFolderList = vaFolders.data.files ?? []
  if (vaFolderList.length === 0) return empty

  const inAny = (ids: string[]) => ids.map((id) => `'${id}' in parents`).join(' or ')
  const children = await drive.files.list({
    ...listOpts,
    q: `(${inAny(vaFolderList.map((f) => f.id!))}) and trashed = false`,
    fields: 'files(id, name, mimeType, webViewLink, size, createdTime)',
    orderBy: 'name',
  })
  const childList = children.data.files ?? []
  const subfolders = childList.filter((f) => f.mimeType === FOLDER_MIME)
  const subfolderName = new Map(subfolders.map((f) => [f.id!, f.name!]))

  const nested = subfolders.length
    ? (
        await drive.files.list({
          ...listOpts,
          q: `(${inAny(subfolders.map((f) => f.id!))}) and mimeType != '${FOLDER_MIME}' and trashed = false`,
          fields: 'files(id, name, mimeType, webViewLink, size, createdTime, parents)',
          orderBy: 'name',
        })
      ).data.files ?? []
    : []

  const toDriveFile = (f: (typeof childList)[number], prefix?: string): DriveFile => ({
    id: f.id!,
    name: prefix ? `${prefix} / ${f.name}` : f.name!,
    mimeType: f.mimeType!,
    webViewLink: f.webViewLink!,
    size: f.size || null,
    createdTime: f.createdTime || null,
  })

  const files = [
    ...childList.filter((f) => f.mimeType !== FOLDER_MIME).map((f) => toDriveFile(f)),
    ...nested.map((f) => toDriveFile(f, subfolderName.get(f.parents?.find((p) => subfolderName.has(p)) ?? ''))),
  ].sort((a, b) => a.name.localeCompare(b.name))

  return { folderUrl: vaFolderList[0].webViewLink ?? null, files }
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

// Strict variants (throw instead of degrading to null/[]) used by the upload
// routes — shared between app/api/upload/route.ts (fixed 201-file slots) and
// app/api/upload/document/route.ts (generic VADocument uploads) so both land
// in the same "201 VA | {vaName}/{folder}" Drive tree.
let _uploadRootFolderId: string | null = null

export function getDriveAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  if (!email || !key) throw new Error('Google credentials not configured')
  return new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
}

export async function getRootFolderId(drive: ReturnType<typeof google.drive>): Promise<string> {
  if (_uploadRootFolderId) return _uploadRootFolderId

  const configuredId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID
  if (!configuredId) {
    throw new Error('GOOGLE_DRIVE_PARENT_FOLDER_ID not configured — must point to a Shared Drive folder')
  }

  await drive.files.get({ fileId: configuredId, fields: 'id', supportsAllDrives: true })

  _uploadRootFolderId = configuredId
  return configuredId
}

export async function findOrCreateFolder(
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
