// Package pgtypes classifies PostgreSQL type names that need specialised SQL handling.
package pgtypes

import "strings"

const (
	// Geometry is the PostgreSQL/PostGIS geometry type name.
	Geometry = "geometry"
	// Geography is the PostgreSQL/PostGIS geography type name.
	Geography = "geography"
)

// IsSpatial reports whether sqlType is a PostGIS scalar spatial type.
func IsSpatial(sqlType string) bool {
	return IsGeometry(sqlType) || IsGeography(sqlType)
}

// IsGeometry reports whether sqlType names a PostGIS geometry scalar.
func IsGeometry(sqlType string) bool {
	return SpatialScalarName(sqlType) == Geometry
}

// IsGeography reports whether sqlType names a PostGIS geography scalar.
func IsGeography(sqlType string) bool {
	return SpatialScalarName(sqlType) == Geography
}

// SpatialScalarName returns "geometry" or "geography" for recognised scalar
// spatial SQL type names, and "" for every other type.
func SpatialScalarName(sqlType string) string {
	normalized := normalizeTypeName(sqlType)
	switch normalized {
	case Geometry, Geography:
		return normalized
	default:
		return ""
	}
}

func normalizeTypeName(sqlType string) string {
	s := strings.ToLower(strings.TrimSpace(sqlType))
	if strings.HasSuffix(s, "[]") {
		return ""
	}

	if idx := strings.IndexByte(s, '('); idx >= 0 {
		s = strings.TrimSpace(s[:idx])
	}

	if idx := strings.LastIndexByte(s, '.'); idx >= 0 {
		s = strings.Trim(s[idx+1:], `"`)
	}

	return strings.Trim(s, `"`)
}
