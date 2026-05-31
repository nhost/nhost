package queries_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"go.uber.org/mock/gomock"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments/mock"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

// distinctOnOrderByMismatchError builds a real *QueryValidationError by driving
// the public arguments.ParseQuery with a distinct_on that does not match the
// leading order_by, so tests exercise the production validation path instead of
// a hand-minted error. order_by references budget while distinct_on references
// name, which ParseQuery rejects.
func distinctOnOrderByMismatchError(t *testing.T) *arguments.QueryValidationError {
	t.Helper()

	ctrl := gomock.NewController(t)
	tbl := mock.NewMockTable(ctrl)
	tbl.EXPECT().ColumnFromGraphqlName("budget").
		Return(&core.Column{SQLName: "budget", GraphqlName: "budget", SQLType: "numeric"})
	tbl.EXPECT().ColumnFromGraphqlName("name").
		Return(&core.Column{SQLName: "name", GraphqlName: "name", SQLType: "text"})

	args := ast.ArgumentList{
		&ast.Argument{
			Name: "order_by",
			Value: &ast.Value{
				Kind: ast.ObjectValue,
				Children: []*ast.ChildValue{
					{Name: "budget", Value: &ast.Value{Kind: ast.EnumValue, Raw: "desc"}},
				},
			},
		},
		&ast.Argument{Name: "distinct_on", Value: &ast.Value{Kind: ast.EnumValue, Raw: "name"}},
	}

	clause, _, _, err := arguments.ParseQuery(tbl, args, nil, "user", nil)
	if clause != nil {
		t.Fatalf("ParseQuery: expected nil where clause on the error path, got %v", clause)
	}

	var vErr *arguments.QueryValidationError
	if !errors.As(err, &vErr) {
		t.Fatalf("ParseQuery: expected a *QueryValidationError, got %T (%v)", err, err)
	}

	return vErr
}

func TestRootsBuildQuery_NoRootsForOperation(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		roots     queries.Roots
		operation ast.Operation
	}{
		{
			name:      "query operation but Roots has no query map",
			roots:     queries.Roots{Operations: nil, StreamFields: nil},
			operation: ast.Query,
		},
		{
			name: "mutation operation but Roots has no mutation map",
			roots: queries.Roots{
				Operations: map[queries.OperationKind]map[string]core.Operation{
					queries.OperationQuery: {},
				},
				StreamFields: nil,
			},
			operation: ast.Mutation,
		},
		{
			name: "subscription operation but Roots has no subscription map",
			roots: queries.Roots{
				Operations: map[queries.OperationKind]map[string]core.Operation{
					queries.OperationQuery: {},
				},
				StreamFields: nil,
			},
			operation: ast.Subscription,
		},
		{
			name: "unknown operation kind",
			roots: queries.Roots{
				Operations: map[queries.OperationKind]map[string]core.Operation{
					queries.OperationQuery: {},
				},
				StreamFields: nil,
			},
			operation: ast.Operation("invalid"),
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			op := &ast.OperationDefinition{
				Operation:    tc.operation,
				SelectionSet: ast.SelectionSet{},
			}

			_, err := tc.roots.BuildQuery(op, nil, nil, "admin", nil)
			if !errors.Is(err, queries.ErrNoRootsForRole) {
				t.Fatalf("err = %v, want errors.Is ErrNoRootsForRole", err)
			}
		})
	}
}

func TestRootsBuildQuery_FieldNotRegistered(t *testing.T) {
	t.Parallel()

	r := queries.Roots{
		Operations: map[queries.OperationKind]map[string]core.Operation{
			queries.OperationQuery: {},
		},
		StreamFields: nil,
	}

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "users"},
		},
	}

	_, err := r.BuildQuery(op, nil, nil, "admin", nil)
	if err == nil {
		t.Fatal("expected error for unregistered field, got nil")
	}

	if !strings.Contains(err.Error(), "users") {
		t.Errorf("error should mention the missing field, got: %v", err)
	}
}

func TestRootsBuildQuery_StampsQueryValidationError(t *testing.T) {
	t.Parallel()

	vErr := distinctOnOrderByMismatchError(t)

	var stubOp core.Operation = func(
		_ *ast.Field,
		_ ast.FragmentDefinitionList,
		_ map[string]any,
		_ string,
		_ map[string]any,
		_ map[string]core.Operation,
	) (core.SQLOperation, error) {
		return core.SQLOperation{}, vErr
	}

	r := queries.Roots{
		Operations: map[queries.OperationKind]map[string]core.Operation{
			queries.OperationQuery: {"users": stubOp},
		},
		StreamFields: nil,
	}

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "users", Alias: "people"},
		},
	}

	_, err := r.BuildQuery(op, nil, nil, "admin", nil)
	if !errors.Is(err, arguments.ErrInvalidArgument) {
		t.Fatalf("err = %v, want errors.Is ErrInvalidArgument", err)
	}

	var gotErr *arguments.QueryValidationError
	if !errors.As(err, &gotErr) {
		t.Fatalf("err = %T, want *QueryValidationError", err)
	}

	ext, ok := gotErr.AsMap()["extensions"].(map[string]any)
	if !ok {
		t.Fatalf("extensions = %T, want map[string]any", gotErr.AsMap()["extensions"])
	}

	if got := ext["path"]; got != "$.selectionSet.people.args" {
		t.Fatalf("extensions.path = %v, want $.selectionSet.people.args", got)
	}
}

func TestRootsBuildQuery_DispatchSucceeds(t *testing.T) {
	t.Parallel()

	wantSQL := "SELECT 1"
	called := false

	var stubOp core.Operation = func(
		_ *ast.Field,
		_ ast.FragmentDefinitionList,
		_ map[string]any,
		_ string,
		_ map[string]any,
		_ map[string]core.Operation,
	) (core.SQLOperation, error) {
		called = true
		return core.SQLOperation{Name: "users", SQL: wantSQL}, nil
	}

	r := queries.Roots{
		Operations: map[queries.OperationKind]map[string]core.Operation{
			queries.OperationQuery: {"users": stubOp},
		},
		StreamFields: nil,
	}

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "users"},
		},
	}

	ops, err := r.BuildQuery(op, nil, nil, "admin", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !called {
		t.Fatal("registered operation was not invoked")
	}

	if len(ops) != 1 || ops[0].SQL != wantSQL {
		t.Errorf("ops = %+v, want one op with SQL %q", ops, wantSQL)
	}
}

func TestRootsBuildQuery_SkipsNonFieldSelections(t *testing.T) {
	t.Parallel()

	r := queries.Roots{
		Operations: map[queries.OperationKind]map[string]core.Operation{
			queries.OperationQuery: {},
		},
		StreamFields: nil,
	}

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			&ast.FragmentSpread{Name: "Frag"},
		},
	}

	ops, err := r.BuildQuery(op, nil, nil, "admin", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(ops) != 0 {
		t.Errorf("ops = %v, want empty (fragment spreads are skipped)", ops)
	}
}

func TestBuildRoots_NilMetadata(t *testing.T) {
	t.Parallel()

	roots, ops, err := queries.BuildRoots(nil, nil, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if ops == nil {
		t.Fatal("expected non-nil grouped aggregate Ops")
	}

	if _, ok := roots.Operations[queries.OperationQuery]; !ok {
		t.Errorf("expected Roots to contain an empty query map, got: %v", roots)
	}
}

func TestRootsIsStreamSubscription(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		roots queries.Roots
		field *ast.Field
		want  bool
	}{
		{
			name: "nil field returns false",
			roots: queries.Roots{
				Operations: nil,
				StreamFields: map[string]struct{}{
					"users_stream": {},
				},
			},
			field: nil,
			want:  false,
		},
		{
			name: "field name absent from StreamFields returns false",
			roots: queries.Roots{
				Operations: nil,
				StreamFields: map[string]struct{}{
					"users_stream": {},
				},
			},
			field: &ast.Field{Name: "users"},
			want:  false,
		},
		{
			name: "field name present in StreamFields returns true",
			roots: queries.Roots{
				Operations: nil,
				StreamFields: map[string]struct{}{
					"users_stream": {},
				},
			},
			field: &ast.Field{Name: "users_stream"},
			want:  true,
		},
		{
			name: "nil StreamFields with non-nil field returns false",
			roots: queries.Roots{
				Operations:   nil,
				StreamFields: nil,
			},
			field: &ast.Field{Name: "users_stream"},
			want:  false,
		},
		{
			name: "empty StreamFields with non-nil field returns false",
			roots: queries.Roots{
				Operations:   nil,
				StreamFields: map[string]struct{}{},
			},
			field: &ast.Field{Name: "users_stream"},
			want:  false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := tc.roots.IsStreamSubscription(tc.field)
			if got != tc.want {
				t.Errorf("IsStreamSubscription = %v, want %v", got, tc.want)
			}
		})
	}
}

// TestOperationConstants pins the Roots operation-kind constants to the string
// values produced by gqlparser's ast.Operation type. BuildQuery dispatches on
// ast.Operation and looks up rootMap by these constants, so a drift between
// the two (e.g. renaming OperationQuery to "queries") would break the entire
// stack silently.
func TestOperationConstants(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		constant queries.OperationKind
		want     string
	}{
		{
			name:     "OperationQuery matches ast.Query",
			constant: queries.OperationQuery,
			want:     string(ast.Query),
		},
		{
			name:     "OperationMutation matches ast.Mutation",
			constant: queries.OperationMutation,
			want:     string(ast.Mutation),
		},
		{
			name:     "OperationSubscription matches ast.Subscription",
			constant: queries.OperationSubscription,
			want:     string(ast.Subscription),
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if string(tc.constant) != tc.want {
				t.Errorf("%s = %q, want %q", tc.name, tc.constant, tc.want)
			}
		})
	}
}
