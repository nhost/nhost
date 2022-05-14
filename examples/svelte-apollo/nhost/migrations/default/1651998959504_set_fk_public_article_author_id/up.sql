alter table "public"."articles"
  add constraint "article_author_id_fkey"
  foreign key ("author_id")
  references "public"."authors"
  ("id") on update restrict on delete restrict;
