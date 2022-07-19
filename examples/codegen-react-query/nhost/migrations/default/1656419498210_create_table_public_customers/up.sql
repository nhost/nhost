CREATE TABLE "public"."customers" ("id" serial NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "name" text NOT NULL, PRIMARY KEY ("id") );
