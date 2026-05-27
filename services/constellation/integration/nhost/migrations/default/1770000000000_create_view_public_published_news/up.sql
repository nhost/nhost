CREATE VIEW "public"."published_news" AS
  SELECT id, created_at, updated_at, title, content, department_id, author_id
  FROM "public"."news"
  WHERE is_public = true;
