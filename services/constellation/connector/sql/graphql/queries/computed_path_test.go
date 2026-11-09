package queries_test

import (
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/metadata"
)

//nolint:cyclop,gocognit // Each path form asserts SQL binding, data or a structured validation error.
func TestComputedScalarJSONPaths(t *testing.T) {
	t.Parallel()
	//nolint:dogsled // Only the roots and isolated PostgreSQL pool are needed here.
	roots, pool, _, _, _ := computedTestFixture(t)

	tests := []struct {
		name, path string
		want       any
		invalid    bool
	}{
		{"bare", "status", "ready", false},
		{"dot", "status", "ready", false},
		{"dollar-dot", "$.status", "ready", false},
		{"root", "$", map[string]any{"status": "ready"}, false},
		{"quoted-bracket", `["status"]`, "ready", false},
		{"single-quoted-bracket", `['status']`, "ready", false},
		{"array-index-missing", "$[0]", nil, false},
		{"dotted-bracket-missing", "$.[0]", nil, false},
		{"adjacent-names-missing", "[0]a", nil, false},
		{"prefixed-dollar", "$status", "ready", false},
		{"dotted-quoted", `$. ["status"]`, nil, true},
		{"dotted-quoted-valid", `$.["status"]`, "ready", false},
		{"escaped-double", `["\u0073tatus"]`, "ready", false},
		{"escaped-single", `['st\u0061tus']`, "ready", false},
		{"valid-surrogate-pair-double", `["\ud83d\ude00"]`, nil, false},
		{"valid-surrogate-pair-single", `['\ud83d\ude00']`, nil, false},
		{"lone-high-double", `["\ud83d"]`, nil, true},
		{"lone-low-double", `["\ude00"]`, nil, true},
		{"high-followed-by-non-low", `["\ud83d\u0041"]`, nil, true},
		{"lone-high-single", `['\ud83d']`, nil, true},
		{"lone-low-single", `['\ude00']`, nil, true},
		{"nul-double", `["\u0000"]`, nil, false},
		{"nul-single", `['\u0000']`, nil, false},
		{"index-normalized", `$.status[00]`, nil, false},
		{"quoted-injection", `["status'); DROP TABLE cf_select.items; --"]`, nil, false},
		{"empty", "", nil, true},
		{"recursive", "$..x", nil, true},
		{"invalid-start", "1a", nil, true},
		{"invalid-punctuation", "a:b", nil, true},
		{"invalid-digit", "$.0", nil, true},
		{"invalid-hyphen", "-a", nil, true},
		{"invalid-slash", "a/b", nil, true},
		{"invalid-escape", `["st\atus"]`, nil, true},
		{"injection", `$.status'); DROP TABLE cf_select.items; --`, nil, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			path := tt.path
			query := `query($path: String!) { list: cf_select_items(where:{id:{_eq:1}}) { value: item_payload(path:$path) } }`

			doc, err := parser.ParseQuery(&ast.Source{Input: query})
			if err != nil {
				t.Fatal(err)
			}

			ops, err := roots.BuildQuery(
				doc.Operations[0],
				doc.Fragments,
				map[string]any{"path": path},
				"cf_reader",
				nil,
			)
			if tt.invalid {
				var validation *arguments.QueryValidationError
				if !errors.As(err, &validation) ||
					validation.Error() != arguments.NewComputedJSONPathError(path).Error() {
					t.Fatalf("path %q error = %v", path, err)
				}

				ext, ok := validation.AsMap()["extensions"].(map[string]any)
				if !ok ||
					ext["path"] != "$.selectionSet.cf_select_items.selectionSet.item_payload.args" ||
					ext["code"] != "validation-failed" {
					t.Fatalf("validation envelope = %#v", validation.AsMap())
				}

				return
			}

			if err != nil {
				t.Fatal(err)
			}

			nulPath := strings.Contains(path, `\u0000`)
			if path != "$" && strings.Contains(ops[0].SQL, path) ||
				!strings.Contains(ops[0].SQL, "::text[]") ||
				nulPath && (!strings.Contains(ops[0].SQL, "#> NULL::text[]") ||
					strings.ContainsRune(ops[0].SQL, 0) || len(ops[0].Parameters) != 1) {
				t.Fatalf("path not safely represented as text[]: %s", ops[0].SQL)
			}

			got := computedResult(t, pool, ops[0])

			want := []any{map[string]any{"value": tt.want}}
			if !reflect.DeepEqual(got, want) {
				t.Fatalf("path %q = %#v, want %#v", path, got, want)
			}
		})
	}

	var raw string
	if err := pool.QueryRow(t.Context(), `SELECT ('{"z":2,"c":3}'::json #> $1::text[])::text`, []string{}).
		Scan(&raw); err != nil {
		t.Fatal(err)
	}

	if raw != `{"z":2,"c":3}` {
		t.Fatalf("json path changed key order: %s", raw)
	}
}

func TestComputedParameterizedJSONNULPath(t *testing.T) {
	t.Parallel()
	//nolint:dogsled // The fixture provides an isolated database and metadata for re-introspection.
	_, pool, _, md, _ := computedTestFixture(t)

	if _, err := pool.Exec(
		t.Context(),
		`CREATE FUNCTION cf_select.item_keyed_json(item cf_select.items, k text)
RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object(k, item.label) $$`,
	); err != nil {
		t.Fatal(err)
	}

	md.Tables[0].ComputedFields = append(md.Tables[0].ComputedFields, metadata.ComputedField{
		Name: "item_keyed_json", Definition: metadata.ComputedFieldDefinition{
			Function: metadata.FunctionSource{Schema: "cf_select", Name: "item_keyed_json"},
		},
	})
	for i := range md.Tables[0].SelectPermissions {
		if md.Tables[0].SelectPermissions[i].Role == "cf_reader" {
			md.Tables[0].SelectPermissions[i].Permission.ComputedFields = append(
				md.Tables[0].SelectPermissions[i].Permission.ComputedFields, "item_keyed_json",
			)
		}
	}

	pgPool, err := postgres.Open(t.Context(), pool.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatal(err)
	}

	client := postgres.NewClient(pgPool)
	t.Cleanup(client.Close)

	objects, err := client.Introspect(t.Context(), md)
	if err != nil {
		t.Fatal(err)
	}

	caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())
	caps.SupportsComputedScalarSelection = true

	roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect(), caps)
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name, query string
		want        any
	}{
		{
			name: "NUL key with client argument",
			query: `query { cf_select_items(where:{id:{_eq:1}}) {
				a: item_keyed_json(args:{k:"x"}, path:"[\"\\u0000\"]")
			} }`,
			want: []any{map[string]any{"a": nil}},
		},
		{
			name: "NUL key followed by parameterized selection",
			query: `query { cf_select_items(where:{id:{_eq:1}}) {
				a: item_keyed_json(args:{k:"x"}, path:"[\"\\u0000\"]")
				b: item_keyed_json(args:{k:"y"}, path:"y")
			} }`,
			want: []any{map[string]any{"a": nil, "b": "first"}},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			op := computedOperation(t, roots, tt.query, nil)
			if !strings.Contains(op.SQL, `"cf_select"."item_keyed_json"(`) ||
				!strings.Contains(op.SQL, "#> NULL::text[]") ||
				strings.ContainsRune(op.SQL, 0) {
				t.Fatalf("NUL path discarded call or bound NUL: %s", op.SQL)
			}

			got := computedResult(t, pool, op)
			if !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("result = %#v, want %#v", got, tt.want)
			}
		})
	}
}
