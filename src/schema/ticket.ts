import { z } from 'zod'

// ── ticket ingestion (widget → /api/ticket) ──────────────────────

export const TicketSubmitSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  page_url: z.string().url().max(2048).optional(),
  user_agent: z.string().max(512).optional(),
  email: z.string().email().max(254).optional().or(z.literal('')),
  // anti-bot: must be empty; real humans never fill it
  honeypot: z.string().max(0).optional().or(z.literal('')),
  // caller flags screenshot upload in step 2 so we hand back a pre-signed URL
  want_screenshot_upload: z.boolean().optional(),
  // Cloudflare Turnstile token. Optional in the schema so local
  // dev (TURNSTILE_SECRET unset) keeps working; the route handler
  // requires it whenever the secret is configured.
  turnstile_token: z.string().max(2048).optional().or(z.literal('')),
})
export type TicketSubmit = z.infer<typeof TicketSubmitSchema>

export const TicketSubmitResponseSchema = z.object({
  ticket_id: z.string(),
  workspace_state: z.enum(['pending', 'claimed']),
  // only present when want_screenshot_upload=true
  screenshot_upload_url: z.string().url().optional(),
  screenshot_key: z.string().optional(),
})
export type TicketSubmitResponse = z.infer<typeof TicketSubmitResponseSchema>

// ── classifications ──────────────────────────────────────────────

export const ClassificationKinds = ['bug', 'query', 'feature', 'spam'] as const
export const ClassificationKindSchema = z.enum(ClassificationKinds)
export type ClassificationKind = z.infer<typeof ClassificationKindSchema>

// LLM JSON-mode output (Gemma 4 response_format json_schema)
export const ClassificationResultSchema = z.object({
  primary_type: ClassificationKindSchema,
  secondary_types: z.array(ClassificationKindSchema).max(3).default([]),
  confidence: z.number().min(0).max(1),
  summary: z.string().max(80),
  suggested_title: z.string().max(100),
  reasoning: z.string().max(240),
})
export type ClassificationResult = z.infer<typeof ClassificationResultSchema>

// ── ticket status (admin) ────────────────────────────────────────

export const TicketStatuses = [
  'open',
  'planned',
  'in_progress',
  'completed',
  'closed',
] as const
export const TicketStatusSchema = z.enum(TicketStatuses)
export type TicketStatus = z.infer<typeof TicketStatusSchema>

export const TicketPatchSchema = z.object({
  status: TicketStatusSchema.optional(),
  classification: ClassificationKindSchema.optional(),
})
export type TicketPatch = z.infer<typeof TicketPatchSchema>
