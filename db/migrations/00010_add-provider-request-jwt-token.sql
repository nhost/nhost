ALTER TABLE auth.provider_requests
  ADD COLUMN jwt_token text DEFAULT NULL;
