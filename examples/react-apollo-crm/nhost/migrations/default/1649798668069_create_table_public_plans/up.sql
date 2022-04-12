CREATE TABLE "public"."plans" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" text NOT NULL, "stripe_price_id" text NOT NULL, "price" integer NOT NULL DEFAULT 0, PRIMARY KEY ("id") );
CREATE EXTENSION IF NOT EXISTS pgcrypto;
