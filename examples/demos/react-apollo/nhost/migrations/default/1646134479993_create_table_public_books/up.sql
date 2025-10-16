CREATE TABLE "public"."books" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "title" text NOT NULL, PRIMARY KEY ("id") );
CREATE EXTENSION IF NOT EXISTS pgcrypto;
