-- start a transaction
BEGIN;
INSERT INTO auth.providers (id)
    VALUES ('workos')
ON CONFLICT
    DO NOTHING;
COMMIT;

