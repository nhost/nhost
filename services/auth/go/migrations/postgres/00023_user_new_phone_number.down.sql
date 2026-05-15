-- Staged-but-unverified numbers in new_phone_number are discarded on revert
-- rather than copied back to phone_number, because doing so would violate
-- users_phone_number_key whenever a different user has since verified the
-- same number (the squat-vs-claim case).

ALTER TABLE auth.users
    DROP COLUMN IF EXISTS new_phone_number;
