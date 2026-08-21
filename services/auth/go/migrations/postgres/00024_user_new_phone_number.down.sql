-- Migration 00026 moved pre-existing unverified phone_number values only from
-- non-anonymous users without an email, password, or linked provider into
-- new_phone_number. Its down migration restores the oldest claimant for each
-- number when users_phone_number_key permits it. Values that conflict with an
-- existing phone_number, later claimants for the same number, and numbers staged
-- after the migration that are not selected for restoration are discarded here.
-- Before this feature, GetUserByPhoneNumber did not require a verified number;
-- losing a non-conflicting value would make passwordless SMS miss the account and
-- enter auto-signup, potentially creating a second account for the same number.

ALTER TABLE auth.users
DROP COLUMN IF EXISTS new_phone_number;
