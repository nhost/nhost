ALTER TABLE auth.users ADD COLUMN otp_attempts smallint NOT NULL DEFAULT 0;
