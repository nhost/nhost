CREATE TABLE "public"."article" (
    "id" SERIAL,
    "title" text NOT NULL,
    "content" text NOT NULL,
    "author_id" integer NOT NULL,
    PRIMARY KEY ("id")
);
CREATE EXTENSION IF NOT EXISTS pgcrypto;