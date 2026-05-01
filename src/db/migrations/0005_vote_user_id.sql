-- Vote auth gating (DECISIONS.md 2026-04-29):
-- /api/vote now requires a Better Auth session. Votes are dedup'd
-- by (ticket_id, voter_user_id) instead of the prior anon
-- cookie+IP fingerprint. Pre-launch — no real votes to migrate.

DELETE FROM votes;

DROP INDEX IF EXISTS votes_ticket_fp_uq;

ALTER TABLE votes RENAME COLUMN fingerprint TO voter_user_id;

CREATE UNIQUE INDEX votes_ticket_user_uq ON votes(ticket_id, voter_user_id);
