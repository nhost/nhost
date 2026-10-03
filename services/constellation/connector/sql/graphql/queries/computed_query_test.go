package queries_test

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	groupedagg "github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/groupedaggregate"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

const computedFixtureDir = "../../../../integration/"

func computedTestFixture(
	t *testing.T,
	sessionFunction ...bool,
) (queries.Roots, *pgxpool.Pool, *introspection.Objects, *metadata.DatabaseMetadata, *groupedagg.Ops) {
	t.Helper()

	ddl, err := os.ReadFile(
		computedFixtureDir + "nhost/migrations/default/1790001000000_computed_fields/up.sql",
	)
	if err != nil {
		t.Fatal(err)
	}

	seed, err := os.ReadFile(computedFixtureDir + "nhost/seeds/default/40-computed-fields.sql")
	if err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile(computedFixtureDir + "computedfields/testdata/metadata.json")
	if err != nil {
		t.Fatal(err)
	}

	md, err := metadata.FromHasuraJSON(raw)
	if err != nil {
		t.Fatal(err)
	}

	ddl = append(ddl, []byte(`
CREATE FUNCTION cf_select.items_from_function() RETURNS SETOF cf_select.items
LANGUAGE sql STABLE AS $$ SELECT id, owner_id, label, amount, payload FROM cf_select.items ORDER BY id $$;
CREATE FUNCTION cf_select.item_owner(item cf_select.items) RETURNS integer LANGUAGE sql STABLE
AS $$ SELECT item.owner_id $$;
CREATE FUNCTION cf_select.item_nullable(item cf_select.items) RETURNS text LANGUAGE sql STABLE
AS $$ SELECT CASE WHEN item.id = 1 THEN NULL::text ELSE item.label END $$;
CREATE FUNCTION cf_select.item_raises(item cf_select.items) RETURNS integer LANGUAGE sql STABLE
AS $$ SELECT 1 / (item.id - 1) $$;
CREATE FUNCTION cf_select.item_total(item cf_select.items) RETURNS numeric LANGUAGE sql STABLE
AS $$ SELECT item.amount $$;
CREATE FUNCTION cf_select.item_when(item cf_select.items) RETURNS date LANGUAGE sql STABLE
AS $$ SELECT date '2026-01-02' + item.id - 1 $$;
CREATE FUNCTION cf_select.item_uuid(item cf_select.items) RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE FUNCTION cf_select.item_active(item cf_select.items) RETURNS boolean LANGUAGE sql STABLE
AS $$ SELECT item.id = 1 $$;
`)...)

	md.Databases[0].Functions = append(md.Databases[0].Functions, metadata.FunctionMetadata{
		Function:    metadata.FunctionSource{Schema: "cf_select", Name: "items_from_function"},
		Permissions: []metadata.FunctionPermission{{Role: "cf_reader"}},
	})
	for _, name := range []string{"item_owner", "item_nullable", "item_raises", "item_total", "item_when", "item_uuid", "item_active"} {
		md.Databases[0].Tables[0].ComputedFields = append(
			md.Databases[0].Tables[0].ComputedFields,
			metadata.ComputedField{
				Name: name,
				Definition: metadata.ComputedFieldDefinition{Function: metadata.FunctionSource{
					Schema: "cf_select", Name: name,
				}},
			},
		)
	}

	for i := range md.Databases[0].Tables[0].SelectPermissions {
		perm := &md.Databases[0].Tables[0].SelectPermissions[i]
		if perm.Role == "cf_reader" {
			perm.Permission.ComputedFields = append(
				perm.Permission.ComputedFields,
				"item_owner",
				"item_nullable",
				"item_raises",
				"item_total",
				"item_when",
				"item_uuid",
				"item_active",
			)
		}
	}

	md.Databases[0].Tables[0].ArrayRelationships = append(
		md.Databases[0].Tables[0].ArrayRelationships,
		metadata.ArrayRelationship{
			Name: "tags",
			Using: metadata.RelationshipUsing{ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
				Table: metadata.TableSource{
					Schema: "cf_select",
					Name:   "tags",
				},
				Columns: []string{"item_id"},
			}},
		},
	)

	// A test-only array relationship exercises aggregate filters over the
	// computed target without changing the startup metadata/Hasura fixtures.
	md.Databases[0].Tables[1].ArrayRelationships = append(
		md.Databases[0].Tables[1].ArrayRelationships,
		metadata.ArrayRelationship{
			Name: "item_copies",
			Using: metadata.RelationshipUsing{ManualConfiguration: &metadata.ManualConfiguration{
				RemoteTable:   metadata.TableSource{Schema: "cf_select", Name: "items"},
				ColumnMapping: map[string]string{"item_id": "id"},
			}},
		},
	)

	md.Databases[0].Tables[1].ObjectRelationships = append(
		md.Databases[0].Tables[1].ObjectRelationships,
		metadata.ObjectRelationship{
			Name: "item", Using: metadata.RelationshipUsing{ForeignKeyColumns: []string{"item_id"}},
		},
	)
	if len(sessionFunction) > 0 && sessionFunction[0] {
		ddl = append(ddl, []byte(`
CREATE FUNCTION cf_select.session_label(item cf_select.items, session jsonb)
RETURNS text LANGUAGE sql STABLE AS $$ SELECT item.label || ':' || (session->>'x-hasura-user-id') $$;
CREATE FUNCTION cf_select.session_payload(item cf_select.items, session jsonb)
RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT to_jsonb(item.label || ':' || (session->>'x-hasura-user-id')) $$;
`)...)
		table := &md.Databases[0].Tables[0]

		table.ComputedFields = append(table.ComputedFields, metadata.ComputedField{
			Name: "session_label", Definition: metadata.ComputedFieldDefinition{
				Function: metadata.FunctionSource{
					Schema: "cf_select",
					Name:   "session_label",
				},
				SessionArgument: "session",
			},
		})

		table.ComputedFields = append(table.ComputedFields, metadata.ComputedField{
			Name: "session_payload", Definition: metadata.ComputedFieldDefinition{
				Function: metadata.FunctionSource{
					Schema: "cf_select",
					Name:   "session_payload",
				},
				SessionArgument: "session",
			},
		})
		for i := range table.SelectPermissions {
			if table.SelectPermissions[i].Role == "cf_reader" {
				table.SelectPermissions[i].Permission.ComputedFields = append(
					table.SelectPermissions[i].Permission.ComputedFields,
					"session_label", "session_payload",
				)
			}
		}
	}

	pool := testdb.NewPostgres(t, string(ddl), string(seed))

	pgPool, err := postgres.Open(t.Context(), pool.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatal(err)
	}

	client := postgres.NewClient(pgPool)
	t.Cleanup(client.Close)

	objects, err := client.Introspect(t.Context(), &md.Databases[0])
	if err != nil {
		t.Fatal(err)
	}

	caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())
	caps.SupportsComputedScalarSelection = true

	roots, grouped, err := queries.BuildRoots(
		objects,
		&md.Databases[0],
		dialect.NewPostgresDialect(),
		caps,
	)
	if err != nil {
		t.Fatal(err)
	}

	return roots, pool, objects, &md.Databases[0], grouped
}

func computedOperation(
	t *testing.T,
	roots queries.Roots,
	query string,
	session map[string]any,
) core.SQLOperation {
	t.Helper()

	doc, err := parser.ParseQuery(&ast.Source{Input: query})
	if err != nil {
		t.Fatal(err)
	}

	ops, err := roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, "cf_reader", session)
	if err != nil {
		t.Fatal(err)
	}

	if len(ops) != 1 {
		t.Fatalf("operations = %d", len(ops))
	}

	return ops[0]
}

func computedResult(t *testing.T, pool *pgxpool.Pool, op core.SQLOperation) any {
	t.Helper()

	var raw []byte
	if err := pool.QueryRow(t.Context(), op.SQL, op.Parameters...).Scan(&raw); err != nil {
		t.Fatalf("SQL: %v\n%s", err, op.SQL)
	}

	var result any
	if err := json.Unmarshal(raw, &result); err != nil {
		t.Fatal(err)
	}

	return result
}

func TestComputedScalarQuerySelections(t *testing.T) {
	t.Parallel()
	//nolint:dogsled // The fixture returns roots, pool, objects, metadata and grouped ops; each test selects its needed values.
	roots, pool, _, _, _ := computedTestFixture(t)

	cases := []struct {
		name, query string
		expected    any
	}{
		{
			"list",
			`query { cf_select_items(order_by:{id:asc}) { id item_label item_score(args:{multiplier:2}) item_second(args:{multiplier:2}) item_payload(path:"status") } }`,
			[]any{
				map[string]any{
					"id":           float64(1),
					"item_label":   "first",
					"item_score":   float64(25),
					"item_second":  float64(25),
					"item_payload": "ready",
				},
				map[string]any{
					"id":           float64(2),
					"item_label":   "second",
					"item_score":   float64(6.5),
					"item_second":  float64(6.5),
					"item_payload": "waiting",
				},
			},
		},
		{
			"default",
			`query { cf_select_items(where:{id:{_eq:1}}) { id item_score } }`,
			[]any{map[string]any{"id": float64(1), "item_score": float64(12.5)}},
		},
		{
			"by-pk",
			`query { cf_select_items_by_pk(id:2) { item_label item_second(args:{multiplier:2}) } }`,
			map[string]any{"item_label": "second", "item_second": float64(6.5)},
		},
		{
			"nested",
			`query { cf_select_tags(where:{id:{_eq:1}}) { item { item_label item_second(args:{multiplier:2}) } } }`,
			[]any{
				map[string]any{
					"item": map[string]any{"item_label": "first", "item_second": float64(25)},
				},
			},
		},
		{
			"function",
			`query { items_from_function(where:{id:{_eq:1}}) { item_label item_score } }`,
			[]any{map[string]any{"item_label": "first", "item_score": float64(12.5)}},
		},
		{
			"complete-row",
			`query { cf_select_items(order_by:{id:asc}) { item_owner item_nullable } }`,
			[]any{
				map[string]any{"item_owner": float64(1), "item_nullable": nil},
				map[string]any{"item_owner": float64(2), "item_nullable": "second"},
			},
		},
		{
			"aggregate",
			`query { cf_select_items_aggregate(order_by:{id:asc}) { nodes { item_label item_score(args:{multiplier:2}) } } }`,
			map[string]any{
				"nodes": []any{
					map[string]any{"item_label": "first", "item_score": float64(25)},
					map[string]any{"item_label": "second", "item_score": float64(6.5)},
				},
			},
		},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			op := computedOperation(t, roots, tt.query, nil)

			got := computedResult(t, pool, op)
			if tt.expected != nil && !reflect.DeepEqual(got, tt.expected) {
				t.Fatalf("result: %#v, want %#v", got, tt.expected)
			}
		})
	}

	doc, err := parser.ParseQuery(&ast.Source{Input: `query { cf_select_items { item_label } }`})
	if err != nil {
		t.Fatal(err)
	}

	_, err = roots.BuildQuery(doc.Operations[0], doc.Fragments, nil, "cf_no_grant", nil)
	if err == nil {
		t.Fatal("denied role executed ungranted computed selection")
	}
}
