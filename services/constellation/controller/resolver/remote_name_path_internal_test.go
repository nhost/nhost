package resolver

import (
	"errors"
	"reflect"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
	"github.com/vektah/gqlparser/v2/ast"
)

func TestRemoteValidationPathUsesNamesWithoutChangingResponsePath(t *testing.T) {
	t.Parallel()

	rq := &remoteQuery{
		parentPath:  jsonpath.Path{"u", "r"},
		namePath:    jsonpath.Path{"users", "roles"},
		alias:       "d",
		sourceField: &ast.Field{Name: "department", Alias: "d"},
	}
	if got := rq.argumentPath(); got != "users.selectionSet.roles.selectionSet.department" {
		t.Fatalf("argument path = %q", got)
	}

	result := map[string]any{"u": []any{map[string]any{"r": map[string]any{}}}}
	rq.parentPath.ForEach(result, func(row map[string]any) { row[rq.alias] = "retained" })

	wantResult := map[string]any{"u": []any{map[string]any{"r": map[string]any{"d": "retained"}}}}
	if !reflect.DeepEqual(result, wantResult) {
		t.Fatalf("response stitching changed: %#v", result)
	}

	//nolint:dogsled // Only the structured validation error is relevant here.
	_, _, _, err := arguments.ParseQuery(nil, ast.ArgumentList{
		&ast.Argument{Name: "limit", Value: &ast.Value{Kind: ast.IntValue, Raw: "-1"}},
	}, nil, "admin", nil, "")

	var validation *arguments.QueryValidationError
	if !errors.As(err, &validation) {
		t.Fatalf("expected validation error: %v", err)
	}

	validation.StampArgumentPath("_batch.selectionSet.item_score")

	remoteOp := &ast.OperationDefinition{Operation: ast.Query, SelectionSet: ast.SelectionSet{
		&ast.Field{Name: "_batch", Alias: "_0"},
	}}
	if err := remapRemoteQueryValidationArgumentPath(
		validation,
		rq,
		remoteOp,
	); !errors.Is(
		err,
		validation,
	) {
		t.Fatalf("remapping error changed it: %v", err)
	}

	want := "$.selectionSet.users.selectionSet.roles.selectionSet.department.selectionSet.item_score.args.limit"

	extensions, ok := validation.AsMap()["extensions"].(map[string]any)
	if !ok {
		t.Fatal("validation extensions missing")
	}

	if got := extensions["path"]; got != want {
		t.Fatalf("remapped path = %q, want %q", got, want)
	}
}
