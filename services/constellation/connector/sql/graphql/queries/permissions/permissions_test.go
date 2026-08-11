package permissions_test

import (
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/permissions"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
	"github.com/nhost/nhost/services/constellation/metadata"
)

type hasInsertCheckTable struct {
	columns map[string]*core.Column
}

func (t hasInsertCheckTable) Name() string {
	return "users"
}

func (t hasInsertCheckTable) ColumnFromSQLName(name string) *core.Column {
	return t.columns[name]
}

func (t hasInsertCheckTable) LookupRelationship(_ string) permissions.Relationship {
	return nil
}

func (t hasInsertCheckTable) SiblingTable(_, _ string) permissions.Table {
	return nil
}

func (t hasInsertCheckTable) ParseWhere(
	v *ast.Value,
	_ map[string]any,
	_ string,
	_ map[string]any,
	_ int,
	_ where.Aliases,
) (where.Clause, error) {
	if v == nil || len(v.Children) == 0 {
		return nil, nil
	}

	return where.Clause{where.NewRawFilter("true")}, nil
}

type permissionLikeTable struct {
	columns map[string]*core.Column
	d       dialect.Dialect
}

func (t permissionLikeTable) Name() string { return "users" }
func (t permissionLikeTable) Dialect() dialect.Dialect {
	return t.d
}
func (t permissionLikeTable) SchemaName() string      { return "" }
func (t permissionLikeTable) TableFromClause() string { return `"users"` }

func (t permissionLikeTable) ColumnFromSQLName(name string) *core.Column {
	return t.columns[name]
}

func (t permissionLikeTable) ColumnFromGraphqlName(name string) *core.Column {
	return t.columns[name]
}

func (t permissionLikeTable) LookupRelationship(_ string) permissions.Relationship {
	return nil
}

func (t permissionLikeTable) RelationshipFromGraphqlName(_ string) where.Relationship {
	return nil
}

func (t permissionLikeTable) SiblingTable(_, _ string) permissions.Table { return nil }
func (t permissionLikeTable) TableBySchemaName(_, _ string) where.Table  { return nil }
func (t permissionLikeTable) HasRowLevelPermissions(string) bool         { return false }

func (t permissionLikeTable) WriteRowLevelPermissions(
	_ *strings.Builder,
	params []any,
	paramIndex int,
	_ string,
	_ map[string]any,
	_ string,
) ([]any, int, error) {
	return params, paramIndex, nil
}

func (t permissionLikeTable) ParseWhere(
	whereArg *ast.Value,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	nestingLevel int,
	aliases where.Aliases,
) (where.Clause, error) {
	//nolint:wrapcheck // test stub: forward parser error verbatim.
	return where.Parse(t, whereArg, variables, role, sessionVariables, nestingLevel, aliases)
}

func (t permissionLikeTable) ParseFieldComparison(
	column *core.Column,
	value *ast.Value,
	variables map[string]any,
) (where.Statement, error) {
	//nolint:wrapcheck // test stub: forward parser error verbatim.
	return where.ParseFieldComparison(t, column, value, variables)
}

func TestSelectPermissionLikeIsCaseSensitiveOnSQLite(t *testing.T) {
	t.Parallel()

	table := permissionLikeTable{
		d: dialect.NewSQLiteDialect(),
		columns: map[string]*core.Column{
			"name": {SQLName: "name", GraphqlName: "name", SQLType: "text"},
		},
	}
	store := permissions.NewStore()

	if err := permissions.Initialize(table, store, metadata.TableMetadata{
		SelectPermissions: []metadata.SelectPermission{
			{
				Role: "user",
				Permission: metadata.SelectPermissionConfig{
					Columns: []string{"name"},
					Filter: map[string]any{
						"name": map[string]any{"_like": "Foo%"},
					},
					AllowAggregations: false,
				},
			},
		},
	}); err != nil {
		t.Fatalf("Initialize() error = %v", err)
	}

	var b strings.Builder

	params, paramIndex, err := store.WriteRowLevel(&b, nil, 1, "user", nil, `"t"`)
	if err != nil {
		t.Fatalf("WriteRowLevel() error = %v", err)
	}

	if got, want := b.String(), `"t"."name" LIKE ?`; got != want {
		t.Fatalf("WriteRowLevel() SQL = %q, want %q", got, want)
	}

	if paramIndex != 2 {
		t.Fatalf("paramIndex = %d, want 2", paramIndex)
	}

	if len(params) != 1 || params[0] != "Foo%" {
		t.Fatalf("params = %v, want [Foo%%]", params)
	}
}

func TestStoreHasNonEmptyInsertCheck(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		md   metadata.TableMetadata
		role string
		want bool
	}{
		{
			name: "missing insert permission",
			role: "user",
			want: false,
		},
		{
			name: "empty insert check",
			md: metadata.TableMetadata{
				InsertPermissions: []metadata.InsertPermission{
					{
						Role: "user",
						Permission: metadata.InsertPermissionConfig{
							Check: map[string]any{},
						},
					},
				},
			},
			role: "user",
			want: false,
		},
		{
			name: "non-empty insert check",
			md: metadata.TableMetadata{
				InsertPermissions: []metadata.InsertPermission{
					{
						Role: "user",
						Permission: metadata.InsertPermissionConfig{
							Check: map[string]any{
								"id": map[string]any{"_eq": 1},
							},
						},
					},
				},
			},
			role: "user",
			want: true,
		},
	}

	table := hasInsertCheckTable{
		columns: map[string]*core.Column{
			"id": {SQLName: "id", GraphqlName: "id"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			store := permissions.NewStore()
			if err := permissions.Initialize(table, store, tc.md); err != nil {
				t.Fatalf("Initialize() error = %v", err)
			}

			if got := store.HasNonEmptyInsertCheck(tc.role); got != tc.want {
				t.Errorf(
					"HasNonEmptyInsertCheck(%q) = %v, want %v",
					tc.role, got, tc.want,
				)
			}
		})
	}
}
