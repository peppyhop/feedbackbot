// Vitest global setup. Wired via vitest.config.ts > test.setupFiles.
//
// 1. Loads .env.local so tests that need DODO_PAYMENTS_API_KEY (the
//    real-API contract test, primarily) can read it from process.env.
//    CI passes the same secret as a step env var so it's already in
//    process.env there — dotenv is a no-op when no .env.local exists.
//
// 2. Stubs the `cloudflare:workers` virtual module so any production
//    code that does `import { env as _env } from 'cloudflare:workers'`
//    (i.e. src/env.ts) loads cleanly under Vitest's node runtime.
//    Tests that need a populated env should vi.mock('#/env', …)
//    locally with a `makeTestEnv({ DB: testDb.raw, ... })` payload.

import { vi } from 'vitest'
import { config as loadDotenv } from 'dotenv'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const envFile = join(process.cwd(), '.env.local')
if (existsSync(envFile)) {
  loadDotenv({ path: envFile, quiet: true })
}

vi.mock('cloudflare:workers', () => ({ env: {} }))
