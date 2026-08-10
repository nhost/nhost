CREATE OR REPLACE VIEW "public"."content_feed" AS
  SELECT
    n.id,
    'news'::text AS source,
    n.title,
    n.content,
    n.created_at
  FROM "public"."news" n
  WHERE n.is_public = true

  UNION ALL

  SELECT
    k.id,
    'kb_entry'::text AS source,
    k.title,
    k.content,
    k.created_at
  FROM "public"."kb_entries" k;
