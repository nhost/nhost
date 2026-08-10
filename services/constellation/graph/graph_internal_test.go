package graph

import (
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
)

func TestDetectValueKind(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		raw      string
		expected ast.ValueKind
	}{
		{"empty string", "", ast.StringValue},
		{"plain string", "hello", ast.StringValue},
		{"true", "true", ast.BooleanValue},
		{"false", "false", ast.BooleanValue},
		{"null", "null", ast.NullValue},
		// Single-character prefix collisions: strings that start with t/f/n but
		// aren't the boolean/null literals must classify as StringValue. Before
		// the exact-match tightening, "test" was BooleanValue and "never" was
		// NullValue.
		{"string starting with t", "test", ast.StringValue},
		{"string starting with f", "foo", ast.StringValue},
		{"string starting with n", "never", ast.StringValue},
		{"truthy lookalike", "trueish", ast.StringValue},
		{"falsy lookalike", "falsy", ast.StringValue},
		{"null lookalike", "nullable", ast.StringValue},
		{"integer", "42", ast.IntValue},
		{"negative integer", "-1", ast.IntValue},
		{"float with dot", "3.14", ast.FloatValue},
		{"float with exponent", "1e10", ast.FloatValue},
		{"float with upper exponent", "2E5", ast.FloatValue},
		{"negative float", "-0.5", ast.FloatValue},
		{"list", "[]", ast.ListValue},
		{"object", "{}", ast.ObjectValue},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := detectValueKind(tt.raw)
			if got != tt.expected {
				t.Errorf("detectValueKind(%q) = %v, want %v", tt.raw, got, tt.expected)
			}
		})
	}
}
