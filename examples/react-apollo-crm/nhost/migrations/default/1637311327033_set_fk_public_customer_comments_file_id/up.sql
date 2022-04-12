ALTER TABLE
  "public"."customer_comments"
ADD
  CONSTRAINT "customer_comments_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "storage"."files" ("id") ON UPDATE RESTRICT ON DELETE CASCADE;