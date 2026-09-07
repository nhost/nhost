-- Values not restored by 00026's down migration (conflicting or later claimants,
-- deanonymization stagings, 'sms-change' targets) are discarded here. A discarded
-- number makes old-code passwordless SMS auto-signup a second account for it.

ALTER TABLE auth.users
DROP COLUMN IF EXISTS new_phone_number;
