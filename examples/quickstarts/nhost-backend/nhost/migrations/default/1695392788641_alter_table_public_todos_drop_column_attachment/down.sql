alter table "public"."todos" alter column "attachment" drop not null;
alter table "public"."todos" add column "attachment" uuid;
