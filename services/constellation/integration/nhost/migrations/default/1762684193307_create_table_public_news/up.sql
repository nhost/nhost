CREATE TABLE "public"."news" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "is_public" boolean NOT NULL DEFAULT false, "title" text NOT NULL, "content" text NOT NULL, "department_id" uuid NOT NULL, "author_id" uuid NOT NULL, PRIMARY KEY ("id") , UNIQUE ("title"), FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON UPDATE CASCADE ON DELETE CASCADE, FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE);
CREATE OR REPLACE FUNCTION "public"."set_current_timestamp_updated_at"()
RETURNS TRIGGER AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updated_at" = NOW();
  RETURN _new;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "set_public_news_updated_at"
BEFORE UPDATE ON "public"."news"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updated_at"();
COMMENT ON TRIGGER "set_public_news_updated_at" ON "public"."news"
IS 'trigger to set value of column "updated_at" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;
