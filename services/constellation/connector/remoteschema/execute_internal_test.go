package remoteschema

import (
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
)

func TestResolvePresetValue(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		value       string
		sessionVars map[string]any
		want        string
	}{
		{
			name:  "literal value",
			value: "some-literal",
			want:  "some-literal",
		},
		{
			name:  "session variable found",
			value: "X-Hasura-User-Id",
			sessionVars: map[string]any{
				"x-hasura-user-id": "user-123",
			},
			want: "user-123",
		},
		{
			name:        "session variable not found",
			value:       "X-Hasura-Missing",
			sessionVars: map[string]any{},
			want:        "",
		},
		{
			name:  "session variable case insensitive",
			value: "x-hasura-role",
			sessionVars: map[string]any{
				"x-hasura-role": "editor",
			},
			want: "editor",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := resolvePresetValue(tt.value, tt.sessionVars); got != tt.want {
				t.Errorf("expected %s, got %s", tt.want, got)
			}
		})
	}
}

func TestApplyFieldPresets(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		field       *ast.Field
		presets     []presetArg
		sessionVars map[string]any
		wantArgs    int
		wantName    string
		wantValue   string
	}{
		{
			name: "adds new argument",
			field: &ast.Field{
				Name:      "getUser",
				Arguments: nil,
			},
			presets:   []presetArg{{ArgumentName: "userId", Value: "user-123"}},
			wantArgs:  1,
			wantName:  "userId",
			wantValue: "user-123",
		},
		{
			name: "replaces existing argument",
			field: &ast.Field{
				Name: "getUser",
				Arguments: ast.ArgumentList{
					{
						Name:  "userId",
						Value: &ast.Value{Raw: "old-value", Kind: ast.StringValue},
					},
				},
			},
			presets:   []presetArg{{ArgumentName: "userId", Value: "new-value"}},
			wantArgs:  1,
			wantName:  "userId",
			wantValue: "new-value",
		},
		{
			name: "resolves session variable",
			field: &ast.Field{
				Name:      "getUser",
				Arguments: nil,
			},
			presets: []presetArg{{ArgumentName: "userId", Value: "x-hasura-user-id"}},
			sessionVars: map[string]any{
				"x-hasura-user-id": "session-user-456",
			},
			wantArgs:  1,
			wantName:  "userId",
			wantValue: "session-user-456",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			applyFieldPresets(tt.field, tt.presets, tt.sessionVars)

			if len(tt.field.Arguments) != tt.wantArgs {
				t.Fatalf("expected %d arguments, got %d", tt.wantArgs, len(tt.field.Arguments))
			}

			if tt.field.Arguments[0].Name != tt.wantName {
				t.Errorf("expected %s, got %s", tt.wantName, tt.field.Arguments[0].Name)
			}

			if tt.field.Arguments[0].Value.Raw != tt.wantValue {
				t.Errorf("expected %s, got %s", tt.wantValue, tt.field.Arguments[0].Value.Raw)
			}
		})
	}
}

func TestApplyPresets(t *testing.T) {
	t.Parallel()

	t.Run("no presets returns original operation", func(t *testing.T) {
		t.Parallel()

		op := &ast.OperationDefinition{
			Operation: ast.Query,
			SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "users"},
			},
		}

		result := applyPresets(op, nil, nil, "Query")
		// When no presets, should return the original operation
		if result != op {
			t.Error("expected same operation when no presets")
		}
	})

	t.Run("injects preset argument", func(t *testing.T) {
		t.Parallel()

		op := &ast.OperationDefinition{
			Operation: ast.Query,
			SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "getUser"},
			},
		}

		presets := map[string][]presetArg{
			"Query.getUser": {
				{ArgumentName: "userId", Value: "x-hasura-user-id"},
			},
		}

		sessionVars := map[string]any{
			"x-hasura-user-id": "user-789",
		}

		result := applyPresets(op, presets, sessionVars, "Query")

		// Should be a clone, not the original
		if result == op {
			t.Error("expected cloned operation, got same pointer")
		}

		field, ok := result.SelectionSet[0].(*ast.Field)
		if !ok {
			t.Fatal("expected *ast.Field")
		}

		if len(field.Arguments) != 1 {
			t.Fatalf("expected 1 argument, got %d", len(field.Arguments))
		}

		if field.Arguments[0].Name != "userId" {
			t.Errorf("expected userId, got %s", field.Arguments[0].Name)
		}

		if field.Arguments[0].Value.Raw != "user-789" {
			t.Errorf("expected user-789, got %s", field.Arguments[0].Value.Raw)
		}
	})

	t.Run("does not mutate original operation", func(t *testing.T) {
		t.Parallel()

		op := &ast.OperationDefinition{
			Operation: ast.Query,
			SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "getUser"},
			},
		}

		presets := map[string][]presetArg{
			"Query.getUser": {
				{ArgumentName: "userId", Value: "injected"},
			},
		}

		_ = applyPresets(op, presets, nil, "Query")

		// Original operation should not have the injected argument
		origField, ok := op.SelectionSet[0].(*ast.Field)
		if !ok {
			t.Fatal("expected *ast.Field")
		}

		if len(origField.Arguments) != 0 {
			t.Errorf("original operation mutated: got %d arguments", len(origField.Arguments))
		}
	})
}

func TestCloneOperation(t *testing.T) {
	t.Parallel()

	t.Run("nil operation", func(t *testing.T) {
		t.Parallel()

		result := cloneOperation(nil)
		if result != nil {
			t.Error("expected nil")
		}
	})

	t.Run("deep copy", func(t *testing.T) {
		t.Parallel()

		op := &ast.OperationDefinition{
			Operation: ast.Query,
			Name:      "GetUsers",
			SelectionSet: ast.SelectionSet{
				&ast.Field{
					Name: "users",
					Arguments: ast.ArgumentList{
						{
							Name:  "limit",
							Value: &ast.Value{Raw: "10", Kind: ast.IntValue},
						},
					},
					SelectionSet: ast.SelectionSet{
						&ast.Field{Name: "id"},
					},
				},
			},
		}

		cloned := cloneOperation(op)

		if cloned == op {
			t.Error("expected different pointer")
		}

		if cloned.Name != "GetUsers" {
			t.Errorf("expected GetUsers, got %s", cloned.Name)
		}

		// Modify cloned and verify original is unchanged
		clonedField, ok := cloned.SelectionSet[0].(*ast.Field)
		if !ok {
			t.Fatal("expected *ast.Field")
		}

		clonedField.Arguments[0].Value.Raw = "999"

		origField, ok := op.SelectionSet[0].(*ast.Field)
		if !ok {
			t.Fatal("expected *ast.Field")
		}

		if origField.Arguments[0].Value.Raw != "10" {
			t.Error("original was mutated by modifying clone")
		}
	})
}

func TestBuildQueryString(t *testing.T) {
	t.Parallel()

	t.Run("simple query", func(t *testing.T) {
		t.Parallel()

		op := &ast.OperationDefinition{
			Operation: ast.Query,
			SelectionSet: ast.SelectionSet{
				&ast.Field{
					Name: "users",
					SelectionSet: ast.SelectionSet{
						&ast.Field{Name: "id"},
						&ast.Field{Name: "name"},
						&ast.Field{Name: "email"},
					},
				},
			},
		}

		result := buildQueryString(op, nil)
		if result == "" {
			t.Error("expected non-empty query string")
		}

		// Should contain the field names
		for _, field := range []string{"users", "id", "name", "email"} {
			if !strings.Contains(result, field) {
				t.Errorf("expected query to contain %s, got: %s", field, result)
			}
		}
	})

	t.Run("with fragments", func(t *testing.T) {
		t.Parallel()

		op := &ast.OperationDefinition{
			Operation: ast.Query,
			SelectionSet: ast.SelectionSet{
				&ast.Field{
					Name: "users",
					SelectionSet: ast.SelectionSet{
						&ast.FragmentSpread{Name: "UserFields"},
					},
				},
			},
		}

		fragments := ast.FragmentDefinitionList{
			{
				Name:          "UserFields",
				TypeCondition: "User",
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "id"},
					&ast.Field{Name: "name"},
				},
			},
		}

		result := buildQueryString(op, fragments)
		if !strings.Contains(result, "UserFields") {
			t.Errorf("expected fragment in output: %s", result)
		}
	})
}

func TestDefaultRootTypeName(t *testing.T) {
	t.Parallel()

	tests := []struct {
		op   ast.Operation
		want string
	}{
		{ast.Query, "Query"},
		{ast.Mutation, "Mutation"},
		{ast.Subscription, "Subscription"},
	}

	for _, tt := range tests {
		if got := defaultRootTypeName(tt.op); got != tt.want {
			t.Errorf("defaultRootTypeName(%v) = %s, want %s", tt.op, got, tt.want)
		}
	}
}

func TestGetBaseTypeName(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		typ  *ast.Type
		want string
	}{
		{
			name: "nil type",
			typ:  nil,
			want: "",
		},
		{
			name: "named type",
			typ:  &ast.Type{NamedType: "User"},
			want: "User",
		},
		{
			name: "non-null named type",
			typ:  &ast.Type{NamedType: "User", NonNull: true},
			want: "User",
		},
		{
			name: "list type",
			typ:  &ast.Type{Elem: &ast.Type{NamedType: "User"}},
			want: "User",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := getBaseTypeName(tt.typ); got != tt.want {
				t.Errorf("expected %q, got %q", tt.want, got)
			}
		})
	}
}
