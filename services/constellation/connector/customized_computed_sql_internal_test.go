package connector

import (
	"errors"
	"log/slog"
	"os"
	"reflect"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/customization"
	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

func TestCustomizedComputedSQLValidationPaths(t *testing.T) {
	t.Parallel()

	ddl, err := os.ReadFile(
		"../integration/nhost/migrations/default/1790001000000_computed_fields/up.sql",
	)
	if err != nil {
		t.Fatal(err)
	}

	seed, err := os.ReadFile("../integration/nhost/seeds/default/40-computed-fields.sql")
	if err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile("../integration/computedfields/testdata/metadata.json")
	if err != nil {
		t.Fatal(err)
	}

	md, err := metadata.FromHasuraJSON(raw)
	if err != nil {
		t.Fatal(err)
	}

	pool := testdb.NewPostgres(t, string(ddl), string(seed))
	caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())
	caps.SupportsComputedScalarSelection = true

	pgPool, err := postgres.Open(t.Context(), pool.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatal(err)
	}

	inner, err := csql.NewConnector(
		t.Context(), postgres.NewClient(pgPool), &md.Databases[0], nil, slog.Default(), caps,
	)
	if err != nil {
		pgPool.Close()

		t.Fatal(err)
	}

	t.Cleanup(inner.Close)

	tests := []struct {
		name, query, path, message string
		cfg                        metadata.Customization
		omission                   bool
	}{
		{
			name:    "prefixed root",
			cfg:     metadata.Customization{RootFieldsPrefix: "db_"},
			query:   `query { db_cf_select_items { item_score(args:null) } }`,
			path:    "$.selectionSet.db_cf_select_items.selectionSet.item_score.args.args",
			message: "expected an object for type 'item_score_cf_select_items_args', but found null",
		},
		{
			name:    "aliased prefixed root",
			cfg:     metadata.Customization{RootFieldsPrefix: "db_"},
			query:   `query { alias:db_cf_select_items { score:item_score(args:null) } }`,
			path:    "$.selectionSet.db_cf_select_items.selectionSet.item_score.args.args",
			message: "expected an object for type 'item_score_cf_select_items_args', but found null",
		},
		{
			name:    "namespace aliases",
			cfg:     metadata.Customization{RootFieldsNamespace: "catalog"},
			query:   `query { c:catalog { d:cf_select_items { score:item_score(args:null) } } }`,
			path:    "$.selectionSet.catalog.selectionSet.cf_select_items.selectionSet.item_score.args.args",
			message: "expected an object for type 'item_score_cf_select_items_args', but found null",
		},
		{
			name: "suffix omission", cfg: metadata.Customization{RootFieldsSuffix: "_db"},
			query:   `query { x:cf_select_items_db { s:item_second(args:{}) } }`,
			path:    "$.selectionSet.cf_select_items_db.selectionSet.item_second.args.args",
			message: "Non default arguments cannot be omitted", omission: true,
		},
		{
			name:     "namespace omission",
			cfg:      metadata.Customization{RootFieldsNamespace: "catalog"},
			query:    `query { c:catalog { d:cf_select_items { s:item_second(args:{}) } } }`,
			path:     "$.selectionSet.catalog.selectionSet.cf_select_items.selectionSet.item_second.args.args",
			message:  "Non default arguments cannot be omitted",
			omission: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			conn, err := newCustomizedConnector(
				"cf_select",
				inner,
				tt.cfg,
				customization.FlavorDatabase,
			)
			if err != nil {
				t.Fatal(err)
			}

			doc, err := parser.ParseQuery(&ast.Source{Input: tt.query})
			if err != nil {
				t.Fatal(err)
			}

			err = conn.ValidateOperation(doc.Operations[0], doc.Fragments, nil, "cf_reader", nil)

			var got map[string]any
			if tt.omission {
				var omission *arguments.ComputedOmissionError
				if !errors.As(err, &omission) {
					t.Fatalf("expected omission error: %v", err)
				}

				got = omission.AsMap()
			} else {
				var validation *arguments.QueryValidationError
				if !errors.As(err, &validation) {
					t.Fatalf("expected validation error: %v", err)
				}

				got = validation.AsMap()
			}

			code := "validation-failed"
			if tt.omission {
				code = "not-supported"
			}

			want := map[string]any{
				"message":    tt.message,
				"extensions": map[string]any{"path": tt.path, "code": code},
			}
			if !reflect.DeepEqual(got, want) {
				t.Fatalf("validation = %#v, want %#v", got, want)
			}
		})
	}
}
