alter table "public"."books"
  add constraint "books_writer_id_fkey"
  foreign key ("writer_id")
  references "auth"."users"
  ("id") on update restrict on delete restrict;
