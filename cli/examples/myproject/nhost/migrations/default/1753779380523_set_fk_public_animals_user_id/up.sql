alter table "public"."animals"
  add constraint "animals_user_id_fkey"
  foreign key ("user_id")
  references "auth"."users"
  ("id") on update set null on delete set null;
