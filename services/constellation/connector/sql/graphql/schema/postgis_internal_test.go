package schema

import (
	"slices"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/pgtypes"
)

func TestGetComparisonOperatorsSpatialHasuraPostGIS(t *testing.T) {
	t.Parallel()

	caps := Capabilities{SupportsSpatialTypes: true}
	tests := []struct {
		name   string
		scalar string
		want   []string
	}{
		{
			name:   "geography",
			scalar: pgtypes.Geography,
			want: []string{
				"_cast", "_eq", "_gt", "_gte", "_in", "_is_null", "_lt", "_lte",
				"_neq", "_nin", "_st_d_within", "_st_intersects",
			},
		},
		{
			name:   "geometry",
			scalar: pgtypes.Geometry,
			want: []string{
				"_cast", "_eq", "_gt", "_gte", "_in", "_is_null", "_lt", "_lte",
				"_neq", "_nin", "_st_3d_d_within", "_st_3d_intersects",
				"_st_contains", "_st_crosses", "_st_d_within", "_st_equals",
				"_st_intersects", "_st_overlaps", "_st_touches", "_st_within",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := getComparisonOperators(tt.scalar, caps); !slices.Equal(got, tt.want) {
				t.Fatalf("operators = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestGetComparisonOperatorsSpatialCapabilityGating(t *testing.T) {
	t.Parallel()

	want := []string{"_eq", "_gt", "_gte", "_in", "_is_null", "_lt", "_lte", "_neq", "_nin"}
	for _, scalar := range []string{pgtypes.Geometry, pgtypes.Geography} {
		t.Run(scalar, func(t *testing.T) {
			t.Parallel()

			if got := getComparisonOperators(scalar, Capabilities{}); !slices.Equal(got, want) {
				t.Fatalf("operators = %v, want %v", got, want)
			}
		})
	}
}
