alter table "public"."todos"
  add constraint "todos_category_fkey"
  foreign key ("category")
  references "public"."categories"
  ("value") on update restrict on delete restrict;
