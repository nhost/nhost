package queries

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
)

func testFunction(
	name string, volatility introspection.Volatility, exposedAs string, setOf bool,
) *function {
	fn := newFunction("public", name, dialect.NewPostgresDialect())
	fn.querySelectName = name
	fn.queryAggregateName = name + "_aggregate"
	fn.volatility = volatility
	fn.exposedAs = exposedAs
	fn.isSetOf = setOf

	return fn
}

func TestVolatileQueryFields(t *testing.T) {
	t.Parallel()

	tbl := &table{
		functions: []*function{
			testFunction("search", introspection.VolatilityStable, "", true),
			testFunction("touch_and_list", introspection.VolatilityVolatile, "query", true),
			testFunction("touch_one", introspection.VolatilityVolatile, "query", false),
			testFunction("bump", introspection.VolatilityVolatile, "", false),
		},
	}

	want := map[string]struct{}{
		"touch_and_list":           {},
		"touch_and_list_aggregate": {},
		"touch_one":                {},
	}

	if diff := cmp.Diff(want, volatileQueryFields([]*table{tbl})); diff != "" {
		t.Errorf("volatile query fields mismatch (-want +got):\n%s", diff)
	}
}

func TestRootsUsesVolatileFunction(t *testing.T) {
	t.Parallel()

	roots := Roots{
		Operations:          nil,
		StreamFields:        nil,
		VolatileQueryFields: map[string]struct{}{"touch_one": {}},
	}

	field := func(name string) *ast.Field {
		return &ast.Field{Name: name, Alias: name}
	}

	tests := []struct {
		name      string
		operation *ast.OperationDefinition
		want      bool
	}{
		{
			name:      "nil operation",
			operation: nil,
			want:      false,
		},
		{
			name: "only stable roots",
			operation: &ast.OperationDefinition{
				SelectionSet: ast.SelectionSet{field("users"), field("search")},
			},
			want: false,
		},
		{
			name: "volatile root",
			operation: &ast.OperationDefinition{
				SelectionSet: ast.SelectionSet{field("users"), field("touch_one")},
			},
			want: true,
		},
		{
			name: "volatile root inside an inline fragment",
			operation: &ast.OperationDefinition{
				SelectionSet: ast.SelectionSet{
					&ast.InlineFragment{SelectionSet: ast.SelectionSet{field("touch_one")}},
				},
			},
			want: true,
		},
		{
			name: "volatile root inside a fragment spread",
			operation: &ast.OperationDefinition{
				SelectionSet: ast.SelectionSet{
					&ast.FragmentSpread{
						Name: "f",
						Definition: &ast.FragmentDefinition{
							SelectionSet: ast.SelectionSet{field("touch_one")},
						},
					},
				},
			},
			want: true,
		},
		{
			name: "unresolved fragment spread counts as volatile",
			operation: &ast.OperationDefinition{
				SelectionSet: ast.SelectionSet{&ast.FragmentSpread{Name: "f"}},
			},
			want: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := roots.UsesVolatileFunction(tt.operation); got != tt.want {
				t.Errorf("UsesVolatileFunction() = %v, want %v", got, tt.want)
			}
		})
	}
}
