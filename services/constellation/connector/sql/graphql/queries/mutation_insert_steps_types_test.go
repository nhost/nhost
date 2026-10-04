package queries_test

import (
	"fmt"
	"log/slog"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// TestDependentInsertPhysicalTypesProductPath drives the catalog type lookup,
// planner's per-column capture/rebind and driver transaction through GraphQL.
// A generated identity and generated text, plus 19 physical defaulted types,
// feed a single composite manual relationship. Exact ::text equality checks
// that JSON whitespace/duplicate keys, special floats and NULL array entries
// survive transport without a select-filtered parent reread.
//
//nolint:cyclop // One matrix verifies capture, returned rows and 21 exact catalog types.
func TestDependentInsertPhysicalTypesProductPath(t *testing.T) {
	t.Parallel()

	ddl := `CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS ltree;
CREATE TYPE probe_enum AS ENUM ('red','blue');
CREATE DOMAIN probe_domain AS numeric(38,18) CHECK(VALUE >= 0);
CREATE TABLE typed (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 gen text GENERATED ALWAYS AS (id::text || '-generated') STORED,
 geom geometry(Point,4326) DEFAULT ST_SetSRID(ST_MakePoint(1.123456789,2.123456789),4326),
 geog geography(Point,4326) DEFAULT ST_GeogFromText('SRID=4326;POINT(1.123456789 2.123456789)'),
 num numeric DEFAULT 12345678901234567890.123456789012345678,
 num_inf numeric DEFAULT 'Infinity', num_nan numeric DEFAULT 'NaN',
 f_nan float8 DEFAULT 'NaN', f_pos float8 DEFAULT 'Infinity', f_neg float8 DEFAULT '-Infinity',
 b bytea DEFAULT decode('00ff5c','hex'),
 raw json DEFAULT '{  "dup" : 1, "dup" : 2, "space" : [ 1, 2 ] }'::json,
 jb jsonb DEFAULT '{"z":1,"a":2}'::jsonb,
 ts timestamptz DEFAULT '2024-05-06 12:34:56.123456+09:00',
 iv interval DEFAULT '1 year 2 months 3 days 04:05:06.123456',
 a integer[] DEFAULT ARRAY[1,NULL,3],
 en probe_enum DEFAULT 'red', dom probe_domain DEFAULT 123456789.123456789012345678,
 ci citext DEFAULT 'MiXeD', tree ltree DEFAULT 'Top.Child',
 uid uuid DEFAULT '550e8400-e29b-41d4-a716-446655440000'
);
CREATE TABLE typed_child (
 child_key integer PRIMARY KEY, id bigint, gen text, geom geometry(Point,4326),
 geog geography(Point,4326), num numeric, num_inf numeric, num_nan numeric,
 f_nan float8, f_pos float8, f_neg float8, b bytea, raw json, jb jsonb,
 ts timestamptz, iv interval, a integer[], en probe_enum, dom probe_domain,
 ci citext, tree ltree, uid uuid,
 FOREIGN KEY(id) REFERENCES typed(id)
);`
	seed := testdb.NewPostgres(t, ddl)

	pool, err := postgres.Open(t.Context(), seed.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(pool.Close)

	cols := []string{
		"id", "gen", "geom", "geog", "num", "num_inf", "num_nan", "f_nan", "f_pos",
		"f_neg", "b", "raw", "jb", "ts", "iv", "a", "en", "dom", "ci", "tree", "uid",
	}

	mapping := make(map[string]string, len(cols))
	for _, col := range cols {
		mapping[col] = col
	}

	md := &metadata.DatabaseMetadata{
		Name: "default",
		Kind: "postgres",
		Tables: []metadata.TableMetadata{
			{
				Table: metadata.TableSource{Schema: "public", Name: "typed"},
				ArrayRelationships: []metadata.ArrayRelationship{
					{Name: "children", Using: metadata.RelationshipUsing{
						ManualConfiguration: &metadata.ManualConfiguration{
							RemoteTable: metadata.TableSource{
								Schema: "public",
								Name:   "typed_child",
							},
							ColumnMapping: mapping,
						},
					}},
					{Name: "children_by_id", Using: metadata.RelationshipUsing{
						ManualConfiguration: &metadata.ManualConfiguration{
							RemoteTable: metadata.TableSource{
								Schema: "public",
								Name:   "typed_child",
							},
							ColumnMapping: map[string]string{"id": "id"},
						},
					}},
				},
			},
			{Table: metadata.TableSource{Schema: "public", Name: "typed_child"}},
		},
	}
	client := postgres.NewClient(pool)

	objects, err := client.Introspect(t.Context(), md)
	if err != nil {
		t.Fatal(err)
	}

	roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect())
	if err != nil {
		t.Fatal(err)
	}

	doc, err := parser.ParseQuery(
		&ast.Source{
			Input: `mutation {insert_typed_one(object:{num:123,children:{data:[{child_key:1}]}}){id gen children_by_id{child_key id gen}}}`,
		},
	)
	if err != nil {
		t.Fatal(err)
	}

	ops, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, "admin", nil)
	if err != nil {
		t.Fatal(err)
	}

	if len(ops) != 1 || ops[0].Insert == nil {
		t.Fatalf("missing dependent plan: %#v", ops)
	}

	result, err := client.ExecuteOperations(t.Context(), ops, slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatal(err)
	}

	if !strings.Contains(fmt.Sprint(result["insert_typed_one"]), `"child_key":1`) {
		t.Fatalf("nested returning = %v", result)
	}

	checks := make([]string, len(cols))
	for i, col := range cols {
		checks[i] = `(SELECT "` + col + `"::text FROM typed) IS NOT DISTINCT FROM (SELECT "` + col + `"::text FROM typed_child)`
	}

	var exact bool
	if err := pool.QueryRow(t.Context(), "SELECT "+strings.Join(checks, " AND ")).
		Scan(&exact); err != nil {
		t.Fatal(err)
	}

	if !exact {
		for _, col := range cols {
			var left, right *string
			if err := pool.QueryRow(t.Context(), `SELECT (SELECT "`+col+`"::text FROM typed), (SELECT "`+col+`"::text FROM typed_child)`).
				Scan(&left, &right); err != nil {
				t.Fatal(err)
			}

			if left == nil || right == nil || *left != *right {
				t.Logf("%s: %v != %v", col, left, right)
			}
		}

		t.Fatal("dependent physical type capture/rebind changed a value")
	}
}
