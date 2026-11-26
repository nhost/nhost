package schema_test

import (
	"slices"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/customization"
	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
)

const rootFieldsMetadata = `{
  "version": 3,
  "sources": [{
    "name": "default", "kind": "postgres",
    "tables": [{
      "table": {"schema": "storage", "name": "files"},
      "configuration": {
        "custom_name": "files",
        "custom_root_fields": {"select_by_pk": "file", "select_aggregate": "filesAggregate"}
      },
      "select_permissions": [
        {"role": "public", "permission": {
          "columns": ["id", "is_uploaded"], "filter": {"is_uploaded": {"_eq": true}},
          "query_root_fields": ["select_by_pk"], "subscription_root_fields": []
        }},
        {"role": "nested", "permission": {
          "columns": ["id", "is_uploaded"], "filter": {}, "allow_aggregations": true,
          "query_root_fields": [], "subscription_root_fields": []
        }},
        {"role": "stream", "permission": {
          "columns": ["id", "is_uploaded"], "filter": {}, "allow_aggregations": true,
          "query_root_fields": ["select_aggregate"], "subscription_root_fields": ["select_stream"]
        }},
        {"role": "missing_pk", "permission": {
          "columns": ["is_uploaded"], "filter": {},
          "query_root_fields": ["select_by_pk", "select_aggregate"],
          "subscription_root_fields": ["select_by_pk", "select_aggregate"]
        }},
        {"role": "unrestricted", "permission": {"columns": ["id", "is_uploaded"], "filter": {}}}
      ]
    }, {
      "table": {"schema": "public", "name": "versions"},
      "select_permissions": [{"role": "public", "permission": {"columns": ["id"], "filter": {}}}]
    }, {
      "table": {"schema": "public", "name": "releases"},
      "array_relationships": [{"name": "attachments", "using": {"manual_configuration": {
        "remote_table": {"schema": "storage", "name": "files"}, "column_mapping": {"id": "id"}
      }}}],
      "select_permissions": [{"role": "nested", "permission": {"columns": ["id"], "filter": {}}}]
    }]
  }]
}`

func TestGenerateForRole_RootFieldPermissions(t *testing.T) {
	t.Parallel()

	md, err := metadata.FromHasuraJSON([]byte(rootFieldsMetadata))
	if err != nil {
		t.Fatalf("loading metadata: %v", err)
	}

	objects := rootFieldObjects()
	caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())
	tests := []struct {
		role          string
		queries       []string
		subscriptions []string
		keep          []string
		omit          []string
	}{
		{
			role: "public", queries: []string{"file"},
			keep: []string{"files", "uuid", "versions_bool_exp", "versions_stream_cursor_input"},
			omit: []string{
				"files_bool_exp",
				"files_order_by",
				"files_select_column",
				"files_stream_cursor_input",
				"files_stream_cursor_value_input",
				"Boolean_comparison_exp",
			},
		},
		{
			role: "nested", keep: []string{
				"files", "files_bool_exp", "files_order_by",
				"files_select_column", "files_aggregate", "Boolean_comparison_exp",
			},
			omit: []string{"files_stream_cursor_input", "files_stream_cursor_value_input"},
		},
		{
			role:          "stream",
			queries:       []string{"filesAggregate"},
			subscriptions: []string{"files_stream"},
			keep: []string{
				"files_aggregate",
				"files_stream_cursor_input",
				"cursor_ordering",
			},
		},
		{
			role: "missing_pk", omit: []string{"files", "files_bool_exp", "cursor_ordering"},
		},
		{
			role: "unrestricted", queries: []string{"file", "files"},
			subscriptions: []string{"file", "files", "files_stream"},
		},
		{
			role: "admin", queries: []string{"file", "files", "filesAggregate"},
			subscriptions: []string{"file", "files", "filesAggregate", "files_stream"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.role, func(t *testing.T) {
			t.Parallel()

			generated, err := schema.GenerateForRole(objects, tt.role, &md.Databases[0], caps)
			if err != nil {
				t.Fatalf("generating schema: %v", err)
			}

			validated := validateRootFieldsTestSchema(t, generated, tt.role)

			assertFileRootFields(t, "query", validated.Query, tt.queries)
			assertFileRootFields(t, "subscription", validated.Subscription, tt.subscriptions)
			assertFileTypes(t, validated, tt.keep, tt.omit)
		})
	}
}

func TestGenerateForRole_CustomizedRootFieldPermissions(t *testing.T) {
	t.Parallel()

	md, err := metadata.FromHasuraJSON([]byte(rootFieldsMetadata))
	if err != nil {
		t.Fatalf("loading metadata: %v", err)
	}

	objects := rootFieldObjects()

	caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())
	for _, tt := range []struct {
		role    string
		queries []string
		keep    []string
		omit    []string
	}{
		{
			role: "public", queries: []string{"file"}, keep: []string{"pfx_files"},
			omit: []string{"pfx_files_bool_exp", "pfx_files_stream_cursor_input"},
		},
		{
			role: "nested", keep: []string{"pfx_files", "pfx_files_bool_exp"},
			omit: []string{"pfx_files_stream_cursor_input"},
		},
	} {
		t.Run(tt.role, func(t *testing.T) {
			t.Parallel()

			generated, err := schema.GenerateForRole(objects, tt.role, &md.Databases[0], caps)
			if err != nil {
				t.Fatalf("generating schema: %v", err)
			}

			customizer := customization.New(metadata.Customization{
				RootFieldsNamespace: "ns", TypeNamesPrefix: "pfx_",
			}, customization.FlavorDatabase)
			validated := validateRootFieldsTestSchema(t, customizer.Apply(generated), tt.role)

			query := validated.Types["pfx_ns_query"]

			subscription := validated.Types["pfx_ns_subscription"]
			if query == nil || subscription == nil {
				t.Fatal("missing customized operation wrappers")
			}

			assertFileRootFields(t, "query", query, tt.queries)
			assertFileRootFields(t, "subscription", subscription, nil)
			assertFileTypes(t, validated, tt.keep, tt.omit)
		})
	}
}

func validateRootFieldsTestSchema(t *testing.T, generated *graph.Schema, role string) *ast.Schema {
	t.Helper()

	var combined graph.Schema
	if err := schemamerge.MergeConnectorSchema(
		generated, &combined, "default", make(map[string]string), nil,
	); err != nil {
		t.Fatalf("merging schema: %v", err)
	}

	_, validated, err := schemamerge.BuildValidatedSchema(&combined, role)
	if err != nil {
		t.Fatalf("validating schema: %v", err)
	}

	return validated
}

func rootFieldObjects() *introspection.Objects {
	objects := introspection.NewObjects()
	objects.Schemas["public"] = &introspection.Schema{Tables: map[string]*introspection.Table{
		"versions": {
			Name: "versions", Schema: "public", PrimaryKeys: []string{"id"},
			Columns: []introspection.Column{{Name: "id", Type: "uuid"}},
		},
		"releases": {
			Name: "releases", Schema: "public", PrimaryKeys: []string{"id"},
			Columns: []introspection.Column{{Name: "id", Type: "uuid"}},
		},
	}}
	objects.Schemas["storage"] = &introspection.Schema{Tables: map[string]*introspection.Table{
		"files": {
			Name:        "files",
			Schema:      "storage",
			PrimaryKeys: []string{"id"},
			Columns: []introspection.Column{
				{Name: "id", Type: "uuid"},
				{Name: "is_uploaded", Type: "boolean"},
			},
		},
	}}

	return objects
}

func assertFileRootFields(t *testing.T, operation string, root *ast.Definition, want []string) {
	t.Helper()

	var got []string
	if root != nil {
		for _, field := range root.Fields {
			if strings.HasPrefix(field.Name, "file") {
				got = append(got, field.Name)
			}
		}
	}

	slices.Sort(got)

	if !slices.Equal(got, want) {
		t.Errorf("%s roots for files = %v, want %v", operation, got, want)
	}
}

func assertFileTypes(t *testing.T, validated *ast.Schema, keep, omit []string) {
	t.Helper()

	for _, name := range keep {
		if validated.Types[name] == nil {
			t.Errorf("schema is missing reachable type %s", name)
		}
	}

	for _, name := range omit {
		if validated.Types[name] != nil {
			t.Errorf("schema still includes unreachable type %s", name)
		}
	}
}
