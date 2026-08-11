package schemadiff_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/nhost/cli/internal/schemadiff"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
)

func mustParse(t *testing.T, sdl string) *ast.Schema {
	t.Helper()

	schema, err := gqlparser.LoadSchema(&ast.Source{
		Name:  "test",
		Input: sdl,
	})
	if err != nil {
		t.Fatalf("parsing SDL: %v", err)
	}

	return schema
}

func TestLoad(t *testing.T) {
	t.Parallel()

	sdl := `type Query { ping: String }`

	dir := t.TempDir()
	path := filepath.Join(dir, "schema.graphql")

	if err := os.WriteFile(path, []byte(sdl), 0o600); err != nil {
		t.Fatalf("writing temp schema: %v", err)
	}

	schema, err := schemadiff.Load(path)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	if schema.Query == nil || schema.Query.Fields.ForName("ping") == nil {
		t.Fatalf("expected loaded schema to contain Query.ping")
	}
}

func TestLoadMissingFile(t *testing.T) {
	t.Parallel()

	_, err := schemadiff.Load(filepath.Join(t.TempDir(), "does-not-exist.graphql"))
	if err == nil {
		t.Fatalf("expected error for missing file")
	}

	if !strings.Contains(err.Error(), "reading schema file") {
		t.Fatalf("expected wrapped read error, got: %v", err)
	}
}

func TestLoadInvalidSDL(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	path := filepath.Join(dir, "bad.graphql")

	if err := os.WriteFile(path, []byte("this is not graphql"), 0o600); err != nil {
		t.Fatalf("writing temp schema: %v", err)
	}

	_, err := schemadiff.Load(path)
	if err == nil {
		t.Fatalf("expected parse error")
	}

	if !strings.Contains(err.Error(), "parsing schema file") {
		t.Fatalf("expected wrapped parse error, got: %v", err)
	}
}

func TestStripNoopUpdateMutations(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name             string
		sdl              string
		wantMutations    []string
		removedTypes     []string
		preservedTypes   []string
		expectMutationOK bool
	}{
		{
			name: "removes update mutations whose update_column enum is placeholder-only",
			sdl: `
type Query { x: String }
type Mutation {
  update_users(_set: users_set_input): users_mutation_response
  update_users_by_pk(pk_columns: users_pk_columns_input): users_mutation_response
  update_users_many(updates: [users_updates!]!): [users_mutation_response]
  delete_users: users_mutation_response
}
type users_mutation_response { affected_rows: Int }
input users_set_input { name: String }
input users_pk_columns_input { id: Int }
input users_updates { where: String }
enum users_update_column { _PLACEHOLDER }
`,
			wantMutations:  []string{"delete_users"},
			removedTypes:   []string{"users_pk_columns_input", "users_updates"},
			preservedTypes: []string{"users_mutation_response", "users_set_input"},
		},
		{
			name: "keeps update mutations when update_column enum has real columns",
			sdl: `
type Query { x: String }
type Mutation {
  update_users(_set: users_set_input): users_mutation_response
  delete_users: users_mutation_response
}
type users_mutation_response { affected_rows: Int }
input users_set_input { name: String }
enum users_update_column { name }
`,
			wantMutations:  []string{"update_users", "delete_users"},
			preservedTypes: []string{"users_mutation_response", "users_set_input"},
		},
		{
			name: "no-op when no placeholder enums exist",
			sdl: `
type Query { x: String }
type Mutation {
  delete_users: users_mutation_response
}
type users_mutation_response { affected_rows: Int }
`,
			wantMutations: []string{"delete_users"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			schema := mustParse(t, tt.sdl)
			schemadiff.StripNoopUpdateMutations(schema)

			if schema.Mutation == nil {
				t.Fatalf("expected mutation type to remain")
			}

			gotMutations := make([]string, 0, len(schema.Mutation.Fields))
			for _, f := range schema.Mutation.Fields {
				gotMutations = append(gotMutations, f.Name)
			}

			if !sameStringSet(gotMutations, tt.wantMutations) {
				t.Errorf("mutations: got %v, want %v", gotMutations, tt.wantMutations)
			}

			for _, removed := range tt.removedTypes {
				if _, ok := schema.Types[removed]; ok {
					t.Errorf("expected type %q to be stripped", removed)
				}
			}

			for _, kept := range tt.preservedTypes {
				if _, ok := schema.Types[kept]; !ok {
					t.Errorf("expected type %q to be preserved", kept)
				}
			}
		})
	}
}

//nolint:gocognit,cyclop // table-driven; assertions inlined per case
func TestNormalizeAggregateTypes(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		sdlA  string
		sdlB  string
		check func(t *testing.T, a, b *ast.Schema)
	}{
		{
			name: "intersects fields and removes type missing from one schema",
			sdlA: `
type Query { x: String }
type users_aggregate_fields {
  count: Int
  max: users_max_fields
  min: users_min_fields
}
type users_max_fields { id: Int, name: String, age: Int }
type users_min_fields { id: Int, name: String, age: Int }
`,
			sdlB: `
type Query { x: String }
type users_aggregate_fields {
  count: Int
  max: users_max_fields
}
type users_max_fields { id: Int, name: String }
`,
			check: func(t *testing.T, a, b *ast.Schema) {
				t.Helper()

				maxA, okA := a.Types["users_max_fields"]
				maxB, okB := b.Types["users_max_fields"]

				if !okA || !okB {
					t.Fatalf("expected users_max_fields to remain in both schemas")
				}

				if !sameFieldNames(maxA.Fields, []string{"id", "name"}) ||
					!sameFieldNames(maxB.Fields, []string{"id", "name"}) {
					t.Errorf("expected max fields intersected to {id, name}; got A=%v B=%v",
						fieldNames(maxA.Fields), fieldNames(maxB.Fields))
				}

				if _, ok := a.Types["users_min_fields"]; ok {
					t.Errorf("expected users_min_fields to be removed from schemaA")
				}

				if hasField(a.Types["users_aggregate_fields"].Fields, "min") {
					t.Errorf("expected aggregate_fields.min to be removed from schemaA")
				}
			},
		},
		{
			name: "no-op when neither schema has aggregate types",
			sdlA: `type Query { ping: String }`,
			sdlB: `type Query { ping: String }`,
			check: func(t *testing.T, a, b *ast.Schema) {
				t.Helper()

				for typeName := range a.Types {
					if strings.HasSuffix(typeName, "_max_fields") ||
						strings.HasSuffix(typeName, "_min_fields") {
						t.Errorf("unexpected aggregate type %q in schemaA", typeName)
					}
				}

				if a.Query.Fields.ForName("ping") == nil ||
					b.Query.Fields.ForName("ping") == nil {
					t.Errorf("expected Query.ping to remain in both schemas")
				}
			},
		},
		{
			name: "removes type entirely when intersection is empty",
			sdlA: `
type Query { x: String }
type users_aggregate_fields { max: users_max_fields }
type users_max_fields { id: Int }
`,
			sdlB: `
type Query { x: String }
type users_aggregate_fields { max: users_max_fields }
type users_max_fields { name: String }
`,
			check: func(t *testing.T, a, b *ast.Schema) {
				t.Helper()

				if _, ok := a.Types["users_max_fields"]; ok {
					t.Errorf(
						"expected users_max_fields to be removed from schemaA on empty intersection",
					)
				}

				if _, ok := b.Types["users_max_fields"]; ok {
					t.Errorf(
						"expected users_max_fields to be removed from schemaB on empty intersection",
					)
				}

				if hasField(a.Types["users_aggregate_fields"].Fields, "max") {
					t.Errorf("expected aggregate_fields.max to be removed from schemaA")
				}

				if hasField(b.Types["users_aggregate_fields"].Fields, "max") {
					t.Errorf("expected aggregate_fields.max to be removed from schemaB")
				}
			},
		},
		{
			name: "asymmetric _min_fields only in schemaB triggers removal",
			sdlA: `
type Query { x: String }
type users_aggregate_fields { count: Int }
`,
			sdlB: `
type Query { x: String }
type users_aggregate_fields {
  count: Int
  min: users_min_fields
}
type users_min_fields { id: Int }
`,
			check: func(t *testing.T, _, b *ast.Schema) {
				t.Helper()
				assertTypeRemovedAndFieldStripped(
					t, b, "users_min_fields", "users_aggregate_fields", "min",
				)
			},
		},
		{
			name: "intersects _min_order_by and rewires aggregate_order_by field",
			sdlA: `
type Query { x: String }
input users_aggregate_order_by { min: users_min_order_by }
input users_min_order_by { id: order_by, name: order_by }
enum order_by { asc, desc }
`,
			sdlB: `
type Query { x: String }
input users_aggregate_order_by { min: users_min_order_by }
input users_min_order_by { name: order_by }
enum order_by { asc, desc }
`,
			check: func(t *testing.T, a, b *ast.Schema) {
				t.Helper()

				minA, okA := a.Types["users_min_order_by"]
				minB, okB := b.Types["users_min_order_by"]

				if !okA || !okB {
					t.Fatalf("expected users_min_order_by to remain in both schemas")
				}

				if !sameFieldNames(minA.Fields, []string{"name"}) ||
					!sameFieldNames(minB.Fields, []string{"name"}) {
					t.Errorf("expected min_order_by fields intersected to {name}; got A=%v B=%v",
						fieldNames(minA.Fields), fieldNames(minB.Fields))
				}
			},
		},
		{
			name: "asymmetric _min_order_by only in schemaA triggers removal and rewire",
			sdlA: `
type Query { x: String }
input users_aggregate_order_by {
  count: order_by
  min: users_min_order_by
}
input users_min_order_by { id: order_by }
enum order_by { asc, desc }
`,
			sdlB: `
type Query { x: String }
input users_aggregate_order_by { count: order_by }
enum order_by { asc, desc }
`,
			check: func(t *testing.T, a, _ *ast.Schema) {
				t.Helper()
				assertTypeRemovedAndFieldStripped(
					t, a, "users_min_order_by", "users_aggregate_order_by", "min",
				)
			},
		},
		{
			name: "asymmetric _max_order_by only in schemaB triggers removal and rewire",
			sdlA: `
type Query { x: String }
input users_aggregate_order_by { count: order_by }
enum order_by { asc, desc }
`,
			sdlB: `
type Query { x: String }
input users_aggregate_order_by {
  count: order_by
  max: users_max_order_by
}
input users_max_order_by { id: order_by }
enum order_by { asc, desc }
`,
			check: func(t *testing.T, _, b *ast.Schema) {
				t.Helper()
				assertTypeRemovedAndFieldStripped(
					t, b, "users_max_order_by", "users_aggregate_order_by", "max",
				)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			schemaA := mustParse(t, tt.sdlA)
			schemaB := mustParse(t, tt.sdlB)
			schemadiff.NormalizeAggregateTypes(schemaA, schemaB)
			tt.check(t, schemaA, schemaB)
		})
	}
}

func TestNormalizeFuncArgNullability(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		sdl   string
		check func(t *testing.T, schema *ast.Schema)
	}{
		{
			name: "relaxes non-null fields and leaves non-_args inputs untouched",
			sdl: `
type Query { x: String }
input search_users_args {
  query: String!
  limit: Int!
}
input not_an_args_type {
  required: String!
}
`,
			check: func(t *testing.T, schema *ast.Schema) {
				t.Helper()

				for _, f := range schema.Types["search_users_args"].Fields {
					if f.Type.NonNull {
						t.Errorf("expected search_users_args.%s to be nullable", f.Name)
					}
				}

				if !schema.Types["not_an_args_type"].Fields.ForName("required").Type.NonNull {
					t.Errorf("expected non-_args input types to be untouched")
				}
			},
		},
		{
			name: "no-op when schema has no _args input types",
			sdl: `
type Query { x: String }
input some_input { id: Int! }
`,
			check: func(t *testing.T, schema *ast.Schema) {
				t.Helper()

				if !schema.Types["some_input"].Fields.ForName("id").Type.NonNull {
					t.Errorf("expected unrelated input fields to remain non-null")
				}
			},
		},
		{
			name: "preserves already-nullable _args fields",
			sdl: `
type Query { x: String }
input search_users_args {
  query: String
  limit: Int
}
`,
			check: func(t *testing.T, schema *ast.Schema) {
				t.Helper()

				for _, f := range schema.Types["search_users_args"].Fields {
					if f.Type.NonNull {
						t.Errorf("expected search_users_args.%s to stay nullable", f.Name)
					}
				}
			},
		},
		{
			name: "processes multiple _args input types independently",
			sdl: `
type Query { x: String }
input search_users_args { q: String! }
input list_orders_args { since: String!, limit: Int! }
`,
			check: func(t *testing.T, schema *ast.Schema) {
				t.Helper()

				for _, typeName := range []string{"search_users_args", "list_orders_args"} {
					for _, f := range schema.Types[typeName].Fields {
						if f.Type.NonNull {
							t.Errorf("expected %s.%s to be nullable", typeName, f.Name)
						}
					}
				}
			},
		},
		{
			name: "skips types named _args that are not input objects",
			sdl: `
type Query { x: String }
type bogus_args { x: String! }
`,
			check: func(t *testing.T, schema *ast.Schema) {
				t.Helper()

				if !schema.Types["bogus_args"].Fields.ForName("x").Type.NonNull {
					t.Errorf("expected non-input type with _args suffix to be untouched")
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			schema := mustParse(t, tt.sdl)
			schemadiff.NormalizeFuncArgNullability(schema)
			tt.check(t, schema)
		})
	}
}

func TestStripBuiltinDirectives(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		sdl        string
		wantGone   []string
		wantKept   []string
		minExisted []string
	}{
		{
			name: "strips skip/include/cached but preserves custom",
			sdl: `
directive @skip(if: Boolean!) on FIELD
directive @include(if: Boolean!) on FIELD
directive @cached(ttl: Int) on QUERY
directive @custom on FIELD
type Query { x: String }
`,
			wantGone:   []string{"skip", "include", "cached", "deprecated"},
			wantKept:   []string{"custom"},
			minExisted: []string{"custom"},
		},
		{
			name:       "no-op when only custom directives are declared",
			sdl:        `directive @custom on FIELD` + "\n" + `type Query { x: String }`,
			wantGone:   []string{"skip", "include", "cached", "deprecated"},
			wantKept:   []string{"custom"},
			minExisted: []string{"custom"},
		},
		{
			name: "strips specifiedBy/defer/oneOf alongside other builtins",
			sdl: `
directive @specifiedBy(url: String!) on SCALAR
directive @defer(label: String, if: Boolean) on FRAGMENT_SPREAD | INLINE_FRAGMENT
directive @oneOf on INPUT_OBJECT
directive @keep on FIELD
type Query { x: String }
`,
			wantGone:   []string{"specifiedBy", "defer", "oneOf"},
			wantKept:   []string{"keep"},
			minExisted: []string{"specifiedBy", "defer", "oneOf", "keep"},
		},
		{
			name:     "no-op on schema without any user-declared directives",
			sdl:      `type Query { x: String }`,
			wantGone: []string{"skip", "include", "cached", "deprecated"},
			wantKept: nil,
		},
		{
			name: "strips multiple builtins side-by-side",
			sdl: `
directive @skip(if: Boolean!) on FIELD
directive @include(if: Boolean!) on FIELD
directive @deprecated(reason: String) on FIELD_DEFINITION
type Query { x: String }
`,
			wantGone:   []string{"skip", "include", "deprecated"},
			wantKept:   nil,
			minExisted: []string{"skip", "include", "deprecated"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			schema := mustParse(t, tt.sdl)

			for _, name := range tt.minExisted {
				if _, ok := schema.Directives[name]; !ok {
					t.Fatalf("pre-condition: directive %q expected to be declared in fixture", name)
				}
			}

			schemadiff.StripBuiltinDirectives(schema)

			for _, name := range tt.wantGone {
				if _, ok := schema.Directives[name]; ok {
					t.Errorf("expected built-in directive %q to be stripped", name)
				}
			}

			for _, name := range tt.wantKept {
				if _, ok := schema.Directives[name]; !ok {
					t.Errorf("expected directive %q to be preserved", name)
				}
			}
		})
	}
}

//nolint:gocognit,cyclop // table-driven; assertions inlined per case
func TestSortFields(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		sdl   string
		check func(t *testing.T, schema *ast.Schema)
	}{
		{
			name: "sorts Query fields, arguments, user types, and enum values",
			sdl: `
type Query {
  zeta(b: Int, a: Int): String
  alpha: String
}
enum Color { RED, BLUE, GREEN }
type User {
  name: String
  age: Int
  id: Int
}
`,
			check: func(t *testing.T, schema *ast.Schema) {
				t.Helper()

				queryFields := filterIntrospection(fieldNames(schema.Query.Fields))
				if !equalSlice(queryFields, []string{"alpha", "zeta"}) {
					t.Errorf("Query fields not sorted: %v", queryFields)
				}

				argNames := make([]string, 0, len(schema.Query.Fields.ForName("zeta").Arguments))
				for _, a := range schema.Query.Fields.ForName("zeta").Arguments {
					argNames = append(argNames, a.Name)
				}

				if !equalSlice(argNames, []string{"a", "b"}) {
					t.Errorf("zeta arguments not sorted: %v", argNames)
				}

				userFields := fieldNames(schema.Types["User"].Fields)
				if !equalSlice(userFields, []string{"age", "id", "name"}) {
					t.Errorf("User fields not sorted: %v", userFields)
				}

				colorValues := make([]string, 0, len(schema.Types["Color"].EnumValues))
				for _, v := range schema.Types["Color"].EnumValues {
					colorValues = append(colorValues, v.Name)
				}

				if !equalSlice(colorValues, []string{"BLUE", "GREEN", "RED"}) {
					t.Errorf("Color enum not sorted: %v", colorValues)
				}
			},
		},
		{
			name: "stable on already-sorted input",
			sdl: `
type Query {
  alpha: String
  zeta: String
}
type User {
  age: Int
  id: Int
  name: String
}
enum Color { BLUE, GREEN, RED }
`,
			check: func(t *testing.T, schema *ast.Schema) {
				t.Helper()

				if got := filterIntrospection(fieldNames(schema.Query.Fields)); !equalSlice(
					got,
					[]string{"alpha", "zeta"},
				) {
					t.Errorf("Query fields: %v", got)
				}

				if got := fieldNames(schema.Types["User"].Fields); !equalSlice(
					got,
					[]string{"age", "id", "name"},
				) {
					t.Errorf("User fields: %v", got)
				}
			},
		},
		{
			name: "no-op on type with no fields and enum with no values",
			sdl: `
type Query { x: String }
scalar Date
`,
			check: func(t *testing.T, schema *ast.Schema) {
				t.Helper()

				if got := filterIntrospection(fieldNames(schema.Query.Fields)); !equalSlice(
					got,
					[]string{"x"},
				) {
					t.Errorf("Query fields: %v", got)
				}

				if dateDef, ok := schema.Types["Date"]; ok {
					if len(dateDef.Fields) != 0 {
						t.Errorf(
							"expected scalar Date to have no fields, got %v",
							fieldNames(dateDef.Fields),
						)
					}
				}
			},
		},
		{
			name: "sorts Mutation and Subscription roots, not just Query",
			sdl: `
type Query { ping: String }
type Mutation {
  zeta_op: String
  alpha_op: String
}
type Subscription {
  zeta_sub: String
  alpha_sub: String
}
`,
			check: func(t *testing.T, schema *ast.Schema) {
				t.Helper()

				if got := fieldNames(schema.Mutation.Fields); !equalSlice(
					got,
					[]string{"alpha_op", "zeta_op"},
				) {
					t.Errorf("Mutation fields not sorted: %v", got)
				}

				if got := fieldNames(schema.Subscription.Fields); !equalSlice(
					got,
					[]string{"alpha_sub", "zeta_sub"},
				) {
					t.Errorf("Subscription fields not sorted: %v", got)
				}
			},
		},
		{
			name: "sorts arguments on root operations too",
			sdl: `
type Query {
  search(z: Int, a: Int, m: Int): String
}
`,
			check: func(t *testing.T, schema *ast.Schema) {
				t.Helper()

				search := schema.Query.Fields.ForName("search")

				argNames := make([]string, 0, len(search.Arguments))
				for _, arg := range search.Arguments {
					argNames = append(argNames, arg.Name)
				}

				if !equalSlice(argNames, []string{"a", "m", "z"}) {
					t.Errorf("search arguments not sorted: %v", argNames)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			schema := mustParse(t, tt.sdl)
			schemadiff.SortFields(schema)
			tt.check(t, schema)
		})
	}
}

func TestToSDL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name               string
		sdl                string
		ignoreDescriptions bool
		wantContains       []string
		wantNotContains    []string
	}{
		{
			name: "retains descriptions when ignoreDescriptions is false",
			sdl: `
"""Root query."""
type Query {
  """Returns hi."""
  hi: String
}
`,
			ignoreDescriptions: false,
			wantContains:       []string{"Root query", "Returns hi", "hi: String"},
		},
		{
			name: "omits descriptions when ignoreDescriptions is true",
			sdl: `
"""Root query."""
type Query {
  """Returns hi."""
  hi: String
}
`,
			ignoreDescriptions: true,
			wantContains:       []string{"hi: String"},
			wantNotContains:    []string{"Root query", "Returns hi"},
		},
		{
			name: "formats schema with custom directive declarations",
			sdl: `
directive @custom on FIELD_DEFINITION
type Query {
  field: String @custom
}
`,
			ignoreDescriptions: false,
			wantContains:       []string{"directive @custom", "type Query", "field: String"},
		},
		{
			name: "formats schema with enum types",
			sdl: `
type Query { color: Color }
enum Color { RED GREEN BLUE }
`,
			ignoreDescriptions: false,
			wantContains:       []string{"enum Color", "RED", "GREEN", "BLUE", "color: Color"},
		},
		{
			name:               "formats schema with only a Query type",
			sdl:                `type Query { ping: String }`,
			ignoreDescriptions: false,
			wantContains:       []string{"type Query", "ping: String"},
		},
		{
			name: "indents nested types with two-space indent",
			sdl: `
type Query { user: User }
type User {
  id: Int
  name: String
}
`,
			ignoreDescriptions: false,
			wantContains:       []string{"  id: Int", "  name: String"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			schema := mustParse(t, tt.sdl)
			got := schemadiff.ToSDL(schema, tt.ignoreDescriptions)

			for _, want := range tt.wantContains {
				if !strings.Contains(got, want) {
					t.Errorf("expected SDL to contain %q, got:\n%s", want, got)
				}
			}

			for _, unwanted := range tt.wantNotContains {
				if strings.Contains(got, unwanted) {
					t.Errorf("expected SDL to NOT contain %q, got:\n%s", unwanted, got)
				}
			}
		})
	}
}

func TestAddHunkContext(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		diff      string
		source    []string
		wantInOut string
	}{
		{
			name: "annotates plain hunk with enclosing type block",
			diff: "@@ -3,2 +3,2 @@\n-  old\n+  new\n",
			source: []string{
				"type Query {",
				"  field: String",
				"  removed: Int",
				"}",
			},
			wantInOut: "@@ -3,2 +3,2 @@ type Query {",
		},
		{
			name: "preserves existing function-context hunk header",
			diff: "@@ -1,1 +1,1 @@ existing context\n-foo\n+bar\n",
			source: []string{
				"type Query {",
			},
			wantInOut: "@@ -1,1 +1,1 @@ existing context",
		},
		{
			name: "handles diffs without hunk headers gracefully",
			diff: "no hunks here\n",
			source: []string{
				"type Query {",
			},
			wantInOut: "no hunks here",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := schemadiff.AddHunkContext(tt.diff, tt.source)
			if !strings.Contains(got, tt.wantInOut) {
				t.Errorf("expected output to contain %q, got:\n%s", tt.wantInOut, got)
			}
		})
	}
}

func fieldNames(fields ast.FieldList) []string {
	names := make([]string, 0, len(fields))
	for _, f := range fields {
		names = append(names, f.Name)
	}

	return names
}

func sameFieldNames(fields ast.FieldList, want []string) bool {
	return sameStringSet(fieldNames(fields), want)
}

func hasField(fields ast.FieldList, name string) bool {
	for _, f := range fields {
		if f.Name == name {
			return true
		}
	}

	return false
}

// assertTypeRemovedAndFieldStripped checks that removeAggregateType deleted
// removedType from the schema and stripped strippedField from its parent
// aggregate type.
func assertTypeRemovedAndFieldStripped(
	t *testing.T,
	schema *ast.Schema,
	removedType, parentType, strippedField string,
) {
	t.Helper()

	if _, ok := schema.Types[removedType]; ok {
		t.Errorf("expected %q to be removed", removedType)
	}

	if hasField(schema.Types[parentType].Fields, strippedField) {
		t.Errorf("expected %s.%s to be removed", parentType, strippedField)
	}
}

func sameStringSet(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}

	set := make(map[string]int, len(a))
	for _, s := range a {
		set[s]++
	}

	for _, s := range b {
		set[s]--
		if set[s] < 0 {
			return false
		}
	}

	return true
}

func filterIntrospection(names []string) []string {
	out := make([]string, 0, len(names))

	for _, n := range names {
		if strings.HasPrefix(n, "__") {
			continue
		}

		out = append(out, n)
	}

	return out
}

func equalSlice(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}

	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}

	return true
}
