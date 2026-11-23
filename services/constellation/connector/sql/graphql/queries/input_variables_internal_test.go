package queries

import (
	"testing"

	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
)

func TestSelectorScope(t *testing.T) {
	t.Parallel()

	schema, err := gqlparser.LoadSchema(&ast.Source{Input: `
 input Renamed {_and:[Renamed!] _not:Renamed _or:[Renamed!]}
 input Unrelated {_and:[Unrelated!] _not:Unrelated _or:[Int!]}
 type Query {id:Int}
 `})
	if err != nil {
		t.Fatalf("LoadSchema: %v", err)
	}

	tests := []struct {
		name, field, input string
		scope, want        inputVariableScope
	}{
		{"renamed predicate", "where", "Renamed", mutationInput, mutationSelector},
		{"read predicate", "where", "Renamed", optionalInput, optionalInput},
		{"non-selector argument", "args", "Renamed", mutationInput, mutationInput},
		{"unrelated shape", "where", "Unrelated", mutationInput, mutationInput},
		{"unvalidated", "where", "", mutationInput, mutationInput},
		{"nested comparison", "_eq", "Int", mutationSelector, mutationSelector},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			value := &ast.Value{Definition: schema.Types[tt.input]}
			if got := selectorScope(tt.scope, tt.field, value); got != tt.want {
				t.Errorf("selector scope=%v, want %v", got, tt.want)
			}
		})
	}
}
