import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { requireSuperAdmin } from '@/lib/auth'

function getDriveAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  if (!email || !key) throw new Error('Google credentials not configured')
  return new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
}

export async function GET() {
  try {
    await requireSuperAdmin()

    const auth = getDriveAuth()
    const drive = google.drive({ version: 'v3', auth })

    const sharedDrives = await drive.drives.list({ pageSize: 50 })
    const targetId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID

    let parentContents: any = { tried: targetId, items: [] }
    let parentMeta: any = null
    if (targetId) {
      try {
        const r = await drive.files.get({
          fileId: targetId,
          fields: 'id, name, mimeType, driveId, parents, owners, webViewLink',
          supportsAllDrives: true,
        })
        parentMeta = r.data
        const list = await drive.files.list({
          q: `'${targetId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name, createdTime, webViewLink)',
          pageSize: 50,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        })
        parentContents.items = list.data.files || []
        parentContents.count = parentContents.items.length
      } catch (e) {
        parentContents.error = e instanceof Error ? e.message : String(e)
      }
    }

    const duplicatesByName: Record<string, number> = {}
    for (const f of parentContents.items) {
      const n = (f.name || '').trim()
      duplicatesByName[n] = (duplicatesByName[n] || 0) + 1
    }
    const duplicates = Object.entries(duplicatesByName)
      .filter(([, c]) => c > 1)
      .map(([name, count]) => ({ name, count }))

    return NextResponse.json({
      serviceAccount: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      sharedDrives: sharedDrives.data.drives?.map((d) => ({ id: d.id, name: d.name })) || [],
      parentFolder: parentMeta,
      parentFolderChildren: parentContents.items,
      childCount: parentContents.count,
      duplicateFolderNames: duplicates,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
