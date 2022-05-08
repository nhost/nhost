CREATE TABLE "public"."author" (
    "id" SERIAL,
    "name" text NOT NULL,
    PRIMARY KEY ("id")
);
CREATE EXTENSION IF NOT EXISTS pgcrypto;