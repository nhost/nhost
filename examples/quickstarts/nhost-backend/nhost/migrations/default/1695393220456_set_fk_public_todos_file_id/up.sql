alter table "public"."todos"
  add constraint "todos_file_id_fkey"
  foreign key ("file_id")
  references "storage"."files"
  ("id") on update cascade on delete cascade;
