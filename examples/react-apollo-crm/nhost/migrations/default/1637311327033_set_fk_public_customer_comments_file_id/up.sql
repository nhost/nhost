alter table "public"."customer_comments"
  add constraint "customer_comments_file_id_fkey"
  foreign key ("file_id")
  references "storage"."files"
  ("id") on update restrict on delete cascade;
