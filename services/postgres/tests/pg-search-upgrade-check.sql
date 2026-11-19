DO $$
DECLARE
    changed pg_catalog.text;
    target_index record;
    segments pg_catalog.int8;
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_extension AS installed
        JOIN pg_available_extensions AS available ON available.name = installed.extname
        WHERE installed.extname = 'pg_search' AND installed.extversion = available.default_version
    ) THEN
        RAISE EXCEPTION 'pg_search did not finish upgrading';
    END IF;

    SELECT string_agg(before.relname, ', ') INTO changed
    FROM public.pg_search_upgrade_before AS before
    LEFT JOIN pg_class AS current ON current.oid = before.oid
    LEFT JOIN pg_index AS definition ON definition.indexrelid = current.oid
    WHERE current.oid IS NULL
        OR current.relname <> before.relname OR current.relkind <> before.relkind
        OR current.relowner <> before.relowner OR current.reltablespace <> before.reltablespace
        OR obj_description(current.oid, 'pg_class') IS DISTINCT FROM before.comment
        OR definition.indkey::text <> before.indkey
        OR definition.indclass::text <> before.indclass
        OR definition.indcollation::text <> before.indcollation
        OR definition.indoption::text <> before.indoption
        OR definition.indexprs::text IS DISTINCT FROM before.indexprs
        OR definition.indpred::text IS DISTINCT FROM before.indpred
        OR (SELECT inhparent FROM pg_inherits WHERE inhrelid = current.oid) IS DISTINCT FROM before.parent_index
        OR current.reloptions IS DISTINCT FROM (
            SELECT array_agg(option_value ORDER BY ordinal)
            FROM unnest(before.reloptions) WITH ORDINALITY AS options(option_value, ordinal)
            WHERE split_part(option_value, '=', 1) NOT IN (
                'centroid_ratio', 'training_samples_per_centroid', 'cluster_replication', 'bounds_scope'
            )
        )
        OR NOT definition.indisvalid OR NOT definition.indisready;
    IF changed IS NOT NULL THEN
        RAISE EXCEPTION 'index identity, definition, owner, comment, attachment or retained options changed: %', changed;
    END IF;

    SELECT string_agg(before.relname, ', ') INTO changed
    FROM public.pg_search_upgrade_before AS before JOIN pg_class AS current USING(oid)
    WHERE CASE WHEN before.relkind = 'i' AND before.relname NOT IN ('text_only', 'btree_only', 'hnsw_only')
        THEN current.relfilenode = before.relfilenode
        ELSE current.relfilenode <> before.relfilenode END;
    IF changed IS NOT NULL THEN
        RAISE EXCEPTION 'required rebuild missing or unrelated index rebuilt: %', changed;
    END IF;

    IF (SELECT index_oid FROM "search, old".index_reference) <> '"search, old"."tuned vector"'::regclass THEN
        RAISE EXCEPTION 'index-dependent view changed';
    END IF;

    FOR target_index IN
        SELECT index_relation.oid, index_relation.relname
        FROM pg_index AS definition
        JOIN pg_class AS index_relation ON index_relation.oid = definition.indexrelid
        JOIN pg_namespace AS namespace ON namespace.oid = index_relation.relnamespace
        JOIN pg_am AS method ON method.oid = index_relation.relam
        WHERE namespace.nspname = 'search, old' AND index_relation.relkind = 'i'
            AND method.amname IN ('bm25', 'paradedb')
            AND EXISTS (SELECT FROM unnest(definition.indclass::oid[]) AS class_oid
                JOIN pg_opclass AS operator_class ON operator_class.oid = class_oid
                WHERE operator_class.opcintype = 'vector'::regtype)
    LOOP
        -- This API raises the rebuild-required error on old vector storage.
        SELECT count(*) INTO segments FROM paradedb.vector_info(target_index.oid, 'embedding');
        IF segments = 0 THEN
            RAISE EXCEPTION 'index % has no readable vector segments', target_index.relname;
        END IF;
    END LOOP;
END;
$$;

-- Force a ParadeDB search instead of proving only that a heap scan works.
SELECT id FROM "search, old".items
WHERE id @@@ pdb.all() ORDER BY embedding <=> '[1,0,0]'::vector LIMIT 1;

-- Parent option cleanup must also make future partitions usable. Their index
-- definitions are cloned from the parent's stored reloptions.
CREATE TABLE "search, old".partition_c PARTITION OF "search, old".partitioned FOR VALUES FROM (200) TO (300);
INSERT INTO "search, old".partitioned VALUES (256, '[1,0,0]');
SELECT id FROM "search, old".partitioned
WHERE id @@@ pdb.all() ORDER BY embedding <=> '[1,0,0]'::vector LIMIT 1;

CREATE TABLE "search, old".fresh_items (LIKE "search, old".items);
INSERT INTO "search, old".fresh_items SELECT * FROM "search, old".items;
CREATE INDEX fresh_vector ON "search, old".fresh_items USING paradedb(id, embedding vector_cosine_ops)
WITH (vector_fields = '{"embedding":{"quantization":false}}');
CREATE TABLE public.pg_search_second_start_before AS
SELECT c.oid, c.relfilenode, c.reloptions
FROM pg_class AS c JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'search, old' AND c.relkind IN ('i','I');
