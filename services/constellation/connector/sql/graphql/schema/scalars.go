package schema

import (
	"sort"

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
	// If we have jsonb in select columns, we also need String comparison for jsonb_cast_exp
	if _, hasJsonb := selectUsedScalars["jsonb"]; hasJsonb {
		selectUsedScalars["String"] = struct{}{}
		usedScalars["String"] = struct{}{}
	}

	_, hasGeography := selectUsedScalars["geography"]
	_, hasGeometry := selectUsedScalars["geometry"]
	if hasGeography || hasGeometry {
		selectUsedScalars["geography"] = struct{}{}
		selectUsedScalars["geometry"] = struct{}{}
		usedScalars["geography"] = struct{}{}
		usedScalars["geometry"] = struct{}{}
	}

	// Generate comparison input types for each select-visible scalar
	for _, scalarType := range sortedKeys(selectUsedScalars) {
		schema.Inputs = append(schema.Inputs, generateComparisonExp(scalarType, caps))
	}

	// Generate array comparison input types for each select-visible array element type
	if caps.SupportsArrays {
		for _, elemType := range sortedKeys(selectUsedArrayElementTypes) {
			schema.Inputs = append(schema.Inputs, generateArrayComparisonExp(elemType, caps))
		}
	}

	// Add jsonb_cast_exp if we have jsonb in select columns
	if _, hasJsonb := selectUsedScalars["jsonb"]; hasJsonb {
		schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
			Name: caps.castExpName("jsonb"),
			Fields: []*graph.InputField{
				{
					Name: "String",
					Type: graph.NewNamedType(caps.comparisonExpName("String")),
				},
			},
		})
	}

	if hasGeography || hasGeometry {
		// Generate st_d_within_geography_input
		schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
			Name: caps.namespaceTypeName("st_d_within", "geography_input"),
			Fields: []*graph.InputField{
				{
					Name: "distance",
					Type: graph.NewNonNullType("Float"),
				},
				{
					Name: "from",
					Type: graph.NewNonNullType("geography"),
				},
				{
					Name:         "use_spheroid",
					Type:         graph.NewNamedType("Boolean"),
					DefaultValue: stringPtr("true"),
				},
			},
		})

		// Generate st_d_within_input
		schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
			Name: caps.namespaceTypeName("st_d_within", "input"),
			Fields: []*graph.InputField{
				{
					Name: "distance",
					Type: graph.NewNonNullType("Float"),
				},
				{
					Name: "from",
					Type: graph.NewNonNullType("geometry"),
				},
			},
		})

		// Generate geography_cast_exp
		schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
			Name: caps.castExpName("geography"),
			Fields: []*graph.InputField{
				{
					Name: "geometry",
					Type: graph.NewNamedType(caps.comparisonExpName("geometry")),
				},
			},
		})

		// Generate geometry_cast_exp
		schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
			Name: caps.castExpName("geometry"),
			Fields: []*graph.InputField{
				{
					Name: "geography",
					Type: graph.NewNamedType(caps.comparisonExpName("geography")),
				},
			},
		})
	}

	// Add scalar type declarations for custom scalars (from all used scalars, including mutation-only)
	for _, scalarType := range sortedKeys(usedScalars) {
		if isCustomScalar(scalarType) {
			schema.Scalars = append(schema.Scalars, &graph.ScalarType{ //nolint:exhaustruct
				Name: scalarType,
			})
		}
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

func stringPtr(s string) *string {
	return &s
}

