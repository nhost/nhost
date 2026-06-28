package schema

import (
	"sort"

	"github.com/nhost/nhost/services/constellation/connector/sql/pgtypes"
	"github.com/nhost/nhost/services/constellation/graph"
)

// sortedKeys returns the keys of a set-style map in ascending order so that
// schema generation produces deterministic output regardless of Go map
// iteration order.
func sortedKeys(m map[string]struct{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}

	sort.Strings(keys)

	return keys
}

// generateScalars generates scalar type declarations and their comparison input types.
func generateScalars(
	schema *graph.Schema,
	usedScalars map[string]struct{},
	selectUsedScalars map[string]struct{},
	selectUsedArrayElementTypes map[string]struct{},
	caps Capabilities,
) {
	ensureCastTargetScalars(usedScalars, selectUsedScalars, caps)

	// Generate comparison input types for each select-visible scalar. Spatial
	// cast inputs must precede their comparison types to match Hasura's PostGIS
	// SDL; keep jsonb_cast_exp in its historical Constellation position below so
	// non-spatial SDL ordering is unchanged by PostGIS support.
	for _, scalarType := range sortedKeys(selectUsedScalars) {
		if pgtypes.IsSpatial(scalarType) {
			if castExp := generateCastExp(scalarType, caps); castExp != nil {
				schema.Inputs = append(schema.Inputs, castExp)
			}
		}

		schema.Inputs = append(schema.Inputs, generateComparisonExp(scalarType, caps))
	}

	generateSpatialOperatorInputs(schema, selectUsedScalars, caps)

	// Generate array comparison input types for each select-visible array element type.
	if caps.SupportsArrays {
		for _, elemType := range sortedKeys(selectUsedArrayElementTypes) {
			schema.Inputs = append(schema.Inputs, generateArrayComparisonExp(elemType, caps))
		}
	}

	// Keep jsonb_cast_exp's pre-existing placement to avoid unrelated SDL churn.
	if _, hasJsonb := selectUsedScalars["jsonb"]; hasJsonb {
		if castExp := generateCastExp("jsonb", caps); castExp != nil {
			schema.Inputs = append(schema.Inputs, castExp)
		}
	}

	// Add scalar type declarations for custom scalars (from all used scalars, including mutation-only).
	for _, scalarType := range sortedKeys(usedScalars) {
		if isCustomScalar(scalarType) {
			schema.Scalars = append(schema.Scalars, &graph.ScalarType{ //nolint:exhaustruct
				Name: scalarType,
			})
		}
	}
}

func ensureCastTargetScalars(
	usedScalars map[string]struct{},
	selectUsedScalars map[string]struct{},
	caps Capabilities,
) {
	// If we have jsonb in select columns, we also need String comparison for jsonb_cast_exp.
	if _, hasJsonb := selectUsedScalars["jsonb"]; hasJsonb {
		selectUsedScalars["String"] = struct{}{}
		usedScalars["String"] = struct{}{}
	}

	if !caps.SupportsSpatialTypes {
		return
	}

	// Spatial cast inputs reference the opposite spatial comparison type. Make
	// the target scalar visible even when a table only exposes one spatial type.
	if _, hasGeometry := selectUsedScalars[pgtypes.Geometry]; hasGeometry {
		selectUsedScalars[pgtypes.Geography] = struct{}{}
		usedScalars[pgtypes.Geography] = struct{}{}
	}

	if _, hasGeography := selectUsedScalars[pgtypes.Geography]; hasGeography {
		selectUsedScalars[pgtypes.Geometry] = struct{}{}
		usedScalars[pgtypes.Geometry] = struct{}{}
	}
}

// isCustomScalar returns true if the type name is a custom scalar (not a built-in GraphQL type).
// We only check for built-in GraphQL scalars - everything else that gets here is a custom scalar.
func isCustomScalar(typeName string) bool {
	// Built-in GraphQL scalars are NOT custom
	switch typeName {
	case "Int", "Float", "String", "Boolean", "ID": //nolint:goconst,nolintlint
		return false
	}

	// Everything else is a custom scalar
	// This includes PostgreSQL types (uuid, citext, timestamptz, jsonb, etc.)
	// as well as any user-defined types
	return true
}
