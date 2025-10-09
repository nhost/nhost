CREATE INDEX IF NOT EXISTS refresh_tokens_refresh_token_hash_expires_at_user_id_idx ON
  auth.refresh_tokens (refresh_token_hash, expires_at, user_id);
