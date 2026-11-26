package composer_test

import (
	"log/slog"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/composer"
	"github.com/nhost/nhost/services/constellation/connector/composer/mock"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
	"go.uber.org/mock/gomock"
)

const crossSourceRootFieldsMetadata = `{
  "version": 3,
  "sources": [{
    "name": "a_restricted", "kind": "postgres",
    "tables": [{
      "table": {"schema": "storage", "name": "files"},
      "configuration": {"custom_name": "files"},
      "select_permissions": [{"role": "reader", "permission": {
        "columns": ["id"], "filter": {}, "allow_aggregations": true,
        "query_root_fields": [], "subscription_root_fields": []
      }}]
    }]
  }, {
    "name": "b_open", "kind": "postgres",
    "tables": [{
      "table": {"schema": "public", "name": "releases"},
      "select_permissions": [{"role": "reader", "permission": {"columns": ["id"], "filter": {}}}],
      "remote_relationships": [{"name": "attachments", "definition": {
        "to_source": {
          "source": "a_restricted", "table": {"schema": "storage", "name": "files"},
          "relationship_type": "array", "field_mapping": {"id": "id"}
        }
      }}]
    }]
  }]
}`

func TestCompose_RootRestrictionsPreserveCrossSourceRelationships(t *testing.T) {
	t.Parallel()

	md, err := metadata.FromHasuraJSON([]byte(crossSourceRootFieldsMetadata))
	if err != nil {
		t.Fatalf("loading metadata: %v", err)
	}

	const role = "reader"

	restricted := generateRootFieldsTestSchema(t, role, &md.Databases[0])
	open := generateRootFieldsTestSchema(t, role, &md.Databases[1])
	// The last connector has no restrictions. Its unused type must still be
	// pruned because the first connector's restriction flag is OR-merged.
	open.Types = append(open.Types, &graph.ObjectType{
		Name: "spare", Fields: []*graph.Field{{Name: "id", Type: graph.NewNamedType("ID")}},
	})

	mocks := gomock.NewController(t)
	target := mock.NewMockSchemaProvider(mocks)
	target.EXPECT().GetSchema().Return(map[string]*graph.Schema{role: restricted}, nil)
	target.EXPECT().GetTypeName("storage.files").Return("files").AnyTimes()

	source := mock.NewMockSchemaProvider(mocks)
	source.EXPECT().GetSchema().Return(map[string]*graph.Schema{role: open}, nil)
	source.EXPECT().GetTypeName("public.releases").Return("releases").AnyTimes()

	providers := map[string]composer.SchemaProvider{"a_restricted": target, "b_open": source}
	incs := metadata.NewInconsistencies()
	result := composer.New(providers, md, incs).Compose(t.Context(), slog.New(slog.DiscardHandler))

	validated := result.ValidatedSchemas[role]
	if validated == nil || validated.Query == nil || validated.Subscription == nil {
		t.Fatalf("role lost its open source roots: %v", incs.Snapshot())
	}

	for _, root := range []string{"files", "files_by_pk", "files_aggregate", "files_stream"} {
		if validated.Query.Fields.ForName(root) != nil ||
			validated.Subscription.Fields.ForName(root) != nil {
			t.Errorf("unexpected restricted root %s", root)
		}
	}

	if result.EmptyQueryRoots[role] || validated.Query.Fields.ForName("releases") == nil {
		t.Error("an unrestricted source should supply the role's query root")
	}

	assertRestrictedRelationshipTypes(t, validated)
}

func assertRestrictedRelationshipTypes(t *testing.T, validated *ast.Schema) {
	t.Helper()

	releases := validated.Types["releases"]
	if releases == nil || releases.Fields.ForName("attachments") == nil ||
		releases.Fields.ForName("attachments_aggregate") == nil {
		t.Fatal("cross-source relationship or its aggregate was pruned")
	}

	for _, name := range []string{"files", "files_bool_exp", "files_order_by", "files_select_column", "files_aggregate"} {
		if validated.Types[name] == nil {
			t.Errorf("missing reachable type %s", name)
		}
	}

	for _, name := range []string{"files_stream_cursor_input", "files_stream_cursor_value_input", "spare"} {
		if validated.Types[name] != nil {
			t.Errorf("unexpected unreachable type %s", name)
		}
	}
}

func generateRootFieldsTestSchema(
	t *testing.T,
	role string,
	db *metadata.DatabaseMetadata,
) *graph.Schema {
	t.Helper()

	table := db.Tables[0].Table
	objects := introspection.NewObjects()
	objects.Schemas[table.Schema] = &introspection.Schema{Tables: map[string]*introspection.Table{
		table.Name: {
			Name: table.Name, Schema: table.Schema, PrimaryKeys: []string{"id"},
			Columns: []introspection.Column{{Name: "id", Type: "uuid"}},
		},
	}}
	caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())

	generated, err := schema.GenerateForRole(objects, role, db, caps)
	if err != nil {
		t.Fatalf("generating schema for %s: %v", db.Name, err)
	}

	return generated
}
