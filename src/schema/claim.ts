import { z } from 'zod'

export const WorkspaceStates = ['pending', 'claimed', 'suspended'] as const
export const WorkspaceStateSchema = z.enum(WorkspaceStates)
export type WorkspaceState = z.infer<typeof WorkspaceStateSchema>

export const WorkspaceStateResponseSchema = z.object({
  workspace: z.object({
    id: z.string(),
    domain: z.string(),
    state: WorkspaceStateSchema,
    ticket_count: z.number().int().nonnegative(),
    // Unix-ms of last successful Turnstile hostname add. NULL
    // when claimed but not yet synced — dashboard shows a
    // "widget setup pending" banner with a manual retry button.
    turnstile_synced_at: z.number().int().nullable(),
  }),
  claim_paths: z.object({
    email_match: z.object({
      available: z.boolean(),
      reason: z.string().optional(),
    }),
    dns_txt: z.object({
      record_name: z.string(),
      record_value: z.string(),
      verified: z.boolean(),
    }),
  }),
})
export type WorkspaceStateResponse = z.infer<typeof WorkspaceStateResponseSchema>

export const VerifyDomainSchema = z.object({
  domain: z.string().min(1).max(253),
})
export type VerifyDomainPayload = z.infer<typeof VerifyDomainSchema>

export const VerifyDomainResponseSchema = z.object({
  verified: z.boolean(),
  checked_record: z.string(),
  found_values: z.array(z.string()),
})
export type VerifyDomainResponse = z.infer<typeof VerifyDomainResponseSchema>
