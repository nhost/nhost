package memconnector_test

import (
	"context"
	"encoding/json/jsontext"
	"log/slog"
	"strings"
	"testing"

	conn "github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/connector/memconnector"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
	"github.com/vektah/gqlparser/v2/validator"
	"github.com/vektah/gqlparser/v2/validator/rules"
)

// buildAndValidate constructs a memconnector from the given objects and
// queries, fetches the admin schema, and validates it against the gqlparser
// prelude. It returns the connector and the validated schema for tests that
// need to load and execute queries.
func buildAndValidate(
	t *testing.T,
	objects []*graph.ObjectType,
	queries []memconnector.QueryDef,
) (conn.Connector, *ast.Schema) {
	t.Helper()

	c, err := memconnector.New(objects, queries)
	if err != nil {
		t.Fatalf("memconnector.New: %v", err)
	}

	schemas, err := c.GetSchema()
	if err != nil {
		t.Fatalf("GetSchema() error: %v", err)
	}

	schemaDoc := schemas["admin"].ToAST()

	prelude, err := parser.ParseSchema(validator.Prelude)
	if err != nil {
		t.Fatalf("ParseSchema(Prelude) error: %v", err)
	}

	merged := &ast.SchemaDocument{
		Definitions: append(prelude.Definitions, schemaDoc.Definitions...),
		Directives:  append(prelude.Directives, schemaDoc.Directives...),
		Schema:      schemaDoc.Schema,
	}

	validated, err := validator.ValidateSchemaDocument(merged)
	if err != nil {
		t.Fatalf("schema validation failed: %v", err)
	}

	return c, validated
}

func TestGetSchema(t *testing.T) {
	t.Parallel()

	conn, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object(
				"User",
				memconnector.ID("id"),
				memconnector.String("name"),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"users",
				graph.NewNonNullListType(graph.NewNonNullType("User")),
				nil,
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New: %v", err)
	}

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatalf("GetSchema() error: %v", err)
	}

	adminSchema, ok := schemas["admin"]
	if !ok {
		t.Fatal("expected admin schema")
	}

	if adminSchema.QueryType == nil || *adminSchema.QueryType != "query_root" {
		t.Fatal("expected QueryType to be query_root")
	}

	// Should have query_root + User = 2 types
	if len(adminSchema.Types) != 2 {
		t.Fatalf("expected 2 types, got %d", len(adminSchema.Types))
	}

	// Verify query_root has the users field
	queryRoot := adminSchema.Types[0]
	if queryRoot.Name != "query_root" {
		t.Fatalf("expected query_root, got %s", queryRoot.Name)
	}

	if len(queryRoot.Fields) != 1 || queryRoot.Fields[0].Name != "users" {
		t.Fatal("expected users field on query_root")
	}
}

func TestGetSchemaValidates(t *testing.T) {
	t.Parallel()

	buildAndValidate(
		t,
		[]*graph.ObjectType{
			memconnector.Object(
				"User",
				memconnector.ID("id"),
				memconnector.String("email"),
				memconnector.Int("age"),
				memconnector.Float("score"),
				memconnector.Boolean("active"),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"users",
				graph.NewNonNullListType(graph.NewNonNullType("User")),
				nil,
			),
		},
	)
}

func TestExecute(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		query     string
		expectKey string
		absentKey string
	}{
		{"direct", `{ users { id name } }`, "users", ""},
		{"alias", `{ allUsers: users { id } }`, "allUsers", "users"},
	}

	response := jsontext.Value(`[{"id":"1","name":"Alice"}]`)

	c, validatedSchema := buildAndValidate(
		t,
		[]*graph.ObjectType{
			memconnector.Object(
				"User",
				memconnector.ID("id"),
				memconnector.String("name"),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"users",
				graph.NewNonNullListType(graph.NewNonNullType("User")),
				response,
			),
		},
	)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			query, errs := gqlparser.LoadQueryWithRules(
				validatedSchema,
				tt.query,
				rules.NewDefaultRules(),
			)
			if errs != nil {
				t.Fatalf("LoadQuery() errors: %v", errs)
			}

			result, err := c.Execute(
				context.Background(),
				query.Operations[0],
				query.Fragments,
				nil,
				"admin",
				nil,
				slog.Default(),
			)
			if err != nil {
				t.Fatalf("Execute() error: %v", err)
			}

			if _, ok := result[tt.expectKey]; !ok {
				t.Fatalf("expected %q key in result", tt.expectKey)
			}

			if tt.absentKey != "" {
				if _, ok := result[tt.absentKey]; ok {
					t.Fatalf("should not have %q key when alias is used", tt.absentKey)
				}
			}
		})
	}
}

func TestExecuteErrors(t *testing.T) {
	t.Parallel()

	c, validatedSchema := buildAndValidate(
		t,
		[]*graph.ObjectType{
			memconnector.Object(
				"User",
				memconnector.ID("id"),
				memconnector.String("name"),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"users",
				graph.NewNonNullListType(graph.NewNonNullType("User")),
				jsontext.Value(`[]`),
			),
		},
	)

	t.Run("fragment_at_root", func(t *testing.T) {
		t.Parallel()

		// Inline-fragment as the operation root selection is not a *ast.Field
		// and must surface as an error rather than a panic.
		op := &ast.OperationDefinition{
			Operation: ast.Query,
			SelectionSet: ast.SelectionSet{
				&ast.InlineFragment{
					TypeCondition: "query_root",
					SelectionSet: ast.SelectionSet{
						&ast.Field{Name: "users", Alias: "users"},
					},
				},
			},
		}

		_, err := c.Execute(
			context.Background(),
			op,
			nil,
			nil,
			"admin",
			nil,
			slog.Default(),
		)
		if err == nil {
			t.Fatal("expected error for non-Field selection at root, got nil")
		}
	})

	t.Run("missing_response", func(t *testing.T) {
		t.Parallel()

		// Query a field not registered with a canned response.
		query, errs := gqlparser.LoadQueryWithRules(
			validatedSchema,
			`{ __typename }`,
			rules.NewDefaultRules(),
		)
		if errs != nil {
			t.Fatalf("LoadQuery() errors: %v", errs)
		}

		_, err := c.Execute(
			context.Background(),
			query.Operations[0],
			query.Fragments,
			nil,
			"admin",
			nil,
			slog.Default(),
		)
		if err == nil {
			t.Fatal("expected error for unregistered field, got nil")
		}
	})
}

func TestFieldBuilders(t *testing.T) {
	t.Parallel()

	buildAndValidate(
		t,
		[]*graph.ObjectType{
			memconnector.Object(
				"Thing",
				memconnector.Field("related", memconnector.Named("Thing")),
				memconnector.Field("ref", memconnector.NonNull("ID")),
				memconnector.Field("tags", memconnector.NonNullList(memconnector.Named("String"))),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"things",
				memconnector.NonNullList(memconnector.NonNull("Thing")),
				nil,
			),
		},
	)
}

func TestTypeBuildersShape(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		got  *graph.Type
		want graph.Type
	}{
		{
			name: "Named is nullable scalar reference",
			got:  memconnector.Named("String"),
			want: graph.Type{NamedType: "String", NonNull: false, Elem: nil},
		},
		{
			name: "NonNull is non-null scalar reference",
			got:  memconnector.NonNull("ID"),
			want: graph.Type{NamedType: "ID", NonNull: true, Elem: nil},
		},
		{
			name: "NonNullList wraps element in non-null list",
			got:  memconnector.NonNullList(memconnector.Named("String")),
			want: graph.Type{
				NamedType: "",
				NonNull:   true,
				Elem:      &graph.Type{NamedType: "String", NonNull: false, Elem: nil},
			},
		},
		{
			name: "NonNullList preserves non-null element",
			got:  memconnector.NonNullList(memconnector.NonNull("User")),
			want: graph.Type{
				NamedType: "",
				NonNull:   true,
				Elem:      &graph.Type{NamedType: "User", NonNull: true, Elem: nil},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if tt.got == nil {
				t.Fatal("builder returned nil *graph.Type")
			}

			if tt.got.NamedType != tt.want.NamedType {
				t.Errorf("NamedType: got %q, want %q", tt.got.NamedType, tt.want.NamedType)
			}

			if tt.got.NonNull != tt.want.NonNull {
				t.Errorf("NonNull: got %v, want %v", tt.got.NonNull, tt.want.NonNull)
			}

			switch {
			case tt.want.Elem == nil && tt.got.Elem != nil:
				t.Errorf("Elem: got %+v, want nil", tt.got.Elem)
			case tt.want.Elem != nil && tt.got.Elem == nil:
				t.Errorf("Elem: got nil, want %+v", tt.want.Elem)
			case tt.want.Elem != nil && tt.got.Elem != nil:
				if *tt.got.Elem != *tt.want.Elem {
					t.Errorf("Elem: got %+v, want %+v", *tt.got.Elem, *tt.want.Elem)
				}
			}
		})
	}
}

func TestFieldShape(t *testing.T) {
	t.Parallel()

	typ := memconnector.NonNull("ID")
	field := memconnector.Field("id", typ)

	if field == nil {
		t.Fatal("Field returned nil")
	}

	if field.Name != "id" {
		t.Errorf("Name: got %q, want %q", field.Name, "id")
	}

	if field.Type != typ {
		t.Errorf("Type: got %+v, want %+v (same pointer)", field.Type, typ)
	}

	if field.Description != "" {
		t.Errorf("Description: got %q, want empty", field.Description)
	}

	if field.Arguments != nil {
		t.Errorf("Arguments: got %v, want nil", field.Arguments)
	}

	if field.Directives != nil {
		t.Errorf("Directives: got %v, want nil", field.Directives)
	}
}

func TestClose(t *testing.T) {
	t.Parallel()

	conn, err := memconnector.New(nil, nil)
	if err != nil {
		t.Fatalf("memconnector.New: %v", err)
	}

	conn.Close() // must not panic
}

func TestGetTypeName(t *testing.T) {
	t.Parallel()

	conn, err := memconnector.New(nil, nil)
	if err != nil {
		t.Fatalf("memconnector.New: %v", err)
	}

	if got := conn.GetTypeName("User"); got != "User" {
		t.Fatalf("expected 'User', got %q", got)
	}
}

// TestNew_DuplicateNames asserts that New rejects two QueryDef entries that
// share the same name, rather than silently overriding the first registration.
func TestNew_DuplicateNames(t *testing.T) {
	t.Parallel()

	conn, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object(
				"User",
				memconnector.ID("id"),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"users",
				graph.NewNonNullListType(graph.NewNonNullType("User")),
				jsontext.Value(`[{"id":"1"}]`),
			),
			memconnector.Query(
				"users",
				graph.NewNonNullListType(graph.NewNonNullType("User")),
				jsontext.Value(`[{"id":"2"}]`),
			),
		},
	)
	if err == nil {
		t.Fatal("expected error for duplicate QueryDef name, got nil")
	}

	if conn != nil {
		t.Errorf("expected nil connector on duplicate-name error, got %T", conn)
	}

	if !strings.Contains(err.Error(), "duplicate") || !strings.Contains(err.Error(), `"users"`) {
		t.Errorf("expected duplicate-name error mentioning %q, got %v", "users", err)
	}
}

// TestExecute_NonFieldSelection asserts that a non-Field at the operation root
// surfaces an error wrapping the operation name (M8).
func TestExecute_NonFieldSelection(t *testing.T) {
	t.Parallel()

	conn, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object(
				"User",
				memconnector.ID("id"),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"users",
				graph.NewNonNullListType(graph.NewNonNullType("User")),
				jsontext.Value(`[]`),
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New: %v", err)
	}

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		Name:      "BadOp",
		SelectionSet: ast.SelectionSet{
			&ast.InlineFragment{
				TypeCondition: "query_root",
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "users", Alias: "users"},
				},
			},
		},
	}

	_, err = conn.Execute(
		context.Background(),
		op,
		nil,
		nil,
		"admin",
		nil,
		slog.Default(),
	)
	if err == nil {
		t.Fatal("expected error for non-Field selection at root, got nil")
	}

	if !strings.Contains(err.Error(), `"BadOp"`) {
		t.Errorf("expected error to contain operation name %q, got %v", "BadOp", err)
	}

	if !strings.Contains(err.Error(), "non-Field") {
		t.Errorf("expected error to mention non-Field selection, got %v", err)
	}
}

// TestExecute_UnknownField asserts that an unregistered root field surfaces an
// error wrapping the operation name (M8).
func TestExecute_UnknownField(t *testing.T) {
	t.Parallel()

	conn, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object(
				"User",
				memconnector.ID("id"),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"users",
				graph.NewNonNullListType(graph.NewNonNullType("User")),
				jsontext.Value(`[]`),
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New: %v", err)
	}

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		Name:      "MissingFieldOp",
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "userss", Alias: "userss"},
		},
	}

	_, err = conn.Execute(
		context.Background(),
		op,
		nil,
		nil,
		"admin",
		nil,
		slog.Default(),
	)
	if err == nil {
		t.Fatal("expected error for unknown field, got nil")
	}

	if !strings.Contains(err.Error(), `"MissingFieldOp"`) {
		t.Errorf("expected error to contain operation name %q, got %v", "MissingFieldOp", err)
	}

	if !strings.Contains(err.Error(), `"userss"`) {
		t.Errorf("expected error to contain field name %q, got %v", "userss", err)
	}
}
