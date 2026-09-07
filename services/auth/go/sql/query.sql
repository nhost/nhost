-- name: GetUser :one
SELECT * FROM auth.users
WHERE id = $1 LIMIT 1;

-- name: GetUserByEmail :one
SELECT * FROM auth.users
WHERE email = $1 LIMIT 1;

-- name: GetUserByPhoneNumber :one
-- No phone_number_verified filter on purpose: an unverified phone_number can come
-- from an admin write, a pre-migration replica, or an account with other
-- credentials that the data migration leaves in place, and hiding those rows
-- strands the number instead of letting the next OTP heal it.
SELECT * FROM auth.users
WHERE phone_number = $1
LIMIT 1;

-- name: UpdateStagedSMSUser :one
-- Refresh only a credential-free SMS signup row. The identity and relationship
-- guards ensure a retry re-stages a genuinely abandoned signup placeholder and can
-- never overwrite an account that has since acquired another authentication method.
WITH candidate AS (
    SELECT users.id
    FROM auth.users AS users
    WHERE users.phone_number IS NULL
      AND users.new_phone_number = @phone_number
      AND users.phone_number_verified = false
      AND users.disabled = @disabled
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
          SELECT 1 FROM auth.user_providers
          WHERE user_id = users.id
      )
      AND NOT EXISTS (
          SELECT 1 FROM auth.user_security_keys
          WHERE user_id = users.id
      )
      AND NOT EXISTS (
          SELECT 1 FROM auth.refresh_tokens
          WHERE user_id = users.id
      )
      AND NOT EXISTS (
          SELECT 1 FROM auth.oauth2_auth_requests
          WHERE user_id = users.id
      )
      AND NOT EXISTS (
          SELECT 1 FROM auth.oauth2_refresh_tokens
          WHERE user_id = users.id
      )
      AND NOT EXISTS (
          SELECT 1 FROM auth.pkce_authorization_codes
          WHERE user_id = users.id
      )
      AND NOT EXISTS (
          SELECT 1 FROM auth.oauth2_clients
          WHERE created_by = users.id
      )
    ORDER BY users.created_at DESC, users.id DESC
    LIMIT 1
    FOR UPDATE
), updated_user AS (
    UPDATE auth.users AS users
    SET display_name = @display_name,
        otp_hash = crypt(@otp, gen_salt('bf')),
        otp_hash_expires_at = @otp_hash_expires_at,
        otp_method_last_used = 'sms',
        otp_attempts = 0,
        locale = @locale,
        default_role = @default_role,
        metadata = @metadata
    FROM candidate
    WHERE users.id = candidate.id
    RETURNING users.id
), deleted_roles AS (
    DELETE FROM auth.user_roles AS user_roles
    USING updated_user
    WHERE user_roles.user_id = updated_user.id
      AND NOT (user_roles.role = ANY(@roles::TEXT[]))
    RETURNING user_roles.id
), inserted_roles AS (
    INSERT INTO auth.user_roles (user_id, role)
    SELECT updated_user.id, roles.role
    FROM updated_user, unnest(@roles::TEXT[]) AS roles(role)
    ON CONFLICT (user_id, role) DO NOTHING
    RETURNING user_id
)
SELECT updated_user.id
FROM updated_user
WHERE (SELECT count(*) FROM deleted_roles) >= 0
  AND (SELECT count(*) FROM inserted_roles) >= 0;

-- name: GetUserRoles :many
SELECT * FROM auth.user_roles
WHERE user_id = $1;

-- name: GetUserByRefreshTokenHash :one
WITH refresh_token AS (
    SELECT * FROM auth.refresh_tokens
    WHERE refresh_token_hash = $1 AND type = $2 AND expires_at > now()
    LIMIT 1
)
SELECT * FROM auth.users
WHERE id = (SELECT user_id FROM refresh_token) LIMIT 1;

-- name: GetUserByTicket :one
WITH selected_user AS (
    SELECT * FROM auth.users
    WHERE ticket = $1  AND ticket_expires_at > now()
    LIMIT 1
)
UPDATE auth.users
SET ticket = NULL, ticket_expires_at = now()
WHERE id = (SELECT id FROM selected_user)
RETURNING *;

-- name: VerifyEmailOTP :one
-- Verifies an email OTP and applies the attempt policy in a single statement, so
-- a failed guess needs no follow-up query to learn why it failed. A wrong guess
-- increments otp_attempts and only burns the code (clears the hash) once it
-- reaches @max_attempts, so a typo no longer kills the code on the first mistake
-- while still bounding brute-force; a correct guess clears the code and resets
-- the counter. The hash is evaluated once (in selected) and reused. Returns the
-- outcome the caller maps to a response:
--   'ok'      correct code; email is now verified and the counter reset
--   'burned'  this guess (or an earlier one) exhausted the attempt cap
--   'invalid' wrong code with attempts left, or no live code for the email
WITH selected AS (
    SELECT id, (otp_hash = crypt(@otp, otp_hash)) AS is_correct
    FROM auth.users
    WHERE email = @email
      AND otp_method_last_used = 'email'
      AND otp_hash IS NOT NULL
      AND otp_hash_expires_at > now()
    FOR UPDATE
),
correct AS (
    UPDATE auth.users u
    SET otp_hash = NULL,
        otp_hash_expires_at = now(),
        email_verified = true,
        otp_attempts = 0
    FROM selected s
    WHERE u.id = s.id AND s.is_correct
    RETURNING u.id
),
wrong AS (
    UPDATE auth.users u
    SET otp_attempts = u.otp_attempts + 1,
        otp_hash = CASE
            WHEN u.otp_attempts + 1 >= @max_attempts::integer THEN NULL
            ELSE u.otp_hash END,
        otp_hash_expires_at = CASE
            WHEN u.otp_attempts + 1 >= @max_attempts::integer THEN now()
            ELSE u.otp_hash_expires_at END
    FROM selected s
    WHERE u.id = s.id AND NOT s.is_correct
    RETURNING (u.otp_attempts >= @max_attempts::integer) AS burned
)
SELECT (
    CASE
        WHEN EXISTS (SELECT 1 FROM correct) THEN 'ok'
        WHEN (SELECT burned FROM wrong) THEN 'burned'
        WHEN EXISTS (SELECT 1 FROM wrong) THEN 'invalid'
        WHEN EXISTS (
            SELECT 1 FROM auth.users
            WHERE email = @email
              AND otp_method_last_used = 'email'
              AND otp_hash IS NULL
              AND otp_attempts >= @max_attempts::integer
        ) THEN 'burned'
        ELSE 'invalid'
    END
)::text AS status;

-- name: VerifySMSOTPAndPromotePhoneNumber :one
-- Verifies an SMS OTP, then promotes a staged anonymous deanonymization or
-- verifies an ordinary user's phone number. new_phone_number is not unique, so
-- several live rows can share the number: a wrong guess spends one attempt on
-- each, and a code binds only through winner (the single matching row) so an OTP
-- collision cannot bind an arbitrarily chosen account. Status is least-terminal
-- across the set: 'invalid' while any matched row still has attempts, else
-- 'burned' / 'ok'.
WITH eligible AS (
    SELECT
        users.id,
        users.is_anonymous,
        users.pending_sms_deanonymize_options AS options,
        (users.otp_hash = crypt(@otp::text, users.otp_hash)) AS is_correct
    FROM auth.users AS users
    WHERE
        (users.phone_number = @phone_number
         OR (users.phone_number IS NULL AND users.new_phone_number = @phone_number))
        AND users.disabled = false
        AND users.otp_hash IS NOT NULL
        AND users.otp_hash_expires_at > now()
        AND users.otp_method_last_used = 'sms'
        AND (
            users.is_anonymous = false
            OR (
                users.pending_sms_deanonymize_options IS NOT NULL
                AND users.email IS NULL
            )
        )
    FOR UPDATE
), winner AS (
    SELECT id, is_anonymous, options
    FROM eligible
    WHERE is_correct
      AND (SELECT count(*) FROM eligible WHERE is_correct) = 1
), promoted AS (
    UPDATE auth.users AS users
    SET
        phone_number = @phone_number,
        new_phone_number = NULLIF(users.new_phone_number, @phone_number),
        phone_number_verified = true,
        otp_hash = NULL,
        otp_hash_expires_at = now(),
        otp_attempts = 0,
        is_anonymous = false,
        default_role = winner.options ->> 'default_role',
        display_name = winner.options ->> 'display_name',
        locale = winner.options ->> 'locale',
        metadata = NULLIF(winner.options -> 'metadata', 'null'::jsonb),
        pending_sms_deanonymize_options = NULL
    FROM winner
    WHERE users.id = winner.id
      AND winner.is_anonymous = true
    RETURNING users.id
), verified AS (
    UPDATE auth.users AS users
    SET
        phone_number = @phone_number,
        new_phone_number = NULLIF(users.new_phone_number, @phone_number),
        phone_number_verified = true,
        otp_hash = NULL,
        otp_hash_expires_at = now(),
        otp_attempts = 0,
        pending_sms_deanonymize_options = NULL
    FROM winner
    WHERE users.id = winner.id
      AND winner.is_anonymous = false
    RETURNING users.id
), wrong AS (
    UPDATE auth.users AS users
    SET otp_attempts = users.otp_attempts + 1,
        otp_hash = CASE
            WHEN users.otp_attempts + 1 >= @max_attempts::integer THEN NULL
            ELSE users.otp_hash END,
        otp_hash_expires_at = CASE
            WHEN users.otp_attempts + 1 >= @max_attempts::integer THEN now()
            ELSE users.otp_hash_expires_at END
    FROM eligible
    WHERE users.id = eligible.id
      AND NOT eligible.is_correct
      AND NOT EXISTS (SELECT 1 FROM eligible AS e WHERE e.is_correct)
    RETURNING (users.otp_attempts >= @max_attempts::integer) AS burned
), pending AS (
    SELECT winner.id, winner.options
    FROM winner
    WHERE winner.is_anonymous = true
), deleted_roles AS (
    DELETE FROM auth.user_roles AS user_roles
    WHERE user_roles.user_id = (SELECT pending.id FROM pending)
      AND NOT EXISTS (
          SELECT 1
          FROM pending,
               jsonb_array_elements_text(pending.options -> 'roles') AS staged_roles(role)
          WHERE staged_roles.role = user_roles.role
      )
), inserted_roles AS (
    INSERT INTO auth.user_roles (user_id, role)
    SELECT pending.id, jsonb_array_elements_text(pending.options -> 'roles')
    FROM pending
    ON CONFLICT (user_id, role) DO NOTHING
), revoked_refresh_tokens AS (
    DELETE FROM auth.refresh_tokens
    WHERE user_id = (SELECT pending.id FROM pending)
)
SELECT (
    CASE
        WHEN EXISTS (SELECT 1 FROM promoted) THEN 'ok'
        WHEN EXISTS (SELECT 1 FROM verified) THEN 'ok'
        WHEN EXISTS (SELECT 1 FROM wrong WHERE NOT burned) THEN 'invalid'
        WHEN EXISTS (SELECT 1 FROM wrong) THEN 'burned'
        WHEN EXISTS (
            SELECT 1 FROM auth.users AS users
            WHERE (users.phone_number = @phone_number
                   OR (users.phone_number IS NULL
                       AND users.new_phone_number = @phone_number))
              AND users.disabled = false
              AND users.otp_method_last_used = 'sms'
              AND users.otp_hash IS NULL
              AND users.otp_attempts >= @max_attempts::integer
              AND (
                  users.is_anonymous = false
                  OR (
                      users.pending_sms_deanonymize_options IS NOT NULL
                      AND users.email IS NULL
                  )
              )
        ) THEN 'burned'
        ELSE 'invalid'
    END
)::text AS status;

-- name: GetUserByProviderID :one
WITH user_providers AS (
    SELECT * FROM auth.user_providers
    WHERE provider_user_id = $1
    AND provider_id = $2
    LIMIT 1
)
SELECT * FROM auth.users
WHERE id = (SELECT user_id FROM user_providers) LIMIT 1;


-- name: InsertUser :one
WITH inserted_user AS (
    INSERT INTO auth.users (
        id,
        disabled,
        display_name,
        avatar_url,
        phone_number,
        new_phone_number,
        otp_hash,
        otp_hash_expires_at,
        otp_method_last_used,
        email,
        password_hash,
        ticket,
        ticket_expires_at,
        email_verified,
        locale,
        default_role,
        metadata
    ) VALUES (
    $1, $2, $3, $4, $5, @new_phone_number, crypt(@otp, gen_salt('bf')), COALESCE(@otp_hash_expires_at, now()), $8, $9, $10, $11, $12, $13, $14, $15, $16
    )
    RETURNING *
)
INSERT INTO auth.user_roles (user_id, role)
    SELECT inserted_user.id, roles.role
    FROM inserted_user, unnest(@roles::TEXT[]) AS roles(role)
RETURNING user_id, (SELECT created_at FROM inserted_user WHERE id = user_id);

-- name: InsertSecurityKey :one
INSERT INTO auth.user_security_keys
    (user_id, credential_id, credential_public_key, nickname)
VALUES
    ($1, @credential_id, @credential_public_key, @nickname)
RETURNING id;

-- name: InsertUserWithSecurityKeyAndRefreshToken :one
WITH inserted_user AS (
    INSERT INTO auth.users (
        id,
        disabled,
        display_name,
        avatar_url,
        email,
        ticket,
        ticket_expires_at,
        email_verified,
        locale,
        default_role,
        metadata,
        last_seen
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now()
    )
    RETURNING id
), inserted_refresh_token AS (
    INSERT INTO auth.refresh_tokens
        (user_id, refresh_token_hash, expires_at)
    VALUES
        ($1, @refresh_token_hash, @refresh_token_expires_at)
    RETURNING id, user_id
), inserted_security_key AS (
    INSERT INTO auth.user_security_keys
        (user_id, credential_id, credential_public_key, nickname)
    VALUES
        ($1, @credential_id, @credential_public_key, @nickname)
), inserted_user_role AS (
    INSERT INTO auth.user_roles (user_id, role)
    SELECT inserted_user.id, roles.role
    FROM inserted_user, unnest(@roles::TEXT[]) AS roles(role)
)
SELECT
    (SELECT id FROM inserted_user),
    (SELECT id FROM inserted_refresh_token) AS refresh_token_id;

-- name: InsertUserWithSecurityKey :one
WITH inserted_user AS (
    INSERT INTO auth.users (
        id,
        disabled,
        display_name,
        avatar_url,
        email,
        ticket,
        ticket_expires_at,
        email_verified,
        locale,
        default_role,
        metadata,
        last_seen
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now()
    )
    RETURNING id
), inserted_security_key AS (
    INSERT INTO auth.user_security_keys
        (user_id, credential_id, credential_public_key, nickname)
    VALUES
        ($1, @credential_id, @credential_public_key, @nickname)
)
INSERT INTO auth.user_roles (user_id, role)
    SELECT inserted_user.id, roles.role
    FROM inserted_user, unnest(@roles::TEXT[]) AS roles(role)
RETURNING user_id;

-- name: InsertUserWithUserProvider :one
WITH inserted_user AS (
    INSERT INTO auth.users (
        id,
        disabled,
        display_name,
        avatar_url,
        email,
        ticket,
        ticket_expires_at,
        email_verified,
        locale,
        default_role,
        metadata,
        last_seen
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now()
    )
    RETURNING id
), inserted_user_provider AS (
    INSERT INTO auth.user_providers
        (user_id, access_token, provider_id, provider_user_id)
    VALUES
        ($1, 'unset', @provider_id, @provider_user_id)
)
INSERT INTO auth.user_roles (user_id, role)
    SELECT inserted_user.id, roles.role
    FROM inserted_user, unnest(@roles::TEXT[]) AS roles(role)
RETURNING user_id;

-- name: InsertUserWithUserProviderAndRefreshToken :one
WITH inserted_user AS (
    INSERT INTO auth.users (
        id,
        disabled,
        display_name,
        avatar_url,
        email,
        ticket,
        ticket_expires_at,
        email_verified,
        locale,
        default_role,
        metadata,
        last_seen
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now()
    )
    RETURNING id
), inserted_refresh_token AS (
    INSERT INTO auth.refresh_tokens
        (user_id, refresh_token_hash, expires_at)
    VALUES
        ($1, @refresh_token_hash, @refresh_token_expires_at)
    RETURNING id , user_id
), inserted_user_provider AS (
    INSERT INTO auth.user_providers
        (user_id, access_token, provider_id, provider_user_id)
    VALUES
        ($1, 'unset', @provider_id, @provider_user_id)
), inserted_user_role AS (
    INSERT INTO auth.user_roles (user_id, role)
    SELECT inserted_user.id, roles.role
    FROM inserted_user, unnest(@roles::TEXT[]) AS roles(role)
)
SELECT
    (SELECT id FROM inserted_user),
    (SELECT id FROM inserted_refresh_token) AS refresh_token_id;

-- name: InsertUserWithRefreshToken :one
WITH inserted_user AS (
    INSERT INTO auth.users (
        disabled,
        display_name,
        avatar_url,
        email,
        password_hash,
        ticket,
        ticket_expires_at,
        email_verified,
        locale,
        default_role,
        is_anonymous,
        metadata,
        last_seen
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now()
    )
    RETURNING id
), inserted_refresh_token AS (
    INSERT INTO auth.refresh_tokens (user_id, refresh_token_hash, expires_at)
        SELECT inserted_user.id, @refresh_token_hash, @refresh_token_expires_at
        FROM inserted_user
    RETURNING id, user_id
), inserted_user_role AS (
    INSERT INTO auth.user_roles (user_id, role)
    SELECT inserted_user.id, roles.role
    FROM inserted_user, unnest(@roles::TEXT[]) AS roles(role)
)
SELECT
    (SELECT id FROM inserted_user),
    (SELECT id FROM inserted_refresh_token) AS refresh_token_id;


-- name: InsertRefreshtoken :one
INSERT INTO auth.refresh_tokens (user_id, refresh_token_hash, expires_at, type, metadata)
VALUES ($1, $2, $3, $4, $5)
RETURNING id;

-- name: RefreshTokenAndGetUserRoles :many
WITH refreshed_token AS (
    UPDATE auth.refresh_tokens
    SET
        expires_at = $2,
        refresh_token_hash = sqlc.arg(new_refresh_token_hash)
    WHERE refresh_token_hash = sqlc.arg(old_refresh_token_hash)
    RETURNING id AS refresh_token_id, user_id
),
updated_user AS (
    UPDATE auth.users
    SET last_seen = now()
    FROM refreshed_token
    WHERE auth.users.id = refreshed_token.user_id
)
SELECT refreshed_token.refresh_token_id, role FROM auth.user_roles
RIGHT JOIN refreshed_token ON auth.user_roles.user_id = refreshed_token.user_id;

-- name: UpdateUserLastSeen :one
UPDATE auth.users
SET last_seen = now()
WHERE id = $1
RETURNING last_seen;

-- name: UpdateUserTicket :one
UPDATE auth.users
SET (ticket, ticket_expires_at) = ($2, $3)
WHERE id = $1
RETURNING id;

-- name: UpdateUserChangeEmail :one
UPDATE auth.users
SET (ticket, ticket_expires_at, new_email, email_verified) = ($2, $3, $4, true)
WHERE id = $1
RETURNING *;

-- name: UpdateUserChangePassword :one
WITH updated_user AS (
    UPDATE auth.users
    SET password_hash = @password_hash
    WHERE id = @id::uuid
    RETURNING id
),
revoked_refresh_tokens AS (
    DELETE FROM auth.refresh_tokens
    WHERE user_id = @id::uuid
    AND type = 'regular'
),
revoked_oauth2_refresh_tokens AS (
    DELETE FROM auth.oauth2_refresh_tokens
    WHERE user_id = @id::uuid
)
SELECT id FROM updated_user;

-- name: UpdateUserConfirmChangeEmail :one
UPDATE auth.users
SET (email, new_email) = (new_email, null)
WHERE id = $1
RETURNING *;

-- name: GetUserByPhoneNumberOtherThanSelf :one
-- Mirrors the users_phone_number_key unique constraint exactly (no verified or
-- disabled filter) to reject a doomed change before wasting an SMS. Staged
-- new_phone_number squats intentionally don't block — see
-- services/auth/test/routes/user/phone-squat.test.ts.
SELECT *
FROM auth.users
WHERE
    id <> @user_id
    AND phone_number = @phone_number;

-- name: UpdateUserChangePhoneNumber :exec
-- Resets otp_attempts so a freshly issued code starts with a full budget.
UPDATE auth.users
SET
    new_phone_number = @new_phone_number,
    otp_hash = crypt(@otp, gen_salt('bf')),
    otp_hash_expires_at = @otp_hash_expires_at,
    otp_method_last_used = 'sms-change',
    otp_attempts = 0
WHERE id = @id;

-- name: UpdateUserConfirmChangePhoneNumber :one
-- Confirms a phone-number change under the same attempt policy as VerifyEmailOTP;
-- keyed by primary key, so at most one row is affected.
WITH selected AS (
    SELECT id, (otp_hash = crypt(@otp, otp_hash)) AS is_correct
    FROM auth.users
    WHERE id = @id
      AND new_phone_number = @new_phone_number
      AND otp_method_last_used = 'sms-change'
      AND otp_hash IS NOT NULL
      AND otp_hash_expires_at > now()
    FOR UPDATE
),
correct AS (
    UPDATE auth.users u
    SET phone_number = u.new_phone_number,
        phone_number_verified = true,
        new_phone_number = NULL,
        otp_hash = NULL,
        otp_hash_expires_at = now(),
        otp_method_last_used = NULL,
        otp_attempts = 0
    FROM selected s
    WHERE u.id = s.id AND s.is_correct
    RETURNING u.id
),
wrong AS (
    UPDATE auth.users u
    SET otp_attempts = u.otp_attempts + 1,
        otp_hash = CASE
            WHEN u.otp_attempts + 1 >= @max_attempts::integer THEN NULL
            ELSE u.otp_hash END,
        otp_hash_expires_at = CASE
            WHEN u.otp_attempts + 1 >= @max_attempts::integer THEN now()
            ELSE u.otp_hash_expires_at END
    FROM selected s
    WHERE u.id = s.id AND NOT s.is_correct
    RETURNING (u.otp_attempts >= @max_attempts::integer) AS burned
)
SELECT (
    CASE
        WHEN EXISTS (SELECT 1 FROM correct) THEN 'ok'
        WHEN (SELECT burned FROM wrong) THEN 'burned'
        WHEN EXISTS (SELECT 1 FROM wrong) THEN 'invalid'
        WHEN EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = @id
              AND new_phone_number = @new_phone_number
              AND otp_method_last_used = 'sms-change'
              AND otp_hash IS NULL
              AND otp_attempts >= @max_attempts::integer
        ) THEN 'burned'
        ELSE 'invalid'
    END
)::text AS status;

-- name: UpdateUserVerifyEmail :one
UPDATE auth.users
SET email_verified = true
WHERE id = $1
RETURNING *;

-- name: CountSecurityKeysUser :one
SELECT COUNT(*) FROM auth.user_security_keys
WHERE user_id = $1;

-- name: GetSecurityKeys :many
SELECT *
FROM auth.user_security_keys
WHERE user_id = $1;

-- name: UpdateUserDeanonymize :exec
WITH inserted_user AS (
    UPDATE auth.users
    SET
        is_anonymous = false,
        email = @email,
        default_role = @default_role,
        display_name = @display_name,
        locale = @locale,
        metadata = @metadata,
        password_hash = @password_hash,
        ticket = @ticket,
        ticket_expires_at = @ticket_expires_at
    WHERE id = @id
    RETURNING id
)
INSERT INTO auth.user_roles (user_id, role)
    SELECT inserted_user.id, roles.role
    FROM inserted_user, unnest(@roles::TEXT[]) AS roles(role);

-- name: UpdateUserDeanonymizeSMS :exec
-- Stages an SMS-based deanonymization without changing authorization state.
-- VerifySMSOTPAndPromotePhoneNumber applies the pending options atomically with
-- OTP verification, so an abandoned flow remains anonymous.
UPDATE auth.users
SET
    new_phone_number = @phone_number,
    otp_hash = crypt(@otp, gen_salt('bf')),
    otp_hash_expires_at = @otp_hash_expires_at,
    otp_method_last_used = 'sms',
    otp_attempts = 0,
    pending_sms_deanonymize_options = jsonb_build_object(
        'roles', to_jsonb(@roles::TEXT[]),
        'default_role', @default_role::TEXT,
        'display_name', @display_name::TEXT,
        'locale', @locale::TEXT,
        'metadata', @metadata::JSONB
    )
WHERE id = @id::uuid;

-- name: DeleteRefreshTokens :exec
DELETE FROM auth.refresh_tokens
WHERE user_id = $1;

-- name: DeleteRefreshToken :exec
DELETE FROM auth.refresh_tokens
WHERE refresh_token_hash = $1;

-- name: DeleteUserRoles :exec
DELETE FROM auth.user_roles
WHERE user_id = $1;

-- name: DeleteExpiredRefreshTokens :exec
DELETE FROM auth.refresh_tokens
WHERE expires_at < now();

-- name: ReleaseExpiredStagedSMSDeanonymizations :exec
-- SMS deanonymization stages options on a still-anonymous account, so discard
-- only the expired staged state and never delete the account itself.
UPDATE auth.users
SET
    new_phone_number = NULL,
    otp_hash = NULL,
    otp_hash_expires_at = now(),
    otp_method_last_used = NULL,
    pending_sms_deanonymize_options = NULL
WHERE new_phone_number IS NOT NULL
  AND is_anonymous = true
  AND otp_method_last_used = 'sms'
  AND pending_sms_deanonymize_options IS NOT NULL
  AND otp_hash_expires_at < now();

-- name: FindUserProviderByProviderId :one
SELECT * FROM auth.user_providers
WHERE provider_user_id = $1 AND provider_id = $2;

-- name: InsertUserProvider :one
INSERT INTO auth.user_providers (user_id, provider_id, provider_user_id, access_token)
VALUES ($1, $2, $3, 'unset')
RETURNING *;

-- name: UpdateUserTotpSecret :exec
UPDATE auth.users
SET totp_secret = $2
WHERE id = $1;

-- name: UpdateUserActiveMFAType :exec
UPDATE auth.users
SET active_mfa_type = $2
WHERE id = $1;

-- name: UpdateUserOTPHash :one
UPDATE auth.users
SET otp_hash = crypt(@otp, gen_salt('bf')),
    otp_hash_expires_at = $3,
    otp_method_last_used = $4,
    otp_attempts = 0
WHERE id = $1
RETURNING id;

-- name: UpsertRoles :many
INSERT INTO auth.roles (role)
SELECT unnest(@roles::TEXT[])
ON CONFLICT (role) DO NOTHING
RETURNING role;

-- name: GetUsersWithUnencryptedTOTPSecret :many
SELECT * FROM auth.users
WHERE LENGTH(totp_secret) < 64;

-- name: UpdateProviderSession :exec
UPDATE auth.user_providers
SET access_token = $3
WHERE provider_user_id = $1 AND provider_id = $2;

-- name: GetProviderSession :one
WITH old_token AS (
  SELECT id, access_token
  FROM auth.user_providers
  WHERE user_id = @user_id AND provider_id = @provider_id
  ORDER BY updated_at DESC
  LIMIT 1
  FOR UPDATE
)
UPDATE auth.user_providers
SET access_token = ''
WHERE id = (SELECT id FROM old_token)
RETURNING (SELECT access_token FROM old_token);

-- =============================================================================
-- OAuth2 Provider - Clients
-- =============================================================================

-- name: GetOAuth2ClientByClientID :one
SELECT * FROM auth.oauth2_clients
WHERE client_id = $1
LIMIT 1;

-- =============================================================================
-- OAuth2 Provider - Auth Requests
-- =============================================================================

-- name: InsertOAuth2AuthRequest :one
INSERT INTO auth.oauth2_auth_requests (
    client_id, scopes, redirect_uri, state, nonce,
    response_type, code_challenge, code_challenge_method,
    resource, expires_at
) VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8,
    $9, $10
)
RETURNING *;

-- name: GetOAuth2AuthRequest :one
SELECT * FROM auth.oauth2_auth_requests
WHERE id = $1
LIMIT 1;

-- name: CompleteOAuth2LoginAndInsertCode :one
WITH updated_request AS (
    UPDATE auth.oauth2_auth_requests
    SET user_id = sqlc.arg(user_id), done = true, auth_time = now()
    WHERE id = sqlc.arg(id) AND done = false
    RETURNING id
)
INSERT INTO auth.oauth2_authorization_codes (code_hash, auth_request_id, expires_at)
SELECT sqlc.arg(code_hash), id, sqlc.arg(expires_at)
FROM updated_request
RETURNING *;

-- name: DeleteOAuth2AuthRequest :exec
DELETE FROM auth.oauth2_auth_requests
WHERE id = $1;

-- name: DeleteExpiredOAuth2AuthRequests :exec
DELETE FROM auth.oauth2_auth_requests
WHERE expires_at < now();

-- =============================================================================
-- OAuth2 Provider - Authorization Codes
-- =============================================================================

-- name: GetOAuth2AuthorizationCodeAuthRequest :one
SELECT ar.* FROM auth.oauth2_auth_requests ar
JOIN auth.oauth2_authorization_codes ac ON ac.auth_request_id = ar.id
WHERE ac.code_hash = $1 AND ac.expires_at > now()
LIMIT 1;

-- name: ConsumeOAuth2CodeAndInsertRefreshToken :one
WITH deleted_code AS (
    DELETE FROM auth.oauth2_authorization_codes
    WHERE code_hash = $1 AND expires_at > now()
    RETURNING auth_request_id
)
INSERT INTO auth.oauth2_refresh_tokens (
    token_hash, auth_request_id, client_id, user_id, scopes, expires_at
)
SELECT $2, dc.auth_request_id, $3, $4, $5, $6
FROM deleted_code dc
RETURNING *;

-- name: DeleteExpiredOAuth2AuthorizationCodes :exec
DELETE FROM auth.oauth2_authorization_codes
WHERE expires_at < now();

-- =============================================================================
-- OAuth2 Provider - Refresh Tokens
-- =============================================================================

-- name: GetOAuth2RefreshTokenByHash :one
SELECT * FROM auth.oauth2_refresh_tokens
WHERE token_hash = $1 AND expires_at > now()
LIMIT 1;

-- name: DeleteOAuth2RefreshTokenByHashAndClientID :exec
DELETE FROM auth.oauth2_refresh_tokens
WHERE token_hash = $1 AND client_id = $2;

-- name: UpdateOAuth2RefreshToken :one
UPDATE auth.oauth2_refresh_tokens
SET token_hash = $2, expires_at = $3
WHERE token_hash = $1
RETURNING *;

-- name: DeleteOAuth2RefreshTokensByUserID :exec
DELETE FROM auth.oauth2_refresh_tokens
WHERE user_id = $1;

-- name: DeleteExpiredOAuth2RefreshTokens :exec
DELETE FROM auth.oauth2_refresh_tokens
WHERE expires_at < now();

-- =============================================================================
-- PKCE Authorization Codes
-- =============================================================================

-- name: InsertPKCEAuthorizationCode :one
INSERT INTO auth.pkce_authorization_codes (
    user_id, code_hash, code_challenge, redirect_to, expires_at
) VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ConsumePKCEAuthorizationCode :one
DELETE FROM auth.pkce_authorization_codes
WHERE code_hash = $1 AND code_challenge = $2 AND expires_at > now()
RETURNING *;

-- name: DeleteExpiredPKCEAuthorizationCodes :exec
DELETE FROM auth.pkce_authorization_codes
WHERE expires_at < now();

-- name: UpsertOAuth2CIMDClient :one
INSERT INTO auth.oauth2_clients (
    client_id, redirect_uris, scopes,
    "type", metadata_document_fetched_at
) VALUES (
    $1, $2, $3,
    'client_id_metadata_document', now()
)
ON CONFLICT (client_id) DO UPDATE SET
    redirect_uris = EXCLUDED.redirect_uris,
    scopes = EXCLUDED.scopes,
    metadata_document_fetched_at = now()
RETURNING *;
