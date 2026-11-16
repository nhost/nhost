-- Best-effort inverse: restore only unowned SMS-signup placeholders (guards
-- mirror the up migration), oldest claimant per number. Deanonymization stagings
-- and 'sms-change' targets must not become ownership, so they are dropped.
WITH restoration_candidates AS (
    SELECT
        users.id,
        users.new_phone_number,
        row_number() OVER (
            PARTITION BY users.new_phone_number
            ORDER BY users.created_at, users.id
        ) AS claimant_order
    FROM auth.users AS users
    WHERE users.phone_number IS NULL
      AND users.new_phone_number IS NOT NULL
      AND users.phone_number_verified = false
      AND users.email IS NULL
      AND users.new_email IS NULL
      AND users.email_verified = false
      AND users.password_hash IS NULL
      AND users.is_anonymous = false
      AND users.last_seen IS NULL
      AND users.otp_method_last_used = 'sms'
      AND users.pending_sms_deanonymize_options IS NULL
      AND users.totp_secret IS NULL
      AND users.active_mfa_type IS NULL
      AND users.ticket IS NULL
      AND users.webauthn_current_challenge IS NULL
      AND NOT EXISTS (
          SELECT 1
          FROM auth.user_providers AS provider
          WHERE provider.user_id = users.id
      )
      AND NOT EXISTS (
          SELECT 1
          FROM auth.user_security_keys AS security_key
          WHERE security_key.user_id = users.id
      )
      AND NOT EXISTS (
          SELECT 1
          FROM auth.refresh_tokens AS refresh_token
          WHERE refresh_token.user_id = users.id
      )
      AND NOT EXISTS (
          SELECT 1
          FROM auth.oauth2_auth_requests AS auth_request
          WHERE auth_request.user_id = users.id
      )
      AND NOT EXISTS (
          SELECT 1
          FROM auth.oauth2_refresh_tokens AS refresh_token
          WHERE refresh_token.user_id = users.id
      )
      AND NOT EXISTS (
          SELECT 1
          FROM auth.pkce_authorization_codes AS authorization_code
          WHERE authorization_code.user_id = users.id
      )
      AND NOT EXISTS (
          SELECT 1
          FROM auth.oauth2_clients AS client
          WHERE client.created_by = users.id
      )
),
restorable AS (
    SELECT candidate.id, candidate.new_phone_number
    FROM restoration_candidates AS candidate
    WHERE candidate.claimant_order = 1
      AND NOT EXISTS (
          SELECT 1
          FROM auth.users AS owner
          WHERE owner.phone_number = candidate.new_phone_number
      )
)
UPDATE auth.users AS target
SET phone_number = restorable.new_phone_number,
    new_phone_number = NULL
FROM restorable
WHERE target.id = restorable.id;
