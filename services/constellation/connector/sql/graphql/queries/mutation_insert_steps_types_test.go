package queries_test

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
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
// A generated identity and generated text, plus 20 physical defaulted types,
// feed a single composite manual relationship. Exact ::text equality checks
// that JSON whitespace/duplicate keys, special floats and NULL array entries
// survive transport without a select-filtered parent reread. bpchar returning
// is checked separately against native to_json, which retains padding.
//
//nolint:cyclop // One matrix verifies capture, returned rows and 22 exact catalog types.
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
 code char(5) DEFAULT 'ab', uid uuid DEFAULT '550e8400-e29b-41d4-a716-446655440000'
);
CREATE TABLE typed_child (
 child_key integer PRIMARY KEY, id bigint, gen text, geom geometry(Point,4326),
 geog geography(Point,4326), num numeric, num_inf numeric, num_nan numeric,
 f_nan float8, f_pos float8, f_neg float8, b bytea, raw json, jb jsonb,
 ts timestamptz, iv interval, a integer[], en probe_enum, dom probe_domain,
 ci citext, tree ltree, code char(5), uid uuid,
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
		"f_neg", "b", "raw", "jb", "ts", "iv", "a", "en", "dom", "ci", "tree", "code", "uid",
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
			Input: `mutation {insert_typed_one(object:{num:123,code:"ab",children:{data:[{child_key:1}]}}){id gen code children_by_id{child_key id gen}}}`,
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

	var nested struct {
		Code string `json:"code"`
	}

	nestedJSON, ok := result["insert_typed_one"].(jsontext.Value)
	if !ok {
		t.Fatalf("nested returning type = %T", result["insert_typed_one"])
	}

	if err := json.Unmarshal(nestedJSON, &nested); err != nil {
		t.Fatalf("decode nested returning: %v", err)
	}

	var storedJSON string
	if err := pool.QueryRow(t.Context(), `SELECT to_json(code) FROM typed WHERE id = 1`).
		Scan(&storedJSON); err != nil {
		t.Fatal(err)
	}

	var storedCode string
	if err := json.Unmarshal([]byte(storedJSON), &storedCode); err != nil {
		t.Fatalf("decode stored bpchar: %v", err)
	}

	flatDoc, err := parser.ParseQuery(&ast.Source{
		Input: `mutation {insert_typed_one(object:{num:456,code:"ab"}){code}}`,
	})
	if err != nil {
		t.Fatal(err)
	}

	flatOps, err := roots.BuildQuery(flatDoc.Operations[0], flatDoc.Fragments, nil, "admin", nil)
	if err != nil {
		t.Fatal(err)
	}

	flatResult, err := client.ExecuteOperations(t.Context(), flatOps, slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatal(err)
	}

	var flat struct {
		Code string `json:"code"`
	}

	flatJSON, ok := flatResult["insert_typed_one"].(jsontext.Value)
	if !ok {
		t.Fatalf("flat returning type = %T", flatResult["insert_typed_one"])
	}

	if err := json.Unmarshal(flatJSON, &flat); err != nil {
		t.Fatalf("decode flat returning: %v", err)
	}

	if storedCode != "ab   " || nested.Code != storedCode || flat.Code != storedCode {
		t.Fatalf("bpchar nested = %q, flat = %q, stored = %q", nested.Code, flat.Code, storedCode)
	}

	assertDependentPhysicalColumns(t, pool, cols)
}

// TestDependentInsertCharFKLength rejects a longer captured parent key rather
// than truncating it to the child column's typmod and linking the wrong row.
func TestDependentInsertCharFKLength(t *testing.T) {
	t.Parallel()

	seed := testdb.NewPostgres(t, `CREATE TABLE char_parent (code char(6) PRIMARY KEY);
CREATE TABLE char_child (id integer PRIMARY KEY, parent_code char(3) REFERENCES char_parent(code));
INSERT INTO char_parent(code) VALUES ('abc');`)

	pool, err := postgres.Open(t.Context(), seed.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(pool.Close)

	md := &metadata.DatabaseMetadata{
		Name: "default", Kind: "postgres",
		Tables: []metadata.TableMetadata{
			{
				Table: metadata.TableSource{Schema: "public", Name: "char_parent"},
				ArrayRelationships: []metadata.ArrayRelationship{{
					Name: "children", Using: metadata.RelationshipUsing{
						ManualConfiguration: &metadata.ManualConfiguration{
							RemoteTable: metadata.TableSource{
								Schema: "public",
								Name:   "char_child",
							},
							ColumnMapping: map[string]string{"code": "parent_code"},
						},
					},
				}},
			},
			{Table: metadata.TableSource{Schema: "public", Name: "char_child"}},
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

	doc, err := parser.ParseQuery(&ast.Source{Input: `mutation {
insert_char_parent_one(object:{code:"abcdef",children:{data:[{id:1}]}}){code}
}`})
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

	_, err = client.ExecuteOperations(t.Context(), ops, slog.New(slog.DiscardHandler))

	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "22001" {
		t.Fatalf("overlength child FK: got %v, want SQLSTATE 22001", err)
	}

	var parentCount, childCount int
	if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM char_parent WHERE code = 'abcdef'`).
		Scan(&parentCount); err != nil {
		t.Fatal(err)
	}

	if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM char_child`).
		Scan(&childCount); err != nil {
		t.Fatal(err)
	}

	if parentCount != 0 || childCount != 0 {
		t.Fatalf("failed insert persisted rows: parent=%d child=%d", parentCount, childCount)
	}
}

func assertDependentPhysicalColumns(t *testing.T, pool postgres.Pool, cols []string) {
	t.Helper()

	checks := make([]string, len(cols))
	for i, col := range cols {
		checks[i] = `(SELECT "` + col + `"::text FROM typed WHERE id = 1) IS NOT DISTINCT FROM (SELECT "` + col + `"::text FROM typed_child)`
	}

	var exact bool
	if err := pool.QueryRow(t.Context(), "SELECT "+strings.Join(checks, " AND ")).
		Scan(&exact); err != nil {
		t.Fatal(err)
	}

	if !exact {
		for _, col := range cols {
			var left, right *string
			if err := pool.QueryRow(t.Context(), `SELECT (SELECT "`+col+`"::text FROM typed WHERE id = 1), (SELECT "`+col+`"::text FROM typed_child)`).
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
