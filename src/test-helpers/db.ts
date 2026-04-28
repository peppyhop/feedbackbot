// Test database helper — fresh in-memory SQLite per test, with our
// real migration SQL applied. Pure Node, runs everywhere vitest does.
//
// We use better-sqlite3 (not D1 / miniflare) for speed. The schema
// uses standard sqlite types — same SQL dialect as D1 for everything
// the pay-first flow queries — so refactor protection is intact.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import type { DB } from '#/db/client'
import * as schema from '#/db/schema'

const MIGRATIONS_DIR = join(process.cwd(), 'src/db/migrations')

export type TestDb = {
  db: DB
  raw: Database.Database
}

export function createTestDb(): TestDb {
  const sqlite = new Database(':memory:')
  // Apply migrations in numeric order. Hand-written SQL files (no
  // drizzle-kit journal), so we read + exec each one ourselves
  // rather than using drizzle-orm's migrator.
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    sqlite.exec(sql)
  }
  // The drizzle/d1 type is what production code expects but the SQL
  // dialect is identical between D1 and better-sqlite3 for everything
  // we touch. Cast through unknown so callers can treat the test db
  // as a real DB without each test having to repeat the cast.
  const db = drizzle(sqlite, { schema }) as unknown as DB
  return { db, raw: sqlite }
}
