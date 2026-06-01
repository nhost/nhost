package introspection_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
)

func TestFunctionArgumentGraphQLName(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		arg  introspection.FunctionArgument
		idx  int
		want string
	}{
		{
			name: "named argument keeps SQL name",
			arg: introspection.FunctionArgument{
				Name:       "search",
				Type:       "text",
				HasDefault: false,
			},
			idx:  0,
			want: "search",
		},
		{
			name: "first positional argument uses one-based generated name",
			arg: introspection.FunctionArgument{
				Name:       "",
				Type:       "text",
				HasDefault: false,
			},
			idx:  0,
			want: "arg_1",
		},
		{
			name: "later positional argument uses one-based generated name",
			arg: introspection.FunctionArgument{
				Name:       "",
				Type:       "text",
				HasDefault: true,
			},
			idx:  2,
			want: "arg_3",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := tt.arg.GraphQLName(tt.idx)
			if got != tt.want {
				t.Errorf("GraphQLName() = %q, want %q", got, tt.want)
			}
		})
	}
}
