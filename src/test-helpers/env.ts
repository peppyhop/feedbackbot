// Minimal env stub for tests. Each test that imports `#/env` should
// vi.mock it to swap the real cloudflare:workers binding for one of
// these. Only fields actually read by the code under test need to
// be set — leave the rest undefined and Drizzle / Better Auth /
// helpers won't notice.
//
// Usage:
//   import { vi } from 'vitest'
//   import { makeTestEnv } from '#/test-helpers/env'
//   import { createTestDb } from '#/test-helpers/db'
//
//   const { db } = createTestDb()
//   vi.mock('#/env', () => ({ env: makeTestEnv({ DB: db.$client }) }))

import type { Env } from '#/env'

export function makeTestEnv(overrides: Partial<Env> = {}): Env {
  return {
    BETTER_AUTH_SECRET: 'test-secret-32-bytes-padding-padding',
    INTEGRATIONS_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    HMAC_SECRET_SEED: 'test-hmac-seed',
    DODO_PAYMENTS_ENV: 'test_mode',
    ...overrides,
  } as Env
}
