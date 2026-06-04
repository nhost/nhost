package remoteschema

import (
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
)

func TestResolveSessionVariable(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		key         string
		sessionVars map[string]any
		want        string
	}{
		{
			name: "session variable found",
			key:  "x-hasura-user-id",
			sessionVars: map[string]any{
				"x-hasura-user-id": "user-123",
			},
			want: "user-123",
		},
		{
			name:        "session variable not found",
			key:         "x-hasura-missing",
			sessionVars: map[string]any{},
			want:        "",
		},
		{
			name: "formats non-string session values",
			key:  "x-hasura-is-home",
			sessionVars: map[string]any{
				"x-hasura-is-home": true,
			},
			want: "true",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := resolveSessionVariable(tt.key, tt.sessionVars); got != tt.want {
				t.Errorf("expected %s, got %s", tt.want, got)
			}
		})
	}
}

func literalPresetArg(
	argumentName string,
	value *ast.Value,
	typ *ast.Type,
	targetKind ast.DefinitionKind,
) presetArg {
	return presetArg{
		ArgumentName:    argumentName,
		Value:           value,
		Type:            typ,
		TargetKind:      targetKind,
		SessionVariable: "",
	}
}

func sessionPresetArg(argumentName, sessionVariable string, typ *ast.Type) presetArg {
	return presetArg{
		ArgumentName:    argumentName,
		Value:           astStringValue(sessionVariable),
		Type:            typ,
		TargetKind:      ast.Scalar,
		SessionVariable: strings.ToLower(sessionVariable),
	}
}

func astStringValue(raw string) *ast.Value {
	return &ast.Value{Raw: raw, Kind: ast.StringValue}
}

func astScalarValue(raw string, kind ast.ValueKind) *ast.Value {
	return &ast.Value{Raw: raw, Kind: kind}
}

//nolint:maintidx // One table keeps preset coercion cases under identical assertions.
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
		wantKind    ast.ValueKind
	}{
		{
			name: "adds new argument",
			field: &ast.Field{
				Name:      "getUser",
				Arguments: nil,
			},
			presets: []presetArg{
				literalPresetArg(
					"userId",
					astStringValue("user-123"),
					ast.NamedType("String", nil),
					ast.Scalar,
				),
			},
			wantArgs:  1,
			wantName:  "userId",
			wantValue: "user-123",
			wantKind:  ast.StringValue,
		},
		{
			name: "replaces existing argument",
			field: &ast.Field{
				Name: "getUser",
				Arguments: ast.ArgumentList{
					{
						Name:  "userId",
						Value: astStringValue("old-value"),
					},
				},
			},
			presets: []presetArg{
				literalPresetArg(
					"userId",
					astStringValue("new-value"),
					ast.NamedType("String", nil),
					ast.Scalar,
				),
			},
			wantArgs:  1,
			wantName:  "userId",
			wantValue: "new-value",
			wantKind:  ast.StringValue,
		},
		{
			name: "resolves session variable",
			field: &ast.Field{
				Name:      "getUser",
				Arguments: nil,
			},
			presets: []presetArg{
				sessionPresetArg("userId", "x-hasura-user-id", ast.NamedType("String", nil)),
			},
			sessionVars: map[string]any{
				"x-hasura-user-id": "session-user-456",
			},
			wantArgs:  1,
			wantName:  "userId",
			wantValue: "session-user-456",
			wantKind:  ast.StringValue,
		},
		{
			name: "injects int literal without string quoting",
			field: &ast.Field{
				Name:      "topGames",
				Arguments: nil,
			},
			presets: []presetArg{
				literalPresetArg(
					"limit",
					astScalarValue("5", ast.IntValue),
					ast.NonNullNamedType("Int", nil),
					ast.Scalar,
				),
			},
			wantArgs:  1,
			wantName:  "limit",
			wantValue: "5",
			wantKind:  ast.IntValue,
		},
		{
			name: "injects float literal without string quoting",
			field: &ast.Field{
				Name:      "topGames",
				Arguments: nil,
			},
			presets: []presetArg{
				literalPresetArg(
					"rating",
					astScalarValue("4.5", ast.FloatValue),
					ast.NonNullNamedType("Float", nil),
					ast.Scalar,
				),
			},
			wantArgs:  1,
			wantName:  "rating",
			wantValue: "4.5",
			wantKind:  ast.FloatValue,
		},
		{
			name: "coerces string int literal by target type",
			field: &ast.Field{
				Name:      "topGames",
				Arguments: nil,
			},
			presets: []presetArg{
				literalPresetArg(
					"limit",
					astStringValue("5"),
					ast.NonNullNamedType("Int", nil),
					ast.Scalar,
				),
			},
			wantArgs:  1,
			wantName:  "limit",
			wantValue: "5",
			wantKind:  ast.IntValue,
		},
		{
			name: "missing non-string session variable becomes null",
			field: &ast.Field{
				Name:      "topGames",
				Arguments: nil,
			},
			presets: []presetArg{
				sessionPresetArg("limit", "x-hasura-limit", ast.NonNullNamedType("Int", nil)),
			},
			sessionVars: nil,
			wantArgs:    1,
			wantName:    "limit",
			wantValue:   "null",
			wantKind:    ast.NullValue,
		},
		{
			name: "invalid string int literal stays quoted for upstream validation",
			field: &ast.Field{
				Name:      "topGames",
				Arguments: nil,
			},
			presets: []presetArg{
				literalPresetArg(
					"limit",
					astStringValue("user-123"),
					ast.NonNullNamedType("Int", nil),
					ast.Scalar,
				),
			},
			wantArgs:  1,
			wantName:  "limit",
			wantValue: "user-123",
			wantKind:  ast.StringValue,
		},
		{
			name: "coerces boolean session variable by target type",
			field: &ast.Field{
				Name:      "recordGame",
				Arguments: nil,
			},
			presets: []presetArg{
				sessionPresetArg(
					"isHome",
					"x-hasura-is-home",
					ast.NonNullNamedType("Boolean", nil),
				),
			},
			sessionVars: map[string]any{
				"x-hasura-is-home": true,
			},
			wantArgs:  1,
			wantName:  "isHome",
			wantValue: "true",
			wantKind:  ast.BooleanValue,
		},
		{
			name: "coerces enum string literal by target kind",
			field: &ast.Field{
				Name:      "games",
				Arguments: nil,
			},
			presets: []presetArg{
				literalPresetArg(
					"region",
					astStringValue("AMERICAS"),
					ast.NonNullNamedType("Region", nil),
					ast.Enum,
				),
			},
			wantArgs:  1,
			wantName:  "region",
			wantValue: "AMERICAS",
			wantKind:  ast.EnumValue,
		},
		{
			name: "preserves list literal children",
			field: &ast.Field{
				Name:      "games",
				Arguments: nil,
			},
			presets: []presetArg{
				literalPresetArg(
					"ids",
					&ast.Value{
						Kind: ast.ListValue,
						Children: ast.ChildValueList{
							{Value: astScalarValue("1", ast.IntValue)},
							{Value: astScalarValue("2", ast.IntValue)},
						},
					},
					ast.ListType(ast.NamedType("Int", nil), nil),
					ast.Scalar,
				),
			},
			wantArgs:  1,
			wantName:  "ids",
			wantValue: "",
			wantKind:  ast.ListValue,
		},
		{
			name: "preserves object literal children",
			field: &ast.Field{
				Name:      "games",
				Arguments: nil,
			},
			presets: []presetArg{
				literalPresetArg(
					"filter",
					&ast.Value{
						Kind: ast.ObjectValue,
						Children: ast.ChildValueList{
							{Name: "active", Value: astScalarValue("true", ast.BooleanValue)},
						},
					},
					ast.NamedType("GameFilter", nil),
					ast.InputObject,
				),
			},
			wantArgs:  1,
			wantName:  "filter",
			wantValue: "",
			wantKind:  ast.ObjectValue,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			applyFieldPresets(tt.field, tt.presets, tt.sessionVars)

			if len(tt.field.Arguments) != tt.wantArgs {
				t.Fatalf("expected %d arguments, got %d", tt.wantArgs, len(tt.field.Arguments))
			}

			arg := tt.field.Arguments[0]
			if arg.Name != tt.wantName {
				t.Errorf("expected %s, got %s", tt.wantName, arg.Name)
			}

			if arg.Value.Kind != tt.wantKind {
				t.Errorf("expected kind %v, got %v", tt.wantKind, arg.Value.Kind)
			}

			if tt.wantValue != "" && arg.Value.Raw != tt.wantValue {
				t.Errorf("expected %s, got %s", tt.wantValue, arg.Value.Raw)
			}

			if tt.wantKind == ast.ListValue && len(arg.Value.Children) != 2 {
				t.Errorf("expected 2 list children, got %d", len(arg.Value.Children))
			}

			if tt.wantKind == ast.ObjectValue && len(arg.Value.Children) != 1 {
				t.Errorf("expected 1 object child, got %d", len(arg.Value.Children))
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
				sessionPresetArg("userId", "x-hasura-user-id", ast.NamedType("String", nil)),
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
				literalPresetArg(
					"userId",
					astStringValue("injected"),
					ast.NamedType("String", nil),
					ast.Scalar,
				),
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

func TestApplyPresets_TypedRoundTripsThroughBuildQueryString(t *testing.T) {
	t.Parallel()

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			&ast.Field{
				Name: "topGames",
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "id"},
				},
			},
		},
	}

	presets := map[string][]presetArg{
		"Query.topGames": {
			literalPresetArg(
				"limit",
				astScalarValue("10", ast.IntValue),
				ast.NonNullNamedType("Int", nil),
				ast.Scalar,
			),
		},
	}

	query := buildQueryString(applyPresets(op, presets, nil, "Query"), nil)
	if !strings.Contains(query, "limit: 10") && !strings.Contains(query, "limit:10") {
		t.Fatalf("expected unquoted int preset in query, got %s", query)
	}

	if strings.Contains(query, `limit: "10"`) {
		t.Fatalf("expected int preset to be unquoted, got %s", query)
	}
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
