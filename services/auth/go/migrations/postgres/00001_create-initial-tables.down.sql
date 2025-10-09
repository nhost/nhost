-- start a transaction
BEGIN;

-- drop triggers
DROP TRIGGER IF EXISTS set_auth_users_updated_at ON auth.users;
DROP TRIGGER IF EXISTS set_auth_user_providers_updated_at ON auth.user_providers;

-- drop foreign key constraints
ALTER TABLE auth.refresh_tokens
  DROP CONSTRAINT IF EXISTS fk_user;

ALTER TABLE auth.users
  DROP CONSTRAINT IF EXISTS fk_default_role;

ALTER TABLE auth.user_roles
  DROP CONSTRAINT IF EXISTS fk_role;

ALTER TABLE auth.user_roles
  DROP CONSTRAINT IF EXISTS fk_user;

ALTER TABLE auth.user_providers
  DROP CONSTRAINT IF EXISTS fk_provider;

ALTER TABLE auth.user_providers
  DROP CONSTRAINT IF EXISTS fk_user;

-- drop tables
DROP TABLE IF EXISTS auth.provider_requests;
DROP TABLE IF EXISTS auth.roles;
DROP TABLE IF EXISTS auth.refresh_tokens;
DROP TABLE IF EXISTS auth.providers;
DROP TABLE IF EXISTS auth.users;
DROP TABLE IF EXISTS auth.user_roles;
DROP TABLE IF EXISTS auth.user_providers;

-- drop domains
DROP DOMAIN IF EXISTS auth.email;

-- drop functions
DROP FUNCTION IF EXISTS auth.set_current_timestamp_updated_at();

-- drop extensions (be careful with this as they might be used elsewhere)
-- DROP EXTENSION IF EXISTS pgcrypto;
-- DROP EXTENSION IF EXISTS citext;

-- commit the change
COMMIT;