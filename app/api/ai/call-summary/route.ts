// app/api/ai/call-summary/route.ts
//
// Uses Claude Haiku to generate a concise call summary from a Twilio
// recording transcript or (if no transcript) from the recording URL.
//
// POST /api/ai/call-summary
// Body: {
//   callLogId:    string   — Supabase calls row ID to update
//   recordingUrl: string   — Twilio recording URL (.mp3)
//   transcript:   string?  — Pre-fetched transcript text (optional)
//   agentEmail:   string
// }

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic        from '@anthropic-ai/sdk';

export async function POST(request: Request) {
  try {
    const { callLogId, recordingUrl, transcript, agentEmail } = await request.json();

    if (!callLogId) {
      return NextResponse.json({ error: 'callLogId required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch the call record for context
    const { data: call } = await supabase
      .from('calls')
      .select('to_name, to_role, to_number, duration_seconds, outcome, agent_email, incident_id, patrol_id')
      .eq('id', callLogId)
      .single();

    const durationStr = call?.duration_seconds
      ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
      : 'unknown duration';

    const contextBlock = `
Call Details:
- Agent: ${agentEmail}
- Called: ${call?.to_name ?? 'Unknown'} (${call?.to_role ?? 'Unknown role'}) at ${call?.to_number}
- Outcome: ${call?.outcome}
- Duration: ${durationStr}
${transcript ? `\nTranscript:\n${transcript}` : `\nNo transcript available. Recording: ${recordingUrl}`}
    `.trim();

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: `You are a SOC dispatch assistant at GateGuard. Generate a concise call summary (3–5 sentences max) for the agent's log. Focus on: who was reached, key information exchanged, any actions agreed upon, and outcome. Be factual and professional.

${contextBlock}

Write the summary now:`,
        },
      ],
    });

    const summary = message.content[0].type === 'text'
      ? message.content[0].text.trim()
      : 'Summary unavailable.';

    // Save summary + transcript back to the calls row
    await supabase
      .from('calls')
      .update({
        ai_summary: summary,
        transcript: transcript ?? null,
      })
      .eq('id', callLogId);

    return NextResponse.json({ summary });
  } catch (err) {
    console.error('[ai/call-summary] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
