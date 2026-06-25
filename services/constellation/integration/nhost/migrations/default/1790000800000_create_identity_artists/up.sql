CREATE SCHEMA IF NOT EXISTS identity;

CREATE TABLE identity.artists (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_name text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE
);
