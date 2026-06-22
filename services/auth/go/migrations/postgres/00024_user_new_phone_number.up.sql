ALTER TABLE auth.users
    ADD COLUMN new_phone_number text;

UPDATE auth.users
SET new_phone_number = phone_number,
    phone_number = NULL
WHERE phone_number IS NOT NULL
  AND phone_number_verified = false;

CREATE INDEX IF NOT EXISTS users_new_phone_number_idx ON auth.users (new_phone_number)
WHERE new_phone_number IS NOT NULL;
