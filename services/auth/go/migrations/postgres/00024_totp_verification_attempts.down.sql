ALTER TABLE auth.users
    DROP COLUMN totp_locked_until,
    DROP COLUMN totp_attempts;
