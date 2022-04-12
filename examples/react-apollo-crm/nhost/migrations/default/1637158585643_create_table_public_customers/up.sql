CREATE TABLE "public"."customers" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT NOW(),
  "updated_at" timestamptz NOT NULL DEFAULT NOW(),
  "name" text NOT NULL,
  "address_line_1" text NOT NULL,
  "user_id" uuid,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE RESTRICT ON DELETE
  SET
    NULL
);

CREATE
OR REPLACE FUNCTION "public"."set_current_timestamp_updated_at"() RETURNS TRIGGER AS $$ DECLARE _new record;

BEGIN _new := NEW;

_new."updated_at" = NOW();

RETURN _new;

END;

$$ LANGUAGE plpgsql;

CREATE TRIGGER "set_public_customers_updated_at" BEFORE
UPDATE
  ON "public"."customers" FOR EACH ROW EXECUTE PROCEDURE "public"."set_current_timestamp_updated_at"();

COMMENT ON TRIGGER "set_public_customers_updated_at" ON "public"."customers" IS 'trigger to set value of column "updated_at" to current timestamp on row update';

CREATE EXTENSION IF NOT EXISTS pgcrypto;