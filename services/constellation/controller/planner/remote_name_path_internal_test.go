package planner

import (
	"reflect"
	"testing"

	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
	"github.com/vektah/gqlparser/v2/ast"
)

func TestRemoteQueryNamePathKeepsResponseAliasesSeparate(t *testing.T) {
	t.Parallel()

	schema := analyzerTestSchema()
	schema.Query = &ast.Definition{
		Kind: ast.Object,
		Name: "Query",
		Fields: ast.FieldList{
			{Name: "users", Type: ast.ListType(ast.NamedType("users", nil), nil)},
		},
	}
	a := newAnalyzer(
		"db1",
		schema,
		[]*RelationshipMetadata{analyzerTestRelationship()},
		ast.Query,
		nil,
	)
	op := &ast.OperationDefinition{Operation: ast.Query, SelectionSet: ast.SelectionSet{
		&ast.Field{Name: "users", Alias: "u", SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "department", Alias: "d", SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "id"},
			}},
		}},
	}}

	result := a.analyzeOperation(op)
	if len(result.RemoteQueries) != 1 {
		t.Fatalf("remote queries = %d, want 1", len(result.RemoteQueries))
	}

	plan := result.RemoteQueries[0]
	if !reflect.DeepEqual(plan.SourcePath, jsonpath.Path{"u"}) ||
		!reflect.DeepEqual(plan.SourceNamePath, jsonpath.Path{"users"}) ||
		plan.OutputField != "d" || plan.Selection.Name != "department" {
		t.Fatalf("plan mixes response keys and names: %+v", plan)
	}
}
