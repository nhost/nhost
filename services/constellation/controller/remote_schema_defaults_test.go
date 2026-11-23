package controller_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/validator"
	"github.com/vektah/gqlparser/v2/validator/rules"

	"github.com/nhost/nhost/services/constellation/controller"
	gqlintrospection "github.com/nhost/nhost/services/constellation/controller/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

const remoteDefaultsSDL = `
scalar JSON
enum Order { ASC DESC }
input Inner { value: Int = 7 }
input Filter {
 order: Order = ASC
 status: String = "draft"
 tags: [String] = ["a", "b"]
 inner: Inner = {value: 3}
 required: Order! = DESC
 plain: String
}
type Query {
 echo(
  order: Order = ASC
  status: String = "draft"
  filter: Filter = {plain: "default"}
  tags: [String] = ["a"]
  required: Order! = DESC
  plain: String
 ): JSON!
}
input Predicate {
 _and: [Predicate!]
 _or: [Predicate!]
 _not: Predicate
 status: String = "draft"
 required: Order! = DESC
 plain: String
}
type Mutation {
 change(where: Predicate = {status: "selected"}): JSON!
}
`

func TestRemoteSchemaOmittedVariableDefaults(t *testing.T) {
	t.Parallel()

	remote := remoteDefaultsServer(t)

	ctrl, err := newComputedController(t, &metadata.Metadata{
		RemoteSchemas: []metadata.RemoteSchemaMetadata{{
			Name:       "defaults",
			Definition: metadata.RemoteSchemaDefinition{URL: metadata.EnvString(remote.URL)},
			Permissions: []metadata.RemoteSchemaPermission{{
				Role:       "reader",
				Definition: metadata.RemoteSchemaPermissionDef{Schema: remoteDefaultsSDL},
			}},
		}},
	}, false)
	if err != nil {
		t.Fatal(err)
	}

	if inconsistencies := ctrl.Inconsistencies(); len(inconsistencies) != 0 {
		t.Fatalf("inconsistencies: %+v", inconsistencies)
	}

	router := newTestRouter(t, ctrl)

	tests := []struct {
		name      string
		query     string
		literal   string
		variables map[string]any
		wantError string
	}{
		{
			"mutation selector argument default",
			`mutation($v:Predicate){change(where:$v)}`,
			`mutation{change}`,
			nil,
			"",
		},
		{
			"mutation selector field default",
			`mutation($v:String){change(where:{status:$v})}`,
			`mutation{change(where:{})}`,
			nil,
			"",
		},
		{
			"mutation non-null selector field default",
			`mutation($v:Order){change(where:{required:$v})}`,
			`mutation{change(where:{})}`,
			nil,
			"",
		},
		{
			"mutation nested selector field default",
			`mutation($v:String){change(where:{_and:[{status:$v}]})}`,
			`mutation{change(where:{_and:[{}]})}`,
			nil,
			"",
		},
		{
			"mutation default preserves sibling restriction",
			`mutation($v:String){change(where:{status:$v,plain:"keep"})}`,
			`mutation{change(where:{plain:"keep"})}`,
			nil,
			"",
		},
		{
			"mutation omitted non-defaulted restriction",
			`mutation($v:String){change(where:{plain:$v})}`,
			"",
			nil,
			"a variable used in a mutation where input must be provided",
		},
		{
			"mutation default does not allow omitted sibling restriction",
			`mutation($v:String){change(where:{status:$v,plain:$v})}`,
			"",
			nil,
			"a variable used in a mutation where input must be provided",
		},
		{
			"mutation selector operation default",
			`mutation($v:Predicate={status:"published"}){change(where:$v)}`,
			`mutation{change(where:{status:"published"})}`,
			nil,
			"",
		},
		{
			"mutation selector explicit null",
			`mutation($v:Predicate){change(where:$v)}`,
			`mutation{change(where:null)}`,
			map[string]any{"v": nil},
			"",
		},
		{
			"mutation selector field explicit null",
			`mutation($v:String){change(where:{status:$v})}`,
			`mutation{change(where:{status:null})}`,
			map[string]any{"v": nil},
			"",
		},
		{
			"mutation null at non-null selector field",
			`mutation($v:Order){change(where:{required:$v})}`,
			"",
			map[string]any{"v": nil},
			"non-null input",
		},
		{"enum argument", `query($v:Order){echo(order:$v)}`, `{echo}`, nil, ""},
		{"string argument", `query($v:String){echo(status:$v)}`, `{echo}`, nil, ""},
		{"object argument", `query($v:Filter){echo(filter:$v)}`, `{echo}`, nil, ""},
		{"list argument", `query($v:[String]){echo(tags:$v)}`, `{echo}`, nil, ""},
		{"non-null argument with default", `query($v:Order){echo(required:$v)}`, `{echo}`, nil, ""},
		{"enum field", `query($v:Order){echo(filter:{order:$v})}`, `{echo(filter:{})}`, nil, ""},
		{
			"string field",
			`query($v:String){echo(filter:{status:$v})}`,
			`{echo(filter:{})}`,
			nil,
			"",
		},
		{"object field", `query($v:Inner){echo(filter:{inner:$v})}`, `{echo(filter:{})}`, nil, ""},
		{"list field", `query($v:[String]){echo(filter:{tags:$v})}`, `{echo(filter:{})}`, nil, ""},
		{
			"non-null field with default",
			`query($v:Order){echo(filter:{required:$v})}`,
			`{echo(filter:{})}`,
			nil,
			"",
		},
		{
			"nested field",
			`query($v:Int){echo(filter:{inner:{value:$v}})}`,
			`{echo(filter:{inner:{}})}`,
			nil,
			"",
		},
		{
			"preserve siblings",
			`query($v:Order){echo(filter:{order:$v,plain:"keep"})}`,
			`{echo(filter:{plain:"keep"})}`,
			nil,
			"",
		},
		{"no argument default", `query($v:String){echo(plain:$v)}`, `{echo}`, nil, ""},
		{
			"no field default",
			`query($v:String){echo(filter:{plain:$v})}`,
			`{echo(filter:{})}`,
			nil,
			"",
		},
		{
			"list position",
			`query($v:String){echo(tags:["a",$v,"b"])}`,
			`{echo(tags:["a",null,"b"])}`,
			nil,
			"",
		},
		{
			"operation default",
			`query($v:Order=DESC){echo(order:$v)}`,
			`{echo(order:DESC)}`,
			nil,
			"",
		},
		{
			"operation null default",
			`query($v:Order=null){echo(order:$v)}`,
			`{echo(order:null)}`,
			nil,
			"",
		},
		{
			"operation string default",
			`query($v:String="published"){echo(status:$v)}`,
			`{echo(status:"published")}`,
			nil,
			"",
		},
		{
			"provided on cached query",
			`query($v:Order){echo(order:$v)}`,
			`{echo(order:DESC)}`,
			map[string]any{"v": "DESC"},
			"",
		},
		{
			"null on cached query",
			`query($v:Order){echo(order:$v)}`,
			`{echo(order:null)}`,
			map[string]any{"v": nil},
			"",
		},
		{
			"null overrides operation default",
			`query($v:Order=DESC){echo(order:$v)}`,
			`{echo(order:null)}`,
			map[string]any{"v": nil},
			"",
		},
		{
			"null field",
			`query($v:Order){echo(filter:{order:$v})}`,
			`{echo(filter:{order:null})}`,
			map[string]any{"v": nil},
			"",
		},
		{
			"null object",
			`query($v:Filter){echo(filter:$v)}`,
			`{echo(filter:null)}`,
			map[string]any{"v": nil},
			"",
		},
		{
			"null list",
			`query($v:[String]){echo(tags:$v)}`,
			`{echo(tags:null)}`,
			map[string]any{"v": nil},
			"",
		},
		{
			"null at non-null argument",
			`query($v:Order){echo(required:$v)}`,
			"",
			map[string]any{"v": nil},
			"non-null input",
		},
		{
			"null at non-null field",
			`query($v:Order){echo(filter:{required:$v})}`,
			"",
			map[string]any{"v": nil},
			"non-null input",
		},
	}
	for _, role := range []string{"admin", "reader"} {
		t.Run(role, func(t *testing.T) {
			t.Parallel()

			for _, tt := range tests {
				t.Run(tt.name, func(t *testing.T) {
					t.Parallel()

					checkRemoteSchemaDefaults(t, router, role, controller.GraphQLRequest{
						Query: tt.query, Variables: tt.variables,
					}, tt.literal, tt.wantError)
				})
			}
		})
	}
}

func checkRemoteSchemaDefaults(
	t *testing.T, router http.Handler, role string,
	request controller.GraphQLRequest, literal, wantError string,
) {
	t.Helper()

	response := nullableOrderByResponse(t, router, role, request)
	if wantError != "" {
		if !strings.Contains(fmt.Sprint(response.Errors), wantError) || response.Data != nil {
			t.Fatalf("expected %q without data, got %+v", wantError, response)
		}

		return
	}

	if response.Errors != nil {
		t.Fatalf("variable response: %+v", response)
	}

	baseline := nullableOrderByResponse(t, router, role, controller.GraphQLRequest{Query: literal})
	if baseline.Errors != nil || baseline.Data == nil {
		t.Fatalf("literal response: %+v", baseline)
	}

	if diff := cmp.Diff(baseline.Data, response.Data); diff != "" {
		t.Errorf("remote defaults (-literal +variable):\n%s", diff)
	}
}

// The remote uses the original parsed SDL, not Constellation's intermediate
// schema, so lost enum kinds, string quoting and container children are visible.
func remoteDefaultsServer(t *testing.T) *httptest.Server {
	t.Helper()

	schema := gqlparser.MustLoadSchema(&ast.Source{Input: remoteDefaultsSDL})
	remote := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		var body controller.GraphQLRequest
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}

		doc, errs := gqlparser.LoadQueryWithRules(schema, body.Query, rules.NewDefaultRules())
		if len(errs) != 0 {
			if err := json.NewEncoder(w).Encode(map[string]any{"errors": errs}); err != nil {
				t.Errorf("writing validation errors: %v", err)
			}

			return
		}

		operation := doc.Operations[0]

		variables, err := validator.VariableValues(schema, operation, body.Variables)
		if err != nil {
			t.Errorf("remote variables: %v", err)
			http.Error(w, "invalid variables", http.StatusBadRequest)

			return
		}

		data := gqlintrospection.Execute(schema, operation, doc)
		for _, selection := range operation.SelectionSet {
			field, ok := selection.(*ast.Field)
			if !ok || (field.Name != "echo" && field.Name != "change") {
				continue
			}

			args, err := remoteDefaultArguments(schema, field, variables)
			if err != nil {
				t.Errorf("remote arguments: %v", err)
				http.Error(w, "invalid arguments", http.StatusBadRequest)

				return
			}

			data[field.Alias] = args
		}

		if err := json.NewEncoder(w).Encode(map[string]any{"data": data}); err != nil {
			t.Errorf("writing remote response: %v", err)
		}
	}))
	t.Cleanup(remote.Close)

	return remote
}

func remoteDefaultArguments(
	schema *ast.Schema, field *ast.Field, variables map[string]any,
) (map[string]any, error) {
	args, err := field.TryArgumentMap(variables)
	if err != nil {
		return nil, fmt.Errorf("reading arguments: %w", err)
	}

	// ArgumentMap applies argument defaults, but not defaults within input
	// objects. Apply those from the remote's original schema as well.
	for _, definition := range field.Definition.Arguments {
		value, exists := args[definition.Name]
		if !exists {
			continue
		}

		resolved, err := remoteInputDefaults(schema, definition.Type, value)
		if err != nil {
			return nil, fmt.Errorf("defaulting argument %s: %w", definition.Name, err)
		}

		args[definition.Name] = resolved
	}

	return args, nil
}

func remoteInputDefaults(schema *ast.Schema, typ *ast.Type, value any) (any, error) {
	if value == nil {
		return value, nil
	}

	if typ.Elem != nil {
		items, ok := value.([]any)
		if !ok {
			items = []any{value}
		}

		result := make([]any, len(items))
		for i, item := range items {
			resolved, err := remoteInputDefaults(schema, typ.Elem, item)
			if err != nil {
				return nil, fmt.Errorf("defaulting list item %d: %w", i, err)
			}

			result[i] = resolved
		}

		return result, nil
	}

	fields, ok := value.(map[string]any)
	if !ok || schema.Types[typ.Name()].Kind != ast.InputObject {
		return value, nil
	}

	for _, definition := range schema.Types[typ.Name()].Fields {
		field, exists := fields[definition.Name]
		if !exists && definition.DefaultValue != nil {
			var err error

			field, err = definition.DefaultValue.Value(nil)
			if err != nil {
				return nil, fmt.Errorf("reading field default %s: %w", definition.Name, err)
			}

			exists = true
		}

		if !exists {
			continue
		}

		resolved, err := remoteInputDefaults(schema, definition.Type, field)
		if err != nil {
			return nil, fmt.Errorf("defaulting input field %s: %w", definition.Name, err)
		}

		fields[definition.Name] = resolved
	}

	return fields, nil
}
