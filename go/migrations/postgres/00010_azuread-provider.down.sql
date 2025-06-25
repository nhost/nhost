-- start a transaction
BEGIN;
DELETE FROM auth.providers WHERE id = 'azuread';
COMMIT;