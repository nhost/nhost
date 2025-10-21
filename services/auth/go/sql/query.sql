-- name: GetUser :one
SELECT * FROM auth.users
WHERE id = $1 LIMIT 1;

-- name: GetUserByEmail :one
SELECT * FROM auth.users
WHERE email = $1 LIMIT 1;

-- name: GetUserByPhoneNumber :one
SELECT * FROM auth.users
WHERE phone_number = $1 LIMIT 1;

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

-- name: GetUserByEmailAndTicket :one
UPDATE auth.users
SET ticket = NULL, ticket_expires_at = now(), email_verified = true
WHERE email = $1 AND ticket = $2 AND ticket_expires_at > now()
RETURNING *;

-- name: GetUserByPhoneNumberAndOTP :one
UPDATE auth.users
SET otp_hash_expires_at = now(), phone_number_verified = true
WHERE
  phone_number = $1
  AND otp_hash = crypt(@otp, otp_hash)
  AND otp_hash_expires_at > now()
  AND otp_method_last_used = 'sms'
RETURNING *;

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
    $1, $2, $3, $4, $5, crypt(@otp, gen_salt('bf')), COALESCE(@otp_hash_expires_at, now()), $8, $9, $10, $11, $12, $13, $14, $15, $16
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
UPDATE auth.users
SET password_hash = $2
WHERE id = $1
RETURNING id;

-- name: UpdateUserConfirmChangeEmail :one
UPDATE auth.users
SET (email, new_email) = (new_email, null)
WHERE id = $1
RETURNING *;

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

-- name: DeleteRefreshTokens :exec
DELETE FROM auth.refresh_tokens
WHERE user_id = $1;

-- name: DeleteRefreshToken :exec
DELETE FROM auth.refresh_tokens
WHERE refresh_token_hash = $1;

-- name: DeleteUserRoles :exec
DELETE FROM auth.user_roles
WHERE user_id = $1;

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
    otp_method_last_used = $4
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
  SELECT access_token
  FROM auth.user_providers
  WHERE user_id = @user_id AND provider_id = @provider_id
)
UPDATE auth.user_providers
SET access_token = ''
WHERE user_id = @user_id AND provider_id = @provider_id
RETURNING (SELECT access_token FROM old_token);
