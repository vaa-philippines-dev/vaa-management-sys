/**
 * Google Drive mock — stores folders and files locally on disk.
 * Replace this file with the real `lib/google/drive.ts` (using googleapis SDK)
 * when your company grants Google API access.
 *
 * Folder structure:
 *   .google-mock/
 *     folders.json          — mapping of folder IDs → metadata
 *     files.json            — mapping of file IDs → metadata
 *     storage/              — uploaded file binaries
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'

const MOCK_ROOT = path.join(process.cwd(), '.google-mock')
const FOLDERS_DB = path.join(MOCK_ROOT, 'folders.json')
const FILES_DB = path.join(MOCK_ROOT, 'files.json')
const STORAGE_DIR = path.join(MOCK_ROOT, 'storage')

type MockFolder = {
  id: string
  name: string
  webViewLink: string
  createdAt: string
}

type MockFile = {
  id: string
  name: string
  folderId: string | null
  webViewLink: string
  localPath: string
  mimeType: string
  size: number
  createdAt: string
}

function ensureDb() {
  if (!fs.existsSync(MOCK_ROOT)) fs.mkdirSync(MOCK_ROOT, { recursive: true })
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true })
  if (!fs.existsSync(FOLDERS_DB)) fs.writeFileSync(FOLDERS_DB, '[]', 'utf-8')
  if (!fs.existsSync(FILES_DB)) fs.writeFileSync(FILES_DB, '[]', 'utf-8')
}

function readFolders(): MockFolder[] {
  ensureDb()
  return JSON.parse(fs.readFileSync(FOLDERS_DB, 'utf-8'))
}

function writeFolders(folders: MockFolder[]) {
  fs.writeFileSync(FOLDERS_DB, JSON.stringify(folders, null, 2))
}

function readFiles(): MockFile[] {
  ensureDb()
  return JSON.parse(fs.readFileSync(FILES_DB, 'utf-8'))
}

function writeFiles(files: MockFile[]) {
  fs.writeFileSync(FILES_DB, JSON.stringify(files, null, 2))
}

export async function createDriveFolder(title: string): Promise<string> {
  const folders = readFolders()
  const id = `mock-folder-${randomUUID().slice(0, 8)}`
  const folder: MockFolder = {
    id,
    name: title,
    webViewLink: `https://drive.google.com/drive/folders/${id}`,
    createdAt: new Date().toISOString(),
  }
  folders.push(folder)
  writeFolders(folders)
  console.log(`[Mock Drive] Created folder: "${title}" -> ${folder.webViewLink}`)
  return folder.webViewLink
}

export async function uploadFileToDrive(
  folderUrl: string | null,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  ensureDb()
  const folderId = folderUrl?.split('/').pop() ?? null
  const id = `mock-file-${randomUUID().slice(0, 8)}`
  const localFileName = `${id}-${fileName}`
  const localPath = path.join(STORAGE_DIR, localFileName)

  fs.writeFileSync(localPath, fileBuffer)

  const files = readFiles()
  const file: MockFile = {
    id,
    name: fileName,
    folderId,
    webViewLink: `https://drive.google.com/file/d/${id}/view`,
    localPath,
    mimeType,
    size: fileBuffer.length,
    createdAt: new Date().toISOString(),
  }
  files.push(file)
  writeFiles(files)

  console.log(`[Mock Drive] Uploaded: "${fileName}" (${(fileBuffer.length / 1024).toFixed(1)} KB) -> ${file.webViewLink}`)
  return file.webViewLink
}

export function listMockFolders(): MockFolder[] {
  return readFolders()
}

export function listMockFiles(): MockFile[] {
  return readFiles()
}
