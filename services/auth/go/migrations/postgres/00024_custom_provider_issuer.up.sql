-- Metadata-only: no table rewrite, so the ACCESS EXCLUSIVE lock is held for
-- microseconds. The two covering indexes are deliberately NOT here — this
-- driver sends a migration file as a single Exec, which Postgres wraps in an
-- implicit transaction, so an index build in this file would hold that lock
-- (blocking reads as well as writes on auth.user_providers) for its whole
-- duration and would rule out CONCURRENTLY.
ALTER TABLE auth.user_providers ADD COLUMN issuer text;
