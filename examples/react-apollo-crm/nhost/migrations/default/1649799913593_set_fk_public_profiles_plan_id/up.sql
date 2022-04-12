alter table "public"."profiles"
  add constraint "profiles_plan_id_fkey"
  foreign key ("plan_id")
  references "public"."plans"
  ("id") on update restrict on delete restrict;
