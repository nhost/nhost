-- start a transaction
BEGIN;
INSERT INTO auth.providers (id)
    VALUES ('entraid')
ON CONFLICT
    DO NOTHING;
COMMIT;

