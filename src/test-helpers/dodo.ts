// Mock for the dodopayments SDK. Tests that need it call
// `setupDodoMock()` at module top-level (before any imports that
// transitively reach DodoPayments), then per-test override
// `mockDodo.checkoutSessions.create` / `.retrieve` with
// mockResolvedValueOnce.
//
// This is mocked rather than swapped for the real SDK because:
//   - Dodo's hosted checkout requires a browser to complete payment
//     with a test card, so we can't programmatically get a "paid"
//     session via API. The only path to test success-page idempotency
//     end-to-end is to mock retrieve().
//   - The single contract test in src/__tests__/dodo-contract.test.ts
//     hits the real test API to validate our request shape — it
//     deliberately doesn't go through this mock.

import { vi } from 'vitest'

export const mockDodo = {
  checkoutSessions: {
    create: vi.fn(),
    retrieve: vi.fn(),
  },
}

export function setupDodoMock() {
  vi.mock('dodopayments', () => ({
    default: vi.fn(() => mockDodo),
  }))
}

export function resetDodoMock() {
  mockDodo.checkoutSessions.create.mockReset()
  mockDodo.checkoutSessions.retrieve.mockReset()
}
