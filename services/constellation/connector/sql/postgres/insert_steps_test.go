package postgres_test

import (
	"log/slog"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
)

// Exercises the driver with hand-rendered capture/replay SQL as an independent
// codec control. The GraphQL/planner product-path type matrix lives in the
// queries package; this test compares ::text values from both physical rows.
//
//nolint:cyclop // One matrix verifies 21 physical column types in a transaction.
func TestDependentInsertPhysicalTypeRoundTrip(
	t *testing.T,
) {
	t.Parallel()

	ddl := `CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS ltree;
CREATE TYPE probe_enum AS ENUM ('red','blue');
CREATE DOMAIN probe_domain AS numeric(38,18) CHECK (VALUE >= 0);
CREATE TABLE typed (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 gen text GENERATED ALWAYS AS (id::text || '-generated') STORED,
 geom geometry(Point,4326), geog geography(Point,4326), num numeric,
 num_inf numeric, num_nan numeric, f_nan float8, f_pos float8, f_neg float8,
 b bytea, raw json, jb jsonb, ts timestamptz, iv interval,
 a integer[], en probe_enum, dom probe_domain, ci citext, tree ltree, uid uuid
);
CREATE TABLE replay (LIKE typed INCLUDING ALL);
CREATE TABLE fk_parent (id uuid, label citext, PRIMARY KEY(id,label));
CREATE TABLE fk_child (id uuid, label citext, FOREIGN KEY(id,label) REFERENCES fk_parent(id,label));`
	seedPool := testdb.NewPostgres(t, ddl)

	pool, err := postgres.Open(t.Context(), seedPool.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	t.Cleanup(pool.Close)

	columns := []string{
		"id",
		"gen",
		"geom",
		"geog",
		"num",
		"num_inf",
		"num_nan",
		"f_nan",
		"f_pos",
		"f_neg",
		"b",
		"raw",
		"jb",
		"ts",
		"iv",
		"a",
		"en",
		"dom",
		"ci",
		"tree",
		"uid",
	}
	selects := make([]string, len(columns))

	replay := make([]string, 0, len(columns)-1)
	for i, col := range columns {
		selects[i] = `"` + col + `"::text AS "` + col + `"`
		if col != "gen" {
			replay = append(replay, `"`+col+`"`)
		}
	}

	insert := `WITH mutation_result AS (INSERT INTO typed(geom,geog,num,num_inf,num_nan,f_nan,f_pos,f_neg,b,raw,jb,ts,iv,a,en,dom,ci,tree,uid) VALUES (
ST_SetSRID(ST_MakePoint(1.123456789,2.123456789),4326),
ST_GeogFromText('SRID=4326;POINT(1.123456789 2.123456789)'),
12345678901234567890.123456789012345678,'Infinity','NaN','NaN','Infinity','-Infinity',
decode('00ff5c','hex'),'{  "dup" : 1, "dup" : 2, "space" : [ 1, 2 ] }'::json,
'{"z":1,"a":2}'::jsonb,'2024-05-06 12:34:56.123456+09:00',
'1 year 2 months 3 days 04:05:06.123456',ARRAY[1,NULL,3],
'red',123456789.123456789012345678,'MiXeD','Top.Child',
'550e8400-e29b-41d4-a716-446655440000') RETURNING *)
SELECT COALESCE(json_agg(row_to_json("_physical")), '[]'::json)
FROM (SELECT ` + strings.Join(
		selects,
		",",
	) + ` FROM mutation_result) "_physical"`
	types := make(map[string]string, len(columns))

	typeRows, err := pool.Query(
		t.Context(),
		`SELECT a.attname, format('%I.%I', ns.nspname, ty.typname)
 FROM pg_attribute a JOIN pg_type ty ON ty.oid=a.atttypid
 JOIN pg_namespace ns ON ns.oid=ty.typnamespace
 WHERE a.attrelid='public.typed'::regclass AND a.attnum>0 AND NOT a.attisdropped`,
	)
	if err != nil {
		t.Fatal(err)
	}

	for typeRows.Next() {
		var name, typ string
		if err := typeRows.Scan(&name, &typ); err != nil {
			t.Fatal(err)
		}

		types[name] = typ
	}

	if err := typeRows.Err(); err != nil {
		t.Fatal(err)
	}

	typeRows.Close()

	casts := make([]string, len(columns))
	for i, col := range columns {
		casts[i] = `(value ->> '` + col + `')::text::` + types[col] + ` AS "` + col + `"`
	}

	final := `WITH mutation_result AS (
 SELECT ` + strings.Join(casts, ",") + ` FROM json_array_elements($1::json) AS "_rows"(value))
 INSERT INTO replay (` + strings.Join(replay, ",") + `) OVERRIDING SYSTEM VALUE
 SELECT ` + strings.Join(replay, ",") + ` FROM mutation_result RETURNING row_to_json(replay)`
	plan := &core.InsertPlan{
		Root: core.InsertLevel{Batch: &core.InsertStatement{
			SQL: insert, Parameters: nil, TableRef: `"public"."typed"`,
		}, Objects: nil},
		FinalSQL: final, FinalParameters: []any{nil}, Collection: false,
	}

	ops := []core.SQLOperation{{Name: "typed", Insert: plan}}
	if _, err := postgres.NewClient(pool).
		ExecuteOperations(t.Context(), ops, slog.New(slog.DiscardHandler)); err != nil {
		t.Fatalf("physical capture/replay: %v", err)
	}

	checks := make([]string, len(columns))
	for i, col := range columns {
		checks[i] = `(SELECT "` + col + `"::text FROM typed) IS NOT DISTINCT FROM (SELECT "` + col + `"::text FROM replay)`
	}

	var exact bool
	if err := pool.QueryRow(t.Context(), "SELECT "+strings.Join(checks, " AND ")).
		Scan(&exact); err != nil ||
		!exact {
		for _, col := range columns {
			var original, restored *string
			if qErr := pool.QueryRow(t.Context(), `SELECT (SELECT "`+col+`"::text FROM typed), (SELECT "`+col+`"::text FROM replay)`).
				Scan(&original, &restored); qErr != nil {
				t.Logf("%s query: %v", col, qErr)
			} else if original == nil ||
				restored == nil {
				t.Logf("%s: original=%v restored=%v", col, original, restored)
			} else if *original != *restored {
				t.Logf("%s: %q != %q", col, *original, *restored)
			}
		}

		t.Fatalf("21-column exact text roundtrip = %v, err = %v", exact, err)
	}
	// Composite FK source columns are captured as text and rebound via
	// independently typed parameters; neither a PK lookup nor SQL interpolation
	// is involved in dependent mutation execution.
	if err := pool.Exec(
		t.Context(),
		`INSERT INTO fk_parent VALUES ('550e8400-e29b-41d4-a716-446655440000','Quoted λ')`,
	); err != nil {
		t.Fatal(err)
	}

	var id, label string
	if err := pool.QueryRow(t.Context(), `SELECT id::text,label::text FROM fk_parent`).
		Scan(&id, &label); err != nil {
		t.Fatal(err)
	}

	if err := pool.Exec(
		t.Context(),
		`INSERT INTO fk_child VALUES ($1::text::uuid,$2::text::citext)`,
		id,
		label,
	); err != nil {
		t.Fatal(err)
	}

	var joined bool
	if err := pool.QueryRow(t.Context(), `SELECT EXISTS(SELECT 1 FROM fk_child JOIN fk_parent USING(id,label))`).
		Scan(&joined); err != nil ||
		!joined {
		t.Fatalf("composite FK transport = %v, err = %v", joined, err)
	}
}
