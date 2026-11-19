-- Keep the extension version and required index maintenance in one transaction.
-- If any rebuild fails, the version stays old and startup retries the upgrade.
DO $upgrade$
DECLARE
    installed_version pg_catalog.text;
    available_version pg_catalog.text;
    rebuild_vectors pg_catalog.bool;
    vector_type pg_catalog.oid;
    target_index record;
BEGIN
    SELECT installed.extversion, available.default_version
    INTO installed_version, available_version
    FROM pg_catalog.pg_extension AS installed
    JOIN pg_catalog.pg_available_extensions AS available
        ON available.name = installed.extname
    WHERE installed.extname = 'pg_search';

    IF NOT FOUND OR installed_version = available_version THEN
        RETURN;
    END IF;

    -- Only crossing the 0.26 storage boundary needs this maintenance. Do not
    -- rebuild indexes on ordinary restarts or subsequent 0.26 patch upgrades.
    rebuild_vectors := COALESCE(
        pg_catalog.regexp_match(installed_version, '^([0-9]+)[.]([0-9]+)')::pg_catalog.int4[] < ARRAY[0, 26]
        AND pg_catalog.regexp_match(available_version, '^([0-9]+)[.]([0-9]+)')::pg_catalog.int4[] >= ARRAY[0, 26],
        false
    );

    ALTER EXTENSION pg_search UPDATE;

    IF NOT rebuild_vectors THEN
        RETURN;
    END IF;

    SELECT datatype.oid INTO STRICT vector_type
    FROM pg_catalog.pg_type AS datatype
    JOIN pg_catalog.pg_depend AS dependency
        ON dependency.classid = 'pg_catalog.pg_type'::pg_catalog.regclass
        AND dependency.objid = datatype.oid
        AND dependency.refclassid = 'pg_catalog.pg_extension'::pg_catalog.regclass
        AND dependency.deptype = 'e'
    JOIN pg_catalog.pg_extension AS extension
        ON extension.oid = dependency.refobjid
    WHERE extension.extname = 'vector' AND datatype.typname = 'vector';

    FOR target_index IN
        WITH candidates AS (
            SELECT index_relation.oid, index_relation.relkind,
                index_namespace.nspname AS index_schema,
                index_relation.relname AS index_name,
                table_namespace.nspname AS table_schema,
                table_relation.relname AS table_name,
                obsolete.option_names, obsolete.option_sql, obsolete.description,
                EXISTS (
                    SELECT FROM pg_catalog.unnest(index_definition.indclass::pg_catalog.oid[]) AS class_oid
                    JOIN pg_catalog.pg_opclass AS operator_class ON operator_class.oid = class_oid
                    WHERE operator_class.opcintype = vector_type
                ) AS has_vector
            FROM pg_catalog.pg_index AS index_definition
            JOIN pg_catalog.pg_class AS index_relation ON index_relation.oid = index_definition.indexrelid
            JOIN pg_catalog.pg_namespace AS index_namespace ON index_namespace.oid = index_relation.relnamespace
            JOIN pg_catalog.pg_class AS table_relation ON table_relation.oid = index_definition.indrelid
            JOIN pg_catalog.pg_namespace AS table_namespace ON table_namespace.oid = table_relation.relnamespace
            JOIN pg_catalog.pg_depend AS dependency
                ON dependency.classid = 'pg_catalog.pg_am'::pg_catalog.regclass
                AND dependency.objid = index_relation.relam
                AND dependency.refclassid = 'pg_catalog.pg_extension'::pg_catalog.regclass
                AND dependency.deptype = 'e'
            JOIN pg_catalog.pg_extension AS extension ON extension.oid = dependency.refobjid
            LEFT JOIN LATERAL (
                SELECT pg_catalog.array_agg(option_name ORDER BY option_name) AS option_names,
                    pg_catalog.string_agg(pg_catalog.format('%I', option_name), ', ' ORDER BY option_name) AS option_sql,
                    pg_catalog.string_agg(pg_catalog.format('%s=%s', option_name, option_value), ', ' ORDER BY option_name) AS description
                FROM pg_catalog.pg_options_to_table(index_relation.reloptions)
                WHERE option_name IN (
                    'centroid_ratio', 'training_samples_per_centroid',
                    'cluster_replication', 'bounds_scope'
                )
            ) AS obsolete ON true
            WHERE extension.extname = 'pg_search' AND index_relation.relkind IN ('i', 'I')
        )
        SELECT * FROM candidates WHERE has_vector OR option_names IS NOT NULL
        ORDER BY relkind = 'I' DESC, oid
    LOOP
        IF target_index.option_names IS NOT NULL THEN
            RAISE NOTICE 'Resetting obsolete pg_search options on %.% to new defaults: %',
                target_index.index_schema, target_index.index_name, target_index.description;

            IF target_index.relkind = 'I' THEN
                -- PostgreSQL rejects ALTER INDEX RESET on partitioned parents.
                -- Remove only the obsolete AM options, preserving the index OID,
                -- child attachments and dependent objects. Lock the parent table
                -- against concurrent partition DDL; the catalog update invalidates
                -- cached relation metadata just like other pg_class updates.
                EXECUTE pg_catalog.format('LOCK TABLE ONLY %I.%I IN ACCESS EXCLUSIVE MODE',
                    target_index.table_schema, target_index.table_name);
                UPDATE pg_catalog.pg_class AS parent
                SET reloptions = (
                    SELECT pg_catalog.array_agg(option_value ORDER BY ordinal)
                    FROM pg_catalog.unnest(parent.reloptions) WITH ORDINALITY AS options(option_value, ordinal)
                    WHERE NOT pg_catalog.split_part(option_value, '=', 1) = ANY(target_index.option_names)
                )
                WHERE parent.oid = target_index.oid;
            ELSE
                EXECUTE pg_catalog.format('ALTER INDEX %I.%I RESET (%s)',
                    target_index.index_schema, target_index.index_name, target_index.option_sql);
            END IF;
        END IF;

        -- Partitioned parents have no storage. Rebuild their physical children,
        -- including every vector field irrespective of quantization settings.
        IF target_index.relkind = 'i' THEN
            RAISE NOTICE 'Rebuilding pg_search index %.% for 0.26 vector storage',
                target_index.index_schema, target_index.index_name;
            EXECUTE pg_catalog.format('REINDEX INDEX %I.%I',
                target_index.index_schema, target_index.index_name);
        END IF;
    END LOOP;
END;
$upgrade$;
