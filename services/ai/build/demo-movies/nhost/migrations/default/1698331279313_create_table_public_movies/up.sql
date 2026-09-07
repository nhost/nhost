CREATE TABLE "public"."movies" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    "updatedAt" timestamptz NOT NULL DEFAULT now(),
    "name" text NOT NULL,
    "score" numeric NOT NULL,
    "genre" text NOT NULL,
    "overview" text NOT NULL,
    "crew" text NOT NULL,
    "budget" bigint NOT NULL,
    "revenue" bigint NOT NULL,
    "country" text NOT NULL,
    PRIMARY KEY ("id")
);

CREATE OR REPLACE FUNCTION "public"."set_current_timestamp_updatedAt"()
RETURNS TRIGGER AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updatedAt" = NOW();
  RETURN _new;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "set_public_movies_updatedAt"
BEFORE UPDATE ON "public"."movies"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updatedAt"();
COMMENT ON TRIGGER "set_public_movies_updatedAt" ON "public"."movies"
IS 'trigger to set value of column "updatedAt" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;
