package pgtypes_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/pgtypes"
)

func TestSpatialClassification(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		sqlType       string
		wantSpatial   bool
		wantGeometry  bool
		wantGeography bool
		wantScalar    string
	}{
		{
			name:         "geometry",
			sqlType:      "geometry",
			wantSpatial:  true,
			wantGeometry: true,
			wantScalar:   pgtypes.Geometry,
		},
		{
			name:          "geography",
			sqlType:       "geography",
			wantSpatial:   true,
			wantGeography: true,
			wantScalar:    pgtypes.Geography,
		},
		{
			name:         "typmod geometry",
			sqlType:      "geometry(Point,4326)",
			wantSpatial:  true,
			wantGeometry: true,
			wantScalar:   pgtypes.Geometry,
		},
		{
			name:         "schema qualified quoted geometry",
			sqlType:      `public."geometry"`,
			wantSpatial:  true,
			wantGeometry: true,
			wantScalar:   pgtypes.Geometry,
		},
		{name: "spatial arrays are out of scope", sqlType: "geometry[]"},
		{name: "jsonb", sqlType: "jsonb"},
		{name: "empty", sqlType: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := pgtypes.IsSpatial(tt.sqlType); got != tt.wantSpatial {
				t.Errorf("IsSpatial(%q) = %v, want %v", tt.sqlType, got, tt.wantSpatial)
			}

			if got := pgtypes.IsGeometry(tt.sqlType); got != tt.wantGeometry {
				t.Errorf("IsGeometry(%q) = %v, want %v", tt.sqlType, got, tt.wantGeometry)
			}

			if got := pgtypes.IsGeography(tt.sqlType); got != tt.wantGeography {
				t.Errorf("IsGeography(%q) = %v, want %v", tt.sqlType, got, tt.wantGeography)
			}

			if got := pgtypes.SpatialScalarName(tt.sqlType); got != tt.wantScalar {
				t.Errorf("SpatialScalarName(%q) = %q, want %q", tt.sqlType, got, tt.wantScalar)
			}
		})
	}
}
