package permissions_test

import (
	"testing"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
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
