// Stable references to the Dodo test-mode product IDs, mirrored
// from src/lib/billing/plans.ts. Centralizing them here lets tests
// import a single symbol without digging through the plan-config
// indirection (which is keyed by env mode at runtime).
//
// If the test-mode IDs in plans.ts change, update these too — both
// sets must agree or webhook fixtures will fail PRODUCT_ID_TO_SLUG
// lookups.

export const TEST_PRODUCT_ID_LITE = 'pdt_0NdRpkVc0SEz3JvRfDphZ'
export const TEST_PRODUCT_ID_STARTER = 'pdt_0NdNiXopUStGE5cemK9PG'
export const TEST_PRODUCT_ID_SCALE = 'pdt_0NdNiXttlTeFfTwrGujIy'
