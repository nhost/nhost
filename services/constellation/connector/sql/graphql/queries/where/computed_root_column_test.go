package where_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

func TestNestedColumnReferenceRequiresPhysicalInsertRow(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name  string
		field string
		path  []any
		want  bool
	}{
		{"plain root", "label", []any{"$", "label"}, true},
		{"computed root", "computed_name", []any{"$", "label"}, true},
		{"plain current", "label", []any{"label"}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			child := &parseTestTable{
				d: dialect.NewPostgresDialect(),
				columns: map[string]*core.Column{
					"label": {SQLName: "label", GraphqlName: "label", SQLType: "text"},
				},
				computed: map[string]core.ComputedExpression{
					"computed_name": computedExpressionStub{},
				},
			}
			parent := &parseTestTable{
				d: dialect.NewPostgresDialect(),
				columns: map[string]*core.Column{
					"label": {SQLName: "label", GraphqlName: "label", SQLType: "text"},
				},
				relationship: map[string]where.Relationship{"children": &parseTestRelationship{
					target:        child,
					name:          "children",
					aggregateName: "children_aggregate",
					isArray:       true,
				}},
			}

			v, err := values.GoValueToAST(map[string]any{"children": map[string]any{
				tc.field: map[string]any{"_ceq": tc.path},
			}})
			if err != nil {
				t.Fatal(err)
			}

			clause, err := where.Parse(parent, v, nil, "", nil, 0, where.PermissionAliases)
			if err != nil {
				t.Fatal(err)
			}

			if got := where.ContainsRootColumn(clause); got != tc.want {
				t.Fatalf("ContainsRootColumn = %t, want %t", got, tc.want)
			}
		})
	}
}
