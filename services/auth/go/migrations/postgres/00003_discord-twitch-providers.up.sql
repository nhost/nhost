-- start a transaction
BEGIN;
INSERT INTO auth.providers (id) VALUES ('discord'), ('twitch') ON CONFLICT DO NOTHING;
COMMIT;