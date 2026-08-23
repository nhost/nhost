ALTER TABLE auth.users
    ADD COLUMN totp_attempts smallint NOT NULL DEFAULT 0,
    ADD COLUMN totp_locked_until timestamp with time zone;
