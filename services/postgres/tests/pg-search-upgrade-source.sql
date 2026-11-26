CREATE EXTENSION pg_search CASCADE;
DO $$
BEGIN
    IF (SELECT extversion FROM pg_extension WHERE extname = 'pg_search') <> '0.25.11' THEN
        RAISE EXCEPTION 'pg_search upgrade source must be 0.25.11';
    END IF;
END;
$$;

CREATE SCHEMA "search, old";
CREATE ROLE search_index_owner;
CREATE TABLE "search, old".items (id bigint, description text, embedding vector(3));
INSERT INTO "search, old".items
SELECT i, 'upgrade document ' || i, ARRAY[sin(i), cos(i), 1]::vector FROM generate_series(1, 128) AS i;
ALTER TABLE "search, old".items OWNER TO search_index_owner;

-- Both AM names must be discovered; these small vectors were unquantized.
CREATE INDEX "plain vector" ON "search, old".items USING bm25 (id, embedding vector_cosine_ops)
WITH (key_field = 'id', target_segment_count = 4);
CREATE TABLE "search, old".tuned_items (LIKE "search, old".items);
INSERT INTO "search, old".tuned_items SELECT * FROM "search, old".items;
ALTER TABLE "search, old".tuned_items OWNER TO search_index_owner;
CREATE INDEX "tuned vector" ON "search, old".tuned_items USING paradedb (id, embedding vector_cosine_ops)
WITH (key_field = 'id', centroid_ratio = 0.02, training_samples_per_centroid = 64,
      cluster_replication = 2, bounds_scope = 'native', target_segment_count = 4);
COMMENT ON INDEX "search, old"."tuned vector" IS 'keep the index''s comment';
CREATE VIEW "search, old".index_reference AS SELECT '"search, old"."tuned vector"'::regclass AS index_oid;

-- Do not rebuild ordinary text, btree or pgvector indexes unnecessarily.
CREATE TABLE "search, old".text_items AS SELECT id, description FROM "search, old".items;
CREATE INDEX text_only ON "search, old".text_items USING paradedb (id, description) WITH (key_field = 'id');
CREATE INDEX btree_only ON "search, old".items(id);
CREATE INDEX hnsw_only ON "search, old".items USING hnsw(embedding vector_cosine_ops);

CREATE TABLE "search, old".partitioned (id bigint, embedding vector(3)) PARTITION BY RANGE(id);
CREATE TABLE "search, old".partition_a PARTITION OF "search, old".partitioned FOR VALUES FROM (0) TO (100);
CREATE TABLE "search, old".partition_b PARTITION OF "search, old".partitioned FOR VALUES FROM (100) TO (200);
INSERT INTO "search, old".partitioned SELECT id, embedding FROM "search, old".items;
CREATE INDEX partitioned_vector ON "search, old".partitioned USING paradedb(id, embedding vector_cosine_ops)
WITH (key_field = 'id', centroid_ratio = 0.02, training_samples_per_centroid = 64,
      cluster_replication = 2, bounds_scope = 'native');
COMMENT ON INDEX "search, old".partitioned_vector IS 'keep the partitioned parent';

-- This last index fails option cleanup only after earlier indexes rebuilt.
CREATE TABLE "search, old".failure (id bigint, embedding vector(3));
INSERT INTO "search, old".failure SELECT id, embedding FROM "search, old".items;
CREATE INDEX fail_vector ON "search, old".failure USING paradedb(id, embedding vector_cosine_ops)
WITH (key_field = 'id', centroid_ratio = 0.02);

CREATE TABLE public.pg_search_upgrade_before AS
SELECT c.oid, c.relname, c.relkind, c.relfilenode, c.reloptions, c.relowner, c.reltablespace,
    obj_description(c.oid, 'pg_class') AS comment,
    i.indkey::text, i.indclass::text, i.indcollation::text, i.indoption::text,
    i.indexprs::text, i.indpred::text,
    (SELECT inhparent FROM pg_inherits WHERE inhrelid = c.oid) AS parent_index
FROM pg_class AS c
JOIN pg_index AS i ON i.indexrelid = c.oid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'search, old';

CREATE FUNCTION public.fail_pg_search_upgrade() RETURNS event_trigger LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT FROM pg_event_trigger_ddl_commands()
        WHERE objid = '"search, old".fail_vector'::regclass) THEN
        RAISE EXCEPTION 'deliberate pg_search maintenance failure';
    END IF;
END;
$$;
CREATE EVENT TRIGGER fail_pg_search_upgrade ON ddl_command_end
WHEN TAG IN ('ALTER INDEX') EXECUTE FUNCTION public.fail_pg_search_upgrade();

-- An independent database must still upgrade when maintenance fails in local.
CREATE DATABASE "search=old";
\connect dbname=search=old
CREATE EXTENSION pg_search CASCADE;
CREATE TABLE items(id bigint, embedding vector(3));
INSERT INTO items SELECT i, ARRAY[sin(i), cos(i), 1]::vector FROM generate_series(1, 128) AS i;
CREATE INDEX vector_idx ON items USING paradedb(id, embedding vector_cosine_ops) WITH (key_field = 'id');
CREATE TABLE before_upgrade AS SELECT oid, relfilenode FROM pg_class WHERE oid = 'vector_idx'::regclass;
