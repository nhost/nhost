-- start a transaction
BEGIN;
DELETE FROM auth.providers WHERE id IN ('discord', 'twitch');
COMMIT;