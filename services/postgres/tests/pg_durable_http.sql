\set ON_ERROR_STOP on

-- Keep this script standalone instead of depending on plugins.sql ordering.
CREATE EXTENSION IF NOT EXISTS pg_durable;

-- A PL/pgSQL DO block keeps one statement snapshot and cannot observe the
-- readiness row if the worker creates it after the block starts. A top-level
-- procedure may commit between polls so each attempt sees a fresh snapshot.
-- This is also why the check harness must not invoke this script with -1.
CREATE OR REPLACE PROCEDURE pg_temp.wait_for_pg_durable()
LANGUAGE plpgsql
AS $$
DECLARE
    durable_schema TEXT := df.duroxide_schema();
    is_ready BOOLEAN := FALSE;
BEGIN
    FOR attempt IN 1..300 LOOP
        IF to_regclass(format('%I._worker_ready', durable_schema)) IS NOT NULL THEN
            EXECUTE format(
                'SELECT EXISTS (SELECT 1 FROM %I._worker_ready WHERE schema_version >= 1)',
                durable_schema
            ) INTO is_ready;
        END IF;

        IF is_ready THEN
            RETURN;
        END IF;

        COMMIT;
        PERFORM pg_sleep(0.1);
    END LOOP;

    RAISE EXCEPTION 'pg_durable background worker did not become ready within 30 seconds';
END
$$;

CALL pg_temp.wait_for_pg_durable();
DROP PROCEDURE pg_temp.wait_for_pg_durable();

-- Make retries recover from a prior run that stopped after granting privileges.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_roles
        WHERE rolname = 'nhost_durable_http_test'
    ) THEN
        PERFORM df.revoke_usage('nhost_durable_http_test');
    END IF;
END
$$;
DROP ROLE IF EXISTS nhost_durable_http_test;

-- PostgreSQL reserves role names beginning with "pg_". pg_durable also
-- reconnects as the submitting role, so a role that starts workflows needs LOGIN.
CREATE ROLE nhost_durable_http_test LOGIN;
SELECT df.grant_usage('nhost_durable_http_test');

DO $$
BEGIN
    IF has_function_privilege(
        'nhost_durable_http_test',
        'df.http(text,text,text,jsonb,integer)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'df.grant_usage() unexpectedly granted df.http execution';
    END IF;

    IF has_function_privilege(
        'nhost_durable_http_test',
        'df.http_multipart(text,text,jsonb,jsonb,integer)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'df.grant_usage() unexpectedly granted df.http_multipart execution';
    END IF;
END
$$;

SET ROLE nhost_durable_http_test;
DO $$
BEGIN
    BEGIN
        PERFORM df.http('http://127.0.0.1:18080/', 'GET');
        RAISE EXCEPTION 'role without include_http was able to call df.http()';
    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL;
    END;
END
$$;
RESET ROLE;

SELECT df.grant_usage('nhost_durable_http_test', include_http => true);

DO $$
BEGIN
    IF NOT has_function_privilege(
        'nhost_durable_http_test',
        'df.http(text,text,text,jsonb,integer)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'include_http did not grant df.http execution';
    END IF;

    IF NOT has_function_privilege(
        'nhost_durable_http_test',
        'df.http_multipart(text,text,jsonb,jsonb,integer)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'include_http did not grant df.http_multipart execution';
    END IF;
END
$$;

-- The HTTP worker inherits the postmaster environment; native-tls needs the
-- image CA bundle to verify HTTPS endpoints.
COPY (SELECT '') TO PROGRAM 'test -s "${SSL_CERT_FILE:?}"';

-- Use a loopback responder instead of live third-party services. A bare private
-- IP is rejected by the Azure-only feature, so a successful request still
-- distinguishes http-allow-all while remaining deterministic and offline.
COPY (SELECT '') TO PROGRAM '/bin/sh /tests/pg_durable_http_server.sh start';

CREATE TEMP TABLE pg_durable_http_instances (
    scenario TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL
);
GRANT INSERT ON pg_durable_http_instances TO nhost_durable_http_test;

SET ROLE nhost_durable_http_test;
INSERT INTO pg_durable_http_instances (scenario, instance_id)
VALUES (
    'loopback',
    df.start(
        df.http('http://127.0.0.1:18080/ok', 'GET', NULL, NULL, 15),
        'nhost-http-loopback'
    )
);

INSERT INTO pg_durable_http_instances (scenario, instance_id)
VALUES (
    'redirect',
    df.start(
        df.http('http://127.0.0.1:18080/redirect', 'GET', NULL, NULL, 15),
        'nhost-http-redirect'
    )
);
RESET ROLE;

DO $$
DECLARE
    workflow_status TEXT;
    node_result JSONB;
BEGIN
    SELECT df.await_instance(instance_id, 60)
    INTO workflow_status
    FROM pg_durable_http_instances
    WHERE scenario = 'loopback';

    IF workflow_status <> 'completed' THEN
        RAISE EXCEPTION 'loopback HTTP workflow finished with status %', workflow_status;
    END IF;

    SELECT nodes.result::jsonb
    INTO node_result
    FROM df.nodes AS nodes
    JOIN pg_durable_http_instances AS test
        ON test.instance_id = nodes.instance_id
    WHERE test.scenario = 'loopback'
      AND nodes.node_type = 'HTTP';

    IF node_result IS NULL
       OR (node_result->>'ok')::boolean IS NOT TRUE
       OR (node_result->>'status')::integer <> 200 THEN
        RAISE EXCEPTION 'loopback HTTP request did not succeed: %', node_result;
    END IF;
END
$$;

DO $$
DECLARE
    workflow_status TEXT;
    node_result JSONB;
    http_status INTEGER;
BEGIN
    SELECT df.await_instance(instance_id, 60)
    INTO workflow_status
    FROM pg_durable_http_instances
    WHERE scenario = 'redirect';

    IF workflow_status <> 'completed' THEN
        RAISE EXCEPTION 'redirect HTTP workflow finished with status %', workflow_status;
    END IF;

    SELECT nodes.result::jsonb
    INTO node_result
    FROM df.nodes AS nodes
    JOIN pg_durable_http_instances AS test
        ON test.instance_id = nodes.instance_id
    WHERE test.scenario = 'redirect'
      AND nodes.node_type = 'HTTP';

    http_status := (node_result->>'status')::integer;
    IF http_status IS NULL OR http_status NOT BETWEEN 300 AND 399 THEN
        RAISE EXCEPTION 'pg_durable followed an HTTP redirect: %', node_result;
    END IF;
END
$$;

DROP TABLE pg_durable_http_instances;
SELECT df.revoke_usage('nhost_durable_http_test');
DROP ROLE nhost_durable_http_test;

SELECT 'pg_durable HTTP checks passed' AS result;
