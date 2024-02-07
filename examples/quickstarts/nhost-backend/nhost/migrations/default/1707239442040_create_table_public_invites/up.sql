CREATE TABLE "public"."invites" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "inviter_name" varchar NOT NULL, "project_id" uuid NOT NULL, "email" varchar NOT NULL, "project_name" varchar NOT NULL, "created_at" timestamptz NOT NULL, "updated_at" timestamptz NOT NULL, PRIMARY KEY ("id") );
CREATE EXTENSION IF NOT EXISTS pgcrypto;
