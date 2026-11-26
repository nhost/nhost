package schema

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/graph"
)

func TestComputedAggregateEligibility(t *testing.T) {
	t.Parallel()
	// A serialized Hasura v2.48.10 probe accepted date, timestamptz and uuid
	// for min/max, but omitted boolean and jsonb. Numeric accepts numeric only.
	tests := []struct {
		name, scalar        string
		comparable, numeric bool
	}{
		{"text", "String", true, false},
		{"numeric", "numeric", true, true},
		{"date", "date", true, false},
		{"timestamptz", "timestamptz", true, false},
		{"uuid", "uuid", true, false},
		{"boolean", "Boolean", false, false},
		{"jsonb", "jsonb", false, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			field := &graph.Field{Name: tt.name, Type: graph.NewNamedType(tt.scalar)}
			if got := len(
				comparableComputedAggregateFields([]*graph.Field{field}),
			) != 0; got != tt.comparable {
				t.Errorf("min/max eligibility = %v, want %v", got, tt.comparable)
			}

			if got := len(
				numericComputedAggregateFields([]*graph.Field{field}),
			) != 0; got != tt.numeric {
				t.Errorf("numeric eligibility = %v, want %v", got, tt.numeric)
			}
		})
	}
}
