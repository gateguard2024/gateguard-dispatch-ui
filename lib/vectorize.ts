/**
 * lib/vectorize.ts
 *
 * PDF manual → vector chunks pipeline.
 *
 * Flow:
 *   1. Fetch PDF from Supabase Storage (or any URL)
 *   2. Extract text page by page using pdf-parse
 *   3. Chunk text into ~400-token passages with overlap
 *   4. Embed each chunk with OpenAI text-embedding-3-small (1536 dims)
 *   5. Upsert into manual_chunks table
 *
 * Deps (add to package.json):
 *   npm install pdf-parse openai
 *   npm install --save-dev @types/pdf-parse
 */

import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

// ─── Constants ────────────────────────────────────────────────────────────────

const CHUNK_SIZE   = 400   // target tokens per chunk
const CHUNK_OVERLAP = 60   // overlap tokens between chunks
const EMBED_MODEL  = 'text-embedding-3-small'
const EMBED_BATCH  = 20    // embeddings per API call (max 2048)

// ─── Clients ──────────────────────────────────────────────────────────────────

function openai() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
}

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Text chunking ────────────────────────────────────────────────────────────

/**
 * Rough token estimator — ~4 chars per token for English text.
 * Good enough for chunking; we don't need exact counts.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Split text into overlapping chunks of ~CHUNK_SIZE tokens.
 * Tries to break on sentence/paragraph boundaries first.
 */
export function chunkText(text: string): string[] {
  // Normalize whitespace
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()

  // Split into paragraphs first
  const paragraphs = normalized.split(/\n\n+/)
  const chunks: string[] = []
  let current = ''
  let currentTokens = 0

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para)

    if (currentTokens + paraTokens > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.trim())
      // Overlap: keep last CHUNK_OVERLAP tokens worth of text
      const words = current.split(' ')
      const overlapWords = words.slice(-Math.floor(CHUNK_OVERLAP * 0.75))
      current = overlapWords.join(' ') + '\n\n' + para
      currentTokens = estimateTokens(current)
    } else {
      current = current ? current + '\n\n' + para : para
      currentTokens += paraTokens
    }
  }

  if (current.trim()) chunks.push(current.trim())
  return chunks.filter(c => c.length > 40) // drop micro-chunks
}

// ─── Section title extraction ─────────────────────────────────────────────────

/**
 * Try to extract a heading from the start of a chunk.
 * Headings are typically ALL CAPS or Title Case lines ≤ 80 chars.
 */
export function extractSectionTitle(chunk: string): string | null {
  const firstLine = chunk.split('\n')[0].trim()
  if (firstLine.length < 80 && (firstLine === firstLine.toUpperCase() || /^[A-Z]/.test(firstLine))) {
    return firstLine
  }
  return null
}

// ─── PDF text extraction ──────────────────────────────────────────────────────

export interface PageText {
  page:    number
  text:    string
}

export async function extractPdfText(pdfBuffer: Buffer): Promise<PageText[]> {
  // Dynamic import — pdf-parse is CJS, avoid top-level import issues with Turbopack
  const pdfParse = (await import('pdf-parse')).default
  const data = await pdfParse(pdfBuffer, {
    // Return per-page text via render_page callback
    pagerender: (pageData: any) => {
      return pageData.getTextContent().then((textContent: any) => {
        return textContent.items.map((item: any) => item.str).join(' ')
      })
    },
  })

  // pdf-parse puts all text in data.text; split by form-feed for pages
  const pages = data.text.split('\f')
  return pages.map((text, i) => ({ page: i + 1, text: text.trim() })).filter(p => p.text)
}

// ─── Embedding ────────────────────────────────────────────────────────────────

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const client = openai()
  const response = await client.embeddings.create({
    model: EMBED_MODEL,
    input: texts,
  })
  return response.data.map(d => d.embedding)
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export interface ProcessManualOptions {
  equipmentId: string
  manualUrl:   string
  pdfBuffer:   Buffer
  onProgress?: (msg: string) => void
}

export interface ProcessManualResult {
  chunksCreated: number
  pagesProcessed: number
}

export async function processManual(opts: ProcessManualOptions): Promise<ProcessManualResult> {
  const { equipmentId, manualUrl, pdfBuffer, onProgress } = opts
  const log = onProgress ?? ((m: string) => console.log('[vectorize]', m))
  const supabase = db()

  // 1. Extract text
  log('Extracting text from PDF…')
  const pages = await extractPdfText(pdfBuffer)
  log(`Extracted text from ${pages.length} pages`)

  // 2. Chunk all page text together (preserves cross-page context)
  const fullText = pages.map(p => p.text).join('\n\n')
  const rawChunks = chunkText(fullText)
  log(`Split into ${rawChunks.length} chunks`)

  // 3. Delete existing chunks for this equipment (re-processing a manual)
  await supabase
    .from('manual_chunks')
    .delete()
    .eq('equipment_id', equipmentId)
    .eq('manual_url', manualUrl)

  // 4. Embed in batches and insert
  let chunksCreated = 0

  for (let i = 0; i < rawChunks.length; i += EMBED_BATCH) {
    const batch = rawChunks.slice(i, i + EMBED_BATCH)
    log(`Embedding chunks ${i + 1}–${Math.min(i + EMBED_BATCH, rawChunks.length)} of ${rawChunks.length}…`)

    const embeddings = await embedBatch(batch)

    const rows = batch.map((content, j) => ({
      equipment_id:  equipmentId,
      manual_url:    manualUrl,
      chunk_index:   i + j,
      section_title: extractSectionTitle(content),
      content,
      embedding:     JSON.stringify(embeddings[j]), // Supabase JS expects stringified vector
      token_count:   estimateTokens(content),
    }))

    const { error } = await supabase.from('manual_chunks').insert(rows)
    if (error) throw new Error(`Insert failed at batch ${i}: ${error.message}`)

    chunksCreated += batch.length
  }

  // 5. Update equipment with manual URL
  await supabase
    .from('equipment')
    .update({ manual_url: manualUrl })
    .eq('id', equipmentId)

  log(`✅ Done — ${chunksCreated} chunks stored`)
  return { chunksCreated, pagesProcessed: pages.length }
}

// ─── Semantic search ──────────────────────────────────────────────────────────

export interface SearchResult {
  id:            string
  equipment_id:  string
  brand:         string
  model:         string
  category:      string
  manual_url:    string | null
  page_number:   number | null
  section_title: string | null
  content:       string
  similarity:    number
}

/**
 * Find the most relevant manual passages for a given query.
 *
 * @param query          Natural language problem description
 * @param equipmentId    Optional — restrict to a single device
 * @param matchCount     How many chunks to return (default 8)
 * @param threshold      Minimum similarity score 0–1 (default 0.45)
 */
export async function searchManuals(
  query:       string,
  equipmentId?: string,
  matchCount   = 8,
  threshold    = 0.45
): Promise<SearchResult[]> {
  const supabase = db()
  const [embedding] = await embedBatch([query])

  const { data, error } = await supabase.rpc('match_manual_chunks', {
    query_embedding:  embedding,
    match_threshold:  threshold,
    match_count:      matchCount,
    filter_equipment: equipmentId ?? null,
  })

  if (error) throw new Error(`Vector search failed: ${error.message}`)
  return (data ?? []) as SearchResult[]
}
