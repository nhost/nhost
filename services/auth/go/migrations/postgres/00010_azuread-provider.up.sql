-- start a transaction
BEGIN;
INSERT INTO auth.providers (id)
    VALUES ('azuread')
ON CONFLICT
    DO NOTHING;
COMMIT;

