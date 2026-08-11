package introspection_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/controller/introspection"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/validator/rules"
)

const sampleSchema = `
directive @repeatableCustom repeatable on FIELD_DEFINITION

"User account."
type User {
	id: ID!
	name: String
	"Friend list."
	friends(after: ID): [User!]!
	old: String @deprecated(reason: "use name")
}

input UserInput {
	name: String!
	"Score, defaults to 100."
	score: Int = 100
}

enum Status {
	ACTIVE
	BANNED @deprecated(reason: "no longer used")
}

interface Node {
	id: ID!
}

union Profile = User

type Query {
	user(id: ID!): User
}
`

// loadSchema parses the sample SDL into an *ast.Schema.
func loadSchema(t *testing.T) *ast.Schema {
	t.Helper()

	src := &ast.Source{Name: "test.graphql", Input: sampleSchema, BuiltIn: false}

	schema, err := gqlparser.LoadSchema(src)
	if err != nil {
		t.Fatalf("LoadSchema: %v", err)
	}

	return schema
}

// loadQuery parses a query string against the given schema and returns the
// document plus the first operation. Fragments are accessible via doc.Fragments.
func loadQuery(t *testing.T, schema *ast.Schema, query string) (
	*ast.QueryDocument, *ast.OperationDefinition,
) {
	t.Helper()

	doc, listErr := gqlparser.LoadQueryWithRules(schema, query, rules.NewDefaultRules())
	if len(listErr) > 0 {
		t.Fatalf("LoadQuery: %v", listErr)
	}

	if len(doc.Operations) != 1 {
		t.Fatalf("expected 1 operation, got %d", len(doc.Operations))
	}

	for _, op := range doc.Operations {
		return doc, op
	}

	return doc, nil
}

// asMap asserts that v is a map[string]any, failing the test if not. Used to
// keep navigation of the introspection result tree concise.
func asMap(t *testing.T, v any) map[string]any {
	t.Helper()

	m, ok := v.(map[string]any)
	if !ok {
		t.Fatalf("expected map[string]any, got %T", v)
	}

	return m
}

// asMapSlice asserts that v is a []map[string]any.
func asMapSlice(t *testing.T, v any) []map[string]any {
	t.Helper()

	s, ok := v.([]map[string]any)
	if !ok {
		t.Fatalf("expected []map[string]any, got %T", v)
	}

	return s
}

// asStringSlice asserts that v is a []string.
func asStringSlice(t *testing.T, v any) []string {
	t.Helper()

	s, ok := v.([]string)
	if !ok {
		t.Fatalf("expected []string, got %T", v)
	}

	return s
}

// schemaTypes navigates got["__schema"]["types"] and returns the slice.
func schemaTypes(t *testing.T, got map[string]any) []map[string]any {
	t.Helper()

	return asMapSlice(t, asMap(t, got["__schema"])["types"])
}

func findMapByName(t *testing.T, values []map[string]any, name string) map[string]any {
	t.Helper()

	for _, value := range values {
		if value["name"] == name {
			return value
		}
	}

	t.Fatalf("map with name %q not found in %v", name, values)

	return nil
}

func TestExecute(t *testing.T) { //nolint:gocognit,gocyclo,cyclop,maintidx
	t.Parallel()

	tests := []struct {
		name  string
		query string
		check func(t *testing.T, got map[string]any)
	}{
		{
			name:  "SchemaQueryType",
			query: `{ __schema { queryType { name } } }`,
			check: func(t *testing.T, got map[string]any) {
				t.Helper()

				schemaResult, ok := got["__schema"].(map[string]any)
				if !ok {
					t.Fatalf("expected __schema map, got %T", got["__schema"])
				}

				queryType, ok := schemaResult["queryType"].(map[string]any)
				if !ok {
					t.Fatalf("expected queryType map, got %T", schemaResult["queryType"])
				}

				if queryType["name"] != "Query" {
					t.Errorf("queryType.name = %v, want Query", queryType["name"])
				}
			},
		},
		{
			name: "SchemaFragmentsAndAliases",
			query: `
				query Q {
					schemaAlias: __schema {
						...SchemaRootFields
						... on __Schema {
							missingMutation: mutationType { ignoredName: name }
							aliasedTypes: types { typeName: name }
						}
					}
				}

				fragment SchemaRootFields on __Schema {
					rootQuery: queryType {
						...RootName
						... on __Type { rootKind: kind }
					}
				}

				fragment RootName on __Type { queryName: name }
			`,
			check: func(t *testing.T, got map[string]any) {
				t.Helper()

				schemaResult := asMap(t, got["schemaAlias"])

				rootQuery := asMap(t, schemaResult["rootQuery"])

				wantRootQuery := map[string]any{
					"queryName": "Query",
					"rootKind":  "OBJECT",
				}
				if diff := cmp.Diff(wantRootQuery, rootQuery); diff != "" {
					t.Errorf("rootQuery mismatch (-want +got):\n%s", diff)
				}

				if mutationType, ok := schemaResult["missingMutation"]; !ok || mutationType != nil {
					t.Errorf(
						"missingMutation = %v (present=%v), want nil and present",
						mutationType, ok,
					)
				}

				if _, ok := schemaResult["types"]; ok {
					t.Errorf("unexpected unaliased types key in schema result: %v", schemaResult)
				}

				types := asMapSlice(t, schemaResult["aliasedTypes"])
				for _, typ := range types {
					if typ["typeName"] != "User" {
						continue
					}

					if _, ok := typ["name"]; ok {
						t.Errorf("unexpected unaliased name key in User type result: %v", typ)
					}

					return
				}

				t.Fatal("User type not found through aliased types selection")
			},
		},
		{
			name: "RootTypenameAndInlineFragment",
			query: `
				query Q {
					... on Query {
						rootType: __typename
						schemaAlias: __schema { queryType { name } }
					}
				}
			`,
			check: func(t *testing.T, got map[string]any) {
				t.Helper()

				if got["rootType"] != "Query" {
					t.Errorf("rootType = %v, want Query", got["rootType"])
				}

				queryType := asMap(t, asMap(t, got["schemaAlias"])["queryType"])
				if queryType["name"] != "Query" {
					t.Errorf("schemaAlias.queryType.name = %v, want Query", queryType["name"])
				}
			},
		},
		{
			name:  "TypenameOnSchemaAndTypeRef",
			query: `{ __schema { __typename queryType { __typename name } } }`,
			check: func(t *testing.T, got map[string]any) {
				t.Helper()

				schemaResult := asMap(t, got["__schema"])
				if schemaResult["__typename"] != "__Schema" {
					t.Errorf("__schema.__typename = %v, want __Schema", schemaResult["__typename"])
				}

				queryType := asMap(t, schemaResult["queryType"])
				if queryType["__typename"] != "__Type" {
					t.Errorf(
						"__schema.queryType.__typename = %v, want __Type",
						queryType["__typename"],
					)
				}

				if queryType["name"] != "Query" {
					t.Errorf("__schema.queryType.name = %v, want Query", queryType["name"])
				}
			},
		},
		{
			name:  "TypeTypenameAliasAndInlineFragment",
			query: `{ __type(name: "User") { tn: __typename ... on __Type { name kind } } }`,
			check: func(t *testing.T, got map[string]any) {
				t.Helper()

				typ := asMap(t, got["__type"])

				want := map[string]any{
					"tn":   "__Type",
					"name": "User",
					"kind": "OBJECT",
				}
				if diff := cmp.Diff(want, typ); diff != "" {
					t.Errorf("__type mismatch (-want +got):\n%s", diff)
				}
			},
		},
		{
			name: "TypenameOnIntrospectionChildren",
			query: `{
				userType: __type(name: "User") {
					fields {
						name
						__typename
						args { name __typename type { __typename kind name } }
						type { __typename kind ofType { __typename kind name } }
					}
				}
				inputType: __type(name: "UserInput") {
					inputFields { name __typename type { __typename kind ofType { __typename kind name } } }
				}
				statusType: __type(name: "Status") {
					enumValues { name __typename }
				}
				__schema {
					directives { name __typename args { name __typename } }
				}
			}`,
			check: func(t *testing.T, got map[string]any) {
				t.Helper()

				friends := findMapByName(
					t,
					asMapSlice(t, asMap(t, got["userType"])["fields"]),
					"friends",
				)
				if friends["__typename"] != "__Field" {
					t.Errorf("friends.__typename = %v, want __Field", friends["__typename"])
				}

				fieldType := asMap(t, friends["type"])
				if fieldType["__typename"] != "__Type" {
					t.Errorf("friends.type.__typename = %v, want __Type", fieldType["__typename"])
				}

				afterArg := findMapByName(t, asMapSlice(t, friends["args"]), "after")
				if afterArg["__typename"] != "__InputValue" {
					t.Errorf("after.__typename = %v, want __InputValue", afterArg["__typename"])
				}

				argType := asMap(t, afterArg["type"])
				if argType["__typename"] != "__Type" {
					t.Errorf("after.type.__typename = %v, want __Type", argType["__typename"])
				}

				score := findMapByName(
					t, asMapSlice(t, asMap(t, got["inputType"])["inputFields"]), "score",
				)
				if score["__typename"] != "__InputValue" {
					t.Errorf("score.__typename = %v, want __InputValue", score["__typename"])
				}

				active := findMapByName(
					t, asMapSlice(t, asMap(t, got["statusType"])["enumValues"]), "ACTIVE",
				)
				if active["__typename"] != "__EnumValue" {
					t.Errorf("ACTIVE.__typename = %v, want __EnumValue", active["__typename"])
				}

				deprecated := findMapByName(
					t, asMapSlice(t, asMap(t, got["__schema"])["directives"]), "deprecated",
				)
				if deprecated["__typename"] != "__Directive" {
					t.Errorf(
						"deprecated.__typename = %v, want __Directive",
						deprecated["__typename"],
					)
				}

				reason := findMapByName(t, asMapSlice(t, deprecated["args"]), "reason")
				if reason["__typename"] != "__InputValue" {
					t.Errorf("reason.__typename = %v, want __InputValue", reason["__typename"])
				}
			},
		},
		{
			name: "TypeByName_ReturnsType",
			query: `{
				__type(name: "User") {
					name
					kind
					description
					fields { name }
				}
			}`,
			check: func(t *testing.T, got map[string]any) {
				t.Helper()

				typ := asMap(t, got["__type"])
				if typ["name"] != "User" {
					t.Errorf("__type.name = %v, want User", typ["name"])
				}

				if typ["kind"] != "OBJECT" {
					t.Errorf("__type.kind = %v, want OBJECT", typ["kind"])
				}

				desc, _ := typ["description"].(*string)
				if desc == nil || *desc != "User account." {
					t.Errorf("__type.description = %v, want 'User account.'", desc)
				}

				fields, _ := typ["fields"].([]map[string]any)
				if len(fields) == 0 {
					t.Fatal("expected User to have fields")
				}

				wantFields := map[string]bool{
					"id": true, "name": true, "friends": true, "old": true,
				}
				for _, f := range fields {
					name, _ := f["name"].(string)
					if !wantFields[name] {
						t.Errorf("unexpected field %q in __type result", name)
					}

					delete(wantFields, name)
				}

				if len(wantFields) > 0 {
					t.Errorf("missing fields in __type result: %v", wantFields)
				}
			},
		},
		{
			name:  "TypeByName_UnknownTypeReturnsNil",
			query: `{ __type(name: "DoesNotExist") { name } }`,
			check: func(t *testing.T, got map[string]any) {
				t.Helper()

				if v, ok := got["__type"]; !ok || v != nil {
					t.Errorf(
						"expected __type=nil for unknown type, got %v (present=%v)",
						v, ok,
					)
				}
			},
		},
		{
			name: "TypeByName_EnumKind",
			query: `{
				__type(name: "Status") {
					kind
					enumValues { name }
				}
			}`,
			check: func(t *testing.T, got map[string]any) {
				t.Helper()

				typ := asMap(t, got["__type"])
				if typ["kind"] != "ENUM" {
					t.Errorf("Status.kind = %v, want ENUM", typ["kind"])
				}

				vals, _ := typ["enumValues"].([]map[string]any)
				if len(vals) != 2 {
					t.Errorf("expected 2 enum values, got %d", len(vals))
				}
			},
		},
		{
			name:  "TypesIncludesObjectsAndScalars",
			query: `{ __schema { types { name kind } } }`,
			check: func(t *testing.T, got map[string]any) {
				t.Helper()

				types := schemaTypes(t, got)
				if len(types) == 0 {
					t.Fatal("expected at least one type")
				}

				seen := make(map[string]string)
				for _, ty := range types {
					name, _ := ty["name"].(string)
					kind, _ := ty["kind"].(string)
					seen[name] = kind
				}

				want := []struct {
					name     string
					wantKind string
				}{
					{"User", "OBJECT"},
					{"UserInput", "INPUT_OBJECT"},
					{"Status", "ENUM"},
					{"Node", "INTERFACE"},
					{"Profile", "UNION"},
					{"String", "SCALAR"},
					{"ID", "SCALAR"},
				}

				for _, tc := range want {
					gotKind, ok := seen[tc.name]
					if !ok {
						t.Errorf("type %q missing from introspection output", tc.name)

						continue
					}

					if gotKind != tc.wantKind {
						t.Errorf(
							"type %q kind = %q, want %q",
							tc.name, gotKind, tc.wantKind,
						)
					}
				}
			},
		},
		{
			name:  "ObjectFields_SkipMetaFields",
			query: `{ __schema { types { name fields { name } } } }`,
			check: func(t *testing.T, got map[string]any) {
				t.Helper()

				types := schemaTypes(t, got)

				for _, ty := range types {
					if ty["name"] != "User" {
						continue
					}

					fields, _ := ty["fields"].([]map[string]any)
					for _, f := range fields {
						name, _ := f["name"].(string)
						if len(name) >= 2 && name[0] == '_' && name[1] == '_' {
							t.Errorf(
								"expected meta-field %q to be filtered, but present in fields",
								name,
							)
						}
					}

					return
				}

				t.Fatal("User type not found in introspection output")
			},
		},
		{
			name: "FieldArgsAndDeprecation",
			query: `{
				__schema {
					types {
						name
						fields {
							name
							args { name }
							isDeprecated
							deprecationReason
						}
					}
				}
			}`,
			check: func(t *testing.T, got map[string]any) {
				t.Helper()

				types := schemaTypes(t, got)

				var userFields []map[string]any
				for _, ty := range types {
					if ty["name"] == "User" {
						userFields, _ = ty["fields"].([]map[string]any)
						break
					}
				}

				if userFields == nil {
					t.Fatal("User fields not found")
				}

				var (
					friendsField *map[string]any
					oldField     *map[string]any
				)

				for i := range userFields {
					switch userFields[i]["name"] {
					case "friends":
						friendsField = &userFields[i]
					case "old":
						oldField = &userFields[i]
					}
				}

				if friendsField == nil {
					t.Fatal("friends field not in User")
				}

				args, _ := (*friendsField)["args"].([]map[string]any)
				if len(args) != 1 || args[0]["name"] != "after" {
					t.Errorf("friends.args = %v, want one arg named 'after'", args)
				}

				if isDep, _ := (*friendsField)["isDeprecated"].(bool); isDep {
					t.Errorf("friends.isDeprecated = true, want false")
				}

				if oldField == nil {
					t.Fatal("old field not in User")
				}

				if isDep, _ := (*oldField)["isDeprecated"].(bool); !isDep {
					t.Errorf("old.isDeprecated = false, want true")
				}

				reason, _ := (*oldField)["deprecationReason"].(*string)
				if reason == nil || *reason != "use name" {
					t.Errorf("old.deprecationReason = %v, want 'use name'", reason)
				}
			},
		},
		{
			name: "EnumValuesWithDeprecation",
			query: `{
				__schema {
					types {
						name
						enumValues { name isDeprecated deprecationReason }
					}
				}
			}`,
			check: func(t *testing.T, got map[string]any) {
				t.Helper()

				types := schemaTypes(t, got)

				for _, ty := range types {
					if ty["name"] != "Status" {
						continue
					}

					vals, _ := ty["enumValues"].([]map[string]any)
					if len(vals) != 2 {
						t.Fatalf("expected 2 enum values, got %d", len(vals))
					}

					seen := make(map[string]bool)
					for _, v := range vals {
						name, _ := v["name"].(string)
						seen[name] = true

						if name == "BANNED" {
							if isDep, _ := v["isDeprecated"].(bool); !isDep {
								t.Errorf("BANNED.isDeprecated = false, want true")
							}

							reason, _ := v["deprecationReason"].(*string)
							if reason == nil || *reason != "no longer used" {
								t.Errorf("BANNED.deprecationReason = %v", reason)
							}
						}
					}

					if !seen["ACTIVE"] || !seen["BANNED"] {
						t.Errorf("missing enum values: %v", seen)
					}

					return
				}

				t.Fatal("Status enum not found")
			},
		},
		{
			name: "TypeRefShape_ListAndNonNull",
			query: `{
				__schema {
					types {
						name
						fields {
							name
							type {
								kind
								name
								ofType { kind name ofType { kind name } }
							}
						}
					}
				}
			}`,
			check: func(t *testing.T, got map[string]any) {
				t.Helper()

				types := schemaTypes(t, got)

				var userFields []map[string]any
				for _, ty := range types {
					if ty["name"] == "User" {
						userFields, _ = ty["fields"].([]map[string]any)
						break
					}
				}

				if userFields == nil {
					t.Fatal("User fields not found")
				}

				// id: ID! → NON_NULL(SCALAR ID)
				// friends(...): [User!]! → NON_NULL(LIST(NON_NULL(OBJECT User)))
				for _, f := range userFields {
					name, _ := f["name"].(string)
					ty, _ := f["type"].(map[string]any)

					switch name {
					case "id":
						if ty["kind"] != "NON_NULL" {
							t.Errorf("id.type.kind = %v, want NON_NULL", ty["kind"])
						}

						inner, _ := ty["ofType"].(map[string]any)
						if inner["kind"] != "SCALAR" || inner["name"] != "ID" {
							t.Errorf("id.type.ofType = %v, want SCALAR ID", inner)
						}
					case "friends":
						if ty["kind"] != "NON_NULL" {
							t.Errorf("friends.type.kind = %v, want NON_NULL", ty["kind"])
						}

						listLayer, _ := ty["ofType"].(map[string]any)
						if listLayer["kind"] != "LIST" {
							t.Errorf(
								"friends.type.ofType.kind = %v, want LIST",
								listLayer["kind"],
							)
						}

						innermost, _ := listLayer["ofType"].(map[string]any)
						if innermost["kind"] != "NON_NULL" {
							t.Errorf("inner kind = %v, want NON_NULL", innermost["kind"])
						}
					}
				}
			},
		},
		{
			name: "FragmentSpreadInsideFullType",
			query: `
				query Q {
					__schema {
						types { ...TypeName }
					}
				}
				fragment TypeName on __Type { name kind }
			`,
			check: func(t *testing.T, got map[string]any) {
				t.Helper()

				types := schemaTypes(t, got)
				if len(types) == 0 {
					t.Fatal("expected types, got none")
				}

				// Every type should have name + kind populated via the fragment.
				for _, ty := range types {
					if ty["name"] == nil {
						t.Errorf("fragment-populated name missing on %+v", ty)
					}

					if ty["kind"] == nil {
						t.Errorf("fragment-populated kind missing on %+v", ty)
					}
				}
			},
		},
		{
			name: "DirectivesField",
			query: `{
				__schema {
					directives {
						name
						isRepeatable
						locations
						args { name }
					}
				}
			}`,
			check: func(t *testing.T, got map[string]any) {
				t.Helper()

				dirs := asMapSlice(t, asMap(t, got["__schema"])["directives"])
				if len(dirs) == 0 {
					t.Fatal("expected at least one directive")
				}

				deprecated := findMapByName(t, dirs, "deprecated")

				repeatable, ok := deprecated["isRepeatable"].(bool)
				if !ok {
					t.Fatalf(
						"expected @deprecated.isRepeatable bool, got %T",
						deprecated["isRepeatable"],
					)
				}

				if repeatable {
					t.Errorf("@deprecated.isRepeatable = true, want false")
				}

				args, _ := deprecated["args"].([]map[string]any)
				if len(args) == 0 {
					t.Fatal("expected @deprecated to have arguments")
				}

				if args[0]["name"] != "reason" {
					t.Errorf("@deprecated args[0].name = %v, want reason", args[0]["name"])
				}

				locs := asStringSlice(t, deprecated["locations"])
				if len(locs) == 0 {
					t.Errorf("@deprecated locations empty")
				}

				custom := findMapByName(t, dirs, "repeatableCustom")
				if repeatable, ok := custom["isRepeatable"].(bool); !ok || !repeatable {
					t.Errorf(
						"@repeatableCustom.isRepeatable = %v (ok=%v), want true",
						custom["isRepeatable"], ok,
					)
				}
			},
		},
		{
			name:  "DirectiveListFilteredAndComplete",
			query: `{ __schema { directives { name } } }`,
			check: func(t *testing.T, got map[string]any) {
				t.Helper()

				dirs := asMapSlice(t, asMap(t, got["__schema"])["directives"])

				names := make(map[string]bool, len(dirs))
				for _, directive := range dirs {
					name, ok := directive["name"].(string)
					if !ok {
						t.Fatalf("expected directive name string, got %T", directive["name"])
					}

					names[name] = true
				}

				for _, want := range []string{"include", "skip", "deprecated", "specifiedBy"} {
					if !names[want] {
						t.Errorf("expected built-in directive %q in output, got %v", want, names)
					}
				}

				for _, banned := range []string{"defer", "oneOf"} {
					if names[banned] {
						t.Errorf(
							"unexpected unsupported directive %q advertised: %v",
							banned,
							names,
						)
					}
				}
			},
		},
		{
			name: "InputFieldsWithDefaultValue",
			query: `{
				__schema {
					types {
						name
						inputFields { name defaultValue type { name kind } }
					}
				}
			}`,
			check: func(t *testing.T, got map[string]any) {
				t.Helper()

				types := schemaTypes(t, got)

				for _, ty := range types {
					if ty["name"] != "UserInput" {
						continue
					}

					inputs, _ := ty["inputFields"].([]map[string]any)
					if len(inputs) != 2 {
						t.Fatalf("expected 2 inputFields, got %d", len(inputs))
					}

					for _, f := range inputs {
						if f["name"] == "score" {
							v, _ := f["defaultValue"].(*string)
							if v == nil || *v != "100" {
								t.Errorf("score.defaultValue = %v, want 100", v)
							}
						}
					}

					return
				}

				t.Fatal("UserInput not found")
			},
		},
		{
			name: "UnionPossibleTypes",
			query: `{
				__schema {
					types {
						name
						possibleTypes { name kind }
					}
				}
			}`,
			check: func(t *testing.T, got map[string]any) {
				t.Helper()

				types := schemaTypes(t, got)

				for _, ty := range types {
					if ty["name"] != "Profile" {
						continue
					}

					pts, _ := ty["possibleTypes"].([]map[string]any)
					if len(pts) != 1 {
						t.Fatalf("expected 1 possibleType for Profile, got %d", len(pts))
					}

					if pts[0]["name"] != "User" {
						t.Errorf(
							"Profile.possibleTypes[0].name = %v, want User",
							pts[0]["name"],
						)
					}

					return
				}

				t.Fatal("Profile union not found")
			},
		},
		{
			name:  "DescriptionPresentAndAbsent",
			query: `{ __schema { types { name description } } }`,
			check: func(t *testing.T, got map[string]any) {
				t.Helper()

				types := schemaTypes(t, got)

				for _, ty := range types {
					if ty["name"] != "User" {
						continue
					}

					desc, _ := ty["description"].(*string)
					if desc == nil || *desc != "User account." {
						t.Errorf("User.description = %v, want 'User account.'", desc)
					}

					return
				}

				t.Fatal("User type not found")
			},
		},
		{
			// Confirm the introspection selectively returns only requested fields —
			// requesting just "name" must not populate "kind" or any other key.
			name:  "OnlyRequestedFieldsAppear",
			query: `{ __schema { queryType { name } } }`,
			check: func(t *testing.T, got map[string]any) {
				t.Helper()

				queryType := asMap(t, asMap(t, got["__schema"])["queryType"])
				if diff := cmp.Diff(map[string]any{"name": "Query"}, queryType); diff != "" {
					t.Errorf("queryType mismatch (-want +got):\n%s", diff)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			schema := loadSchema(t)
			doc, op := loadQuery(t, schema, tt.query)

			got := introspection.Execute(schema, op, doc)

			tt.check(t, got)
		})
	}
}
