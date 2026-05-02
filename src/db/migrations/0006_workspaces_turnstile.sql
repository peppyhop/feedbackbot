-- Track when a workspace's domain was last successfully added to
-- the Cloudflare Turnstile widget's hostname allowlist.
--
-- NULL means: never synced, OR last attempt failed. The dashboard
-- surfaces a "widget setup pending" banner when state='claimed' but
-- this column is NULL, and the cron reconciler scans for the same
-- condition to retry async.

ALTER TABLE workspaces ADD COLUMN turnstile_synced_at INTEGER;
