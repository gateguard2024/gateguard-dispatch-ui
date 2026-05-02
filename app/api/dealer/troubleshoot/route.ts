/**
 * POST /api/dealer/troubleshoot
 *
 * AI-powered troubleshooting assistant grounded in real manual content.
 *
 * On each request the client sends the current state of the diagnostic session.
 * The API vector-searches the manual library for relevant passages, then asks
 * Claude to generate the next diagnostic step as a Y/N question (or resolution).
 *
 * Body:
 * {
 *   symptom:      string   — original problem description
 *   equipment_id: string?  — restrict search to one device
 *   history: [            — steps taken so far
 *     { question: string, answer: 'yes' | 'no' | string }
 *   ]
 * }
 *
 * Returns:
 * {
 *   type:       'question' | 'action' | 'resolved' | 'escalate'
 *   text:       string      — the question or instruction
 *   detail:     string?     — additional context from manual
 *   manual_ref: { url, page, section }?  — source citation
 *   session_id: string      — for logging
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { currentUser }               from '@clerk/nextjs/server'
import Anthropic                     from '@anthropic-ai/sdk'
import { searchManuals }             from '@/lib/vectorize'
import { createClient }              from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { symptom, equipment_id, history = [], session_id } = await req.json()

    if (!symptom) {
      return NextResponse.json({ error: 'symptom required' }, { status: 400 })
    }

    // ── 1. Build search query from symptom + recent history ──────────────────
    const recentAnswers = (history as any[])
      .slice(-3)
      .map((h: any) => `${h.question} → ${h.answer}`)
      .join('; ')

    const searchQuery = recentAnswers
      ? `${symptom}. ${recentAnswers}`
      : symptom

    // ── 2. Vector search manual library ──────────────────────────────────────
    const chunks = await searchManuals(searchQuery, equipment_id, 6, 0.40)

    // ── 3. Build context from retrieved chunks ────────────────────────────────
    const manualContext = chunks.length > 0
      ? chunks.map((c, i) =>
          `[Source ${i + 1}: ${c.brand} ${c.model} manual${c.page_number ? `, p.${c.page_number}` : ''}${c.section_title ? ` — ${c.section_title}` : ''}]\n${c.content}`
        ).join('\n\n---\n\n')
      : 'No specific manual content found — using general troubleshooting knowledge.'

    // ── 4. Build conversation history for Claude ──────────────────────────────
    const historyText = (history as any[]).length > 0
      ? '\n\nDiagnostic steps so far:\n' +
        (history as any[]).map((h: any, i: number) =>
          `Step ${i + 1}: "${h.question}" → ${h.answer}`
        ).join('\n')
      : ''

    // ── 5. Call Claude ────────────────────────────────────────────────────────
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const systemPrompt = `You are GateGuard's field troubleshooting assistant. You help dealers and technicians diagnose and fix equipment issues on-site at multifamily properties.

You have access to relevant passages from the actual install manuals. Use them to give accurate, specific guidance.

Your response MUST be valid JSON in exactly this format:
{
  "type": "question" | "action" | "resolved" | "escalate",
  "text": "The question to ask or instruction to give — clear, specific, jargon-appropriate for a field tech",
  "detail": "Optional: additional context, what to look for, expected normal values, etc.",
  "manual_ref": { "url": "string or null", "page": number or null, "section": "string or null" }
}

Types:
- "question": A yes/no diagnostic question ("Is the power LED on the control board illuminated?")
- "action": An instruction to perform ("Reset the limit switch: hold the Learn button for 6 seconds until the LED blinks 3 times")
- "resolved": The issue is identified and fixed
- "escalate": The issue requires factory support or replacement — explain why

Rules:
- Ask ONE clear yes/no question at a time — never compound questions
- Be specific: use exact LED colors, button names, wiring terminal labels from the manual
- Progress logically: power → wiring → settings → mechanical → replace
- If you cite a manual passage, include the manual_ref
- Keep "text" under 120 characters — it shows on a mobile screen in the field
- Put longer explanation in "detail" (optional, can be null)`

    const userPrompt = `Problem reported: "${symptom}"${historyText}

Relevant manual sections:
${manualContext}

Based on the diagnostic history and manual content, what is the next step?`

    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    })

    const rawText   = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error(`Claude returned no JSON: ${rawText.slice(0, 200)}`)

    const step = JSON.parse(jsonMatch[0])

    // Attach the best manual reference if Claude didn't provide one
    if (!step.manual_ref?.url && chunks[0]?.manual_url) {
      step.manual_ref = {
        url:     chunks[0].manual_url,
        page:    chunks[0].page_number,
        section: chunks[0].section_title,
      }
    }

    // ── 6. Log session to Supabase ────────────────────────────────────────────
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let newSessionId = session_id

    if (!session_id) {
      const { data } = await supabase
        .from('troubleshoot_sessions')
        .insert({
          equipment_id: equipment_id ?? null,
          user_id:      user.id,
          symptom,
          steps_taken:  [],
          chunks_used:  chunks.map(c => c.id),
        })
        .select('id')
        .single()
      newSessionId = data?.id
    } else {
      // Append current step
      await supabase.rpc('append_troubleshoot_step', {
        p_session_id: session_id,
        p_step:       JSON.stringify({ ...step, chunks_used: chunks.map(c => c.id) }),
      }).then(() => {})  // non-blocking, ignore errors
    }

    return NextResponse.json({ ...step, session_id: newSessionId })

  } catch (err: any) {
    console.error('[dealer/troubleshoot]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
