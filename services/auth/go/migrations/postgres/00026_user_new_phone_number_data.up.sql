UPDATE auth.users AS users
SET new_phone_number = phone_number,
    phone_number = NULL
WHERE users.phone_number IS NOT NULL
  AND users.phone_number_verified = false
  AND users.email IS NULL
  AND users.password_hash IS NULL
  AND users.is_anonymous = false
  AND NOT EXISTS (
      SELECT 1
      FROM auth.user_providers AS provider
      WHERE provider.user_id = users.id
  );
