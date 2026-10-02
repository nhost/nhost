CREATE INDEX IF NOT EXISTS users_new_phone_number_idx ON auth.users (new_phone_number)
WHERE new_phone_number IS NOT NULL;
