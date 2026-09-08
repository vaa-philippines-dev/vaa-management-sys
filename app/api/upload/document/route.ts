import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { Readable } from 'stream'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { requireAuth, VA_SENSITIVE_INFO_EDIT_ROLES } from '@/lib/auth'
import { getDriveAuth, getRootFolderId, findOrCreateFolder } from '@/lib/google/drive'
import { DocumentType } from '@/src/generated/prisma/enums'

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB
const DOCUMENT_TYPES = new Set<string>(Object.values(DocumentType))

// Generic multi-document upload for a VA's 201 file — unlike app/api/upload/route.ts
// (3 fixed slots written to UserProfile scalar columns), this writes typed VADocument
// rows so HR can attach arbitrary documents (valid ID, NBI clearance, etc.) beyond the
// fixed Passport/PhilHealth/Signed Contract set.
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    if (!VA_SENSITIVE_INFO_EDIT_ROLES.includes(user.systemRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const vaProfileId = formData.get('vaProfileId') as string
    const documentType = formData.get('documentType') as string
    const notes = ((formData.get('notes') as string) || '').trim() || null

    if (!file || !vaProfileId || !documentType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!DOCUMENT_TYPES.has(documentType)) {
      return NextResponse.json({ error: 'Invalid documentType' }, { status: 400 })
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 })
    }

    const va = await prisma.vAProfile.findUnique({
      where: { id: vaProfileId },
      select: { user: { select: { firstName: true, lastName: true } } },
    })
    if (!va) return NextResponse.json({ error: 'VA not found' }, { status: 404 })
    const vaName = `${va.user.firstName} ${va.user.lastName}`.trim()

    const auth = getDriveAuth()
    const drive = google.drive({ version: 'v3', auth })
    const rootId = await getRootFolderId(drive)
    const vaFolderId = await findOrCreateFolder(drive, rootId, `201 VA | ${vaName}`)
    const docFolderId = await findOrCreateFolder(drive, vaFolderId, 'Other')

    const buffer = Buffer.from(await file.arrayBuffer())
    const cleanFileName = file.name.replace(/[^\w.-]/g, '_')

    const res = await drive.files.create({
      requestBody: { name: cleanFileName, parents: [docFolderId] },
      media: { mimeType: file.type || 'application/octet-stream', body: Readable.from(buffer) },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    })
    if (!res.data.webViewLink) throw new Error('Upload failed')

    const doc = await prisma.vADocument.create({
      data: {
        vaProfileId,
        documentType: documentType as DocumentType,
        fileName: cleanFileName,
        googleDriveUrl: res.data.webViewLink,
        mimeType: file.type || null,
        fileSize: file.size,
        uploadedBy: user.id,
        notes,
      },
    })

    await logAudit({
      actorId: user.id,
      action: 'FILE_UPLOAD',
      entityType: 'VADocument',
      entityId: doc.id,
      after: { vaProfileId, documentType, fileName: cleanFileName, url: res.data.webViewLink },
      metadata: { vaName },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      id: doc.id,
      documentType: doc.documentType,
      fileName: doc.fileName,
      url: doc.googleDriveUrl,
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const message = e instanceof Error ? e.message : 'Upload failed'
    console.error('[Upload/Document] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
