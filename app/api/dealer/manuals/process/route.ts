/**
 * POST /api/dealer/manuals/process
 *
 * Accepts a multipart form upload OR a Supabase Storage path,
 * runs it through the vectorize pipeline, and stores chunks.
 *
 * Body (multipart/form-data):
 *   equipment_id  string  — UUID from equipment table
 *   file          File    — PDF binary  (OR)
 *   manual_url    string  — public URL of already-uploaded PDF
 *
 * Returns: { chunksCreated, pagesProcessed }
 *
 * Auth: admin or dealer role only (enforced via Clerk publicMetadata)
 */

import { NextRequest, NextResponse } from 'next/server'
import { currentUser }               from '@clerk/nextjs/server'
import { createClient }              from '@supabase/supabase-js'
import { processManual }             from '@/lib/vectorize'

const ALLOWED_ROLES = new Set(['admin', 'dealer'])

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = user.publicMetadata?.role as string
  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: 'Forbidden — admin or dealer role required' }, { status: 403 })
  }

  try {
    const form        = await req.formData()
    const equipmentId = form.get('equipment_id') as string
    const manualUrl   = form.get('manual_url') as string | null
    const file        = form.get('file') as File | null

    if (!equipmentId) {
      return NextResponse.json({ error: 'equipment_id required' }, { status: 400 })
    }
    if (!file && !manualUrl) {
      return NextResponse.json({ error: 'Provide either file or manual_url' }, { status: 400 })
    }

    let pdfBuffer: Buffer
    let resolvedUrl: string

    if (file) {
      // Direct file upload — store in Supabase Storage then process
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const bytes     = await file.arrayBuffer()
      pdfBuffer       = Buffer.from(bytes)
      const storagePath = `${equipmentId}/${file.name.replace(/\s+/g, '-').toLowerCase()}`

      const { error: uploadErr } = await supabase.storage
        .from('manuals')
        .upload(storagePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        })

      if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`)

      const { data: urlData } = supabase.storage
        .from('manuals')
        .getPublicUrl(storagePath)

      resolvedUrl = urlData.publicUrl
    } else {
      // Fetch from provided URL
      const resp = await fetch(manualUrl!)
      if (!resp.ok) throw new Error(`Failed to fetch PDF: ${resp.status}`)
      pdfBuffer   = Buffer.from(await resp.arrayBuffer())
      resolvedUrl = manualUrl!
    }

    const result = await processManual({
      equipmentId,
      manualUrl: resolvedUrl,
      pdfBuffer,
    })

    return NextResponse.json({ success: true, ...result, manual_url: resolvedUrl })

  } catch (err: any) {
    console.error('[dealer/manuals/process]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
