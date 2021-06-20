ALTER TABLE
  "public"."users"
ADD
  COLUMN "name" text NULL;

INSERT INTO
  auth.roles (role)
VALUES
  ('editor'),
  ('super-admin');
