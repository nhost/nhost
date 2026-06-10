package schema

import (
	"fmt"

	"github.com/nhost/nhost/services/constellation/connector/sql/pgtypes"
	"github.com/nhost/nhost/services/constellation/graph"
)

// generateComparisonExp generates a comparison expression input type for a scalar type.
func generateComparisonExp(scalarType string, caps Capabilities) *graph.InputObjectType {
	operators := getComparisonOperators(scalarType, caps)
	fields := make([]*graph.InputField, 0, len(operators))

	for _, op := range operators {
		fields = append(fields, &graph.InputField{ //nolint:exhaustruct
			Name:        op,
			Description: getOperatorDescription(op, scalarType),
			Type:        comparisonOperatorType(op, scalarType, caps),
		})
	}

	return &graph.InputObjectType{ //nolint:exhaustruct
		Name: caps.comparisonExpName(scalarType),
		Description: fmt.Sprintf(
			"Boolean expression to compare columns of type \"%s\". All fields are combined with logical 'AND'.",
			scalarType,
		),
		Fields: fields,
	}
}

func comparisonOperatorType(op, scalarType string, caps Capabilities) *graph.Type {
	switch op {
	case "_in", "_nin":
		return graph.NewListType(graph.NewNonNullType(scalarType))
	case "_is_null":
		return graph.NewNamedType("Boolean")
	case "_has_key":
		return graph.NewNamedType("String")
	case "_has_keys_all", "_has_keys_any":
		return graph.NewListType(graph.NewNonNullType("String"))
	case "_cast":
		return graph.NewNamedType(caps.castExpName(scalarType))
	case "_contains", "_contained_in":
		return graph.NewNamedType(scalarType)
	case "_st_d_within":
		if scalarType == pgtypes.Geography {
			return graph.NewNamedType("st_d_within_geography_input")
		}

		return graph.NewNamedType("st_d_within_input")
	case "_st_3d_d_within":
		return graph.NewNamedType("st_d_within_input")
	default:
		return graph.NewNamedType(scalarType)
	}
}

func generateCastExp(scalarType string, caps Capabilities) *graph.InputObjectType {
	switch scalarType {
	case "jsonb":
		if !caps.SupportsJSONB {
			return nil
		}

		return &graph.InputObjectType{ //nolint:exhaustruct
			Name: caps.castExpName("jsonb"),
			Fields: []*graph.InputField{
				{
					Name: "String",
					Type: graph.NewNamedType(caps.comparisonExpName("String")),
				},
			},
		}
	case pgtypes.Geography:
		if !caps.SupportsSpatialTypes {
			return nil
		}

		return &graph.InputObjectType{ //nolint:exhaustruct
			Name: caps.castExpName(pgtypes.Geography),
			Fields: []*graph.InputField{
				{
					Name: pgtypes.Geometry,
					Type: graph.NewNamedType(caps.comparisonExpName(pgtypes.Geometry)),
				},
			},
		}
	case pgtypes.Geometry:
		if !caps.SupportsSpatialTypes {
			return nil
		}

		return &graph.InputObjectType{ //nolint:exhaustruct
			Name: caps.castExpName(pgtypes.Geometry),
			Fields: []*graph.InputField{
				{
					Name: pgtypes.Geography,
					Type: graph.NewNamedType(caps.comparisonExpName(pgtypes.Geography)),
				},
			},
		}
	default:
		return nil
	}
}

func generateSpatialOperatorInputs(
	schema *graph.Schema,
	selectUsedScalars map[string]struct{},
	caps Capabilities,
) {
	if !caps.SupportsSpatialTypes {
		return
	}

	if _, hasGeography := selectUsedScalars[pgtypes.Geography]; hasGeography {
		defaultUseSpheroid := "true"
		schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
			Name: "st_d_within_geography_input",
			Fields: []*graph.InputField{
				{Name: "distance", Type: graph.NewNonNullType("Float")},
				{Name: "from", Type: graph.NewNonNullType(pgtypes.Geography)},
				{
					Name:         "use_spheroid",
					Type:         graph.NewNamedType("Boolean"),
					DefaultValue: &defaultUseSpheroid,
				},
			},
		})
	}

	if _, hasGeometry := selectUsedScalars[pgtypes.Geometry]; hasGeometry {
		schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
			Name: "st_d_within_input",
			Fields: []*graph.InputField{
				{Name: "distance", Type: graph.NewNonNullType("Float")},
				{Name: "from", Type: graph.NewNonNullType(pgtypes.Geometry)},
			},
		})
	}
}

// getComparisonOperators returns the list of comparison operators for a scalar type.
func getComparisonOperators(scalarType string, caps Capabilities) []string {
	var ops []string

	switch scalarType {
	case "String", "bpchar": //nolint:goconst,nolintlint
		ops = []string{
			"_eq", "_gt", "_gte", "_ilike", "_in", "_iregex", "_is_null",
			"_like", "_lt", "_lte", "_neq", "_nilike", "_nin", "_niregex",
			"_nlike", "_nregex", "_nsimilar", "_regex", "_similar",
		}
	case "Boolean", "Int": //nolint:goconst,nolintlint
		return []string{"_eq", "_gt", "_gte", "_in", "_is_null", "_lt", "_lte", "_neq", "_nin"}
	case "citext":
		ops = []string{
			"_eq", "_gt", "_gte", "_ilike", "_in", "_iregex", "_is_null",
			"_like", "_lt", "_lte", "_neq", "_nilike", "_nin", "_niregex",
			"_nlike", "_nregex", "_nsimilar", "_regex", "_similar",
		}
	case "jsonb": //nolint:goconst,nolintlint // scalar name literal is clearer than a package-wide constant here.
		if !caps.SupportsJSONB {
			return []string{"_eq", "_gt", "_gte", "_in", "_is_null", "_lt", "_lte", "_neq", "_nin"}
		}

		return []string{
			"_cast", "_contained_in", "_contains", "_eq", "_gt", "_gte",
			"_has_key", "_has_keys_all", "_has_keys_any", "_in", "_is_null",
			"_lt", "_lte", "_neq", "_nin",
		}
	case pgtypes.Geography:
		if caps.SupportsSpatialTypes {
			return []string{
				"_cast", "_eq", "_gt", "_gte", "_in", "_is_null", "_lt", "_lte",
				"_neq", "_nin", "_st_d_within", "_st_intersects",
			}
		}

		return []string{"_eq", "_gt", "_gte", "_in", "_is_null", "_lt", "_lte", "_neq", "_nin"}
	case pgtypes.Geometry:
		if caps.SupportsSpatialTypes {
			return []string{
				"_cast", "_eq", "_gt", "_gte", "_in", "_is_null", "_lt", "_lte",
				"_neq", "_nin", "_st_3d_d_within", "_st_3d_intersects",
				"_st_contains", "_st_crosses", "_st_d_within", "_st_equals",
				"_st_intersects", "_st_overlaps", "_st_touches", "_st_within",
			}
		}

		return []string{"_eq", "_gt", "_gte", "_in", "_is_null", "_lt", "_lte", "_neq", "_nin"}
	default:
		return []string{"_eq", "_gt", "_gte", "_in", "_is_null", "_lt", "_lte", "_neq", "_nin"}
	}

	if !caps.SupportsRegex {
		filtered := make([]string, 0, len(ops))

		for _, op := range ops {
			switch op {
			case "_iregex", "_niregex", "_nregex", "_regex", "_similar", "_nsimilar":
				continue
			default:
				filtered = append(filtered, op)
			}
		}

		ops = filtered
	}

	return ops
}

// generateArrayComparisonExp generates a comparison expression input type for an array column
// whose elements are of the given scalar type.
func generateArrayComparisonExp(elementType string, caps Capabilities) *graph.InputObjectType {
	listType := graph.NewListType(graph.NewNonNullType(elementType))
	listOfListType := graph.NewListType(graph.NewNonNullListType(graph.NewNonNullType(elementType)))

	fields := []*graph.InputField{
		{
			Name:        "_contained_in",
			Description: "is the array contained in the given array value",
			Type:        listType,
		},
		{
			Name:        "_contains",
			Description: "does the array contain the given value",
			Type:        listType,
		},
		{Name: "_eq", Type: listType},
		{Name: "_gt", Type: listType},
		{Name: "_gte", Type: listType},
		{
			Name: "_in",
			Type: listOfListType,
		},
		{
			Name: "_is_null",
			Type: graph.NewNamedType("Boolean"),
		},
		{Name: "_lt", Type: listType},
		{Name: "_lte", Type: listType},
		{Name: "_neq", Type: listType},
		{
			Name: "_nin",
			Type: listOfListType,
		},
	}

	return &graph.InputObjectType{ //nolint:exhaustruct
		Name: caps.arrayComparisonExpName(elementType),
		Description: fmt.Sprintf(
			"Boolean expression to compare columns of type \"%s\". All fields are combined with logical 'AND'.",
			elementType,
		),
		Fields: fields,
	}
}

// getOperatorDescription returns a description for a comparison operator.
func getOperatorDescription(op, scalarType string) string { //nolint:cyclop,funlen
	switch op {
	case "_ilike":
		return "does the column match the given case-insensitive pattern"
	case "_iregex":
		return "does the column match the given POSIX regular expression, case insensitive"
	case "_like":
		return "does the column match the given pattern"
	case "_nilike":
		return "does the column NOT match the given case-insensitive pattern"
	case "_niregex":
		return "does the column NOT match the given POSIX regular expression, case insensitive"
	case "_nlike":
		return "does the column NOT match the given pattern"
	case "_nregex":
		return "does the column NOT match the given POSIX regular expression, case sensitive"
	case "_nsimilar":
		return "does the column NOT match the given SQL regular expression"
	case "_regex":
		return "does the column match the given POSIX regular expression, case sensitive"
	case "_similar":
		return "does the column match the given SQL regular expression"
	case "_contained_in":
		return "is the column contained in the given json value"
	case "_contains":
		return "does the column contain the given json value at the top level"
	case "_has_key":
		return "does the string exist as a top-level key in the column"
	case "_has_keys_all":
		return "do all of these strings exist as top-level keys in the column"
	case "_has_keys_any":
		return "do any of these strings exist as top-level keys in the column"
	case "_st_3d_d_within":
		return "is the column within a given 3D distance from the given geometry value"
	case "_st_3d_intersects":
		return "does the column spatially intersect the given geometry value in 3D"
	case "_st_contains":
		return "does the column contain the given geometry value"
	case "_st_crosses":
		return "does the column cross the given geometry value"
	case "_st_d_within":
		if scalarType == pgtypes.Geography {
			return "is the column within a given distance from the given geography value"
		}

		return "is the column within a given distance from the given geometry value"
	case "_st_equals":
		return "is the column equal to given geometry value (directionality is ignored)"
	case "_st_intersects":
		if scalarType == pgtypes.Geography {
			return "does the column spatially intersect the given geography value"
		}

		return "does the column spatially intersect the given geometry value"
	case "_st_overlaps":
		return "does the column 'spatially overlap' (intersect but not completely contain) the given geometry value"
	case "_st_touches":
		return "does the column have atleast one point in common with the given geometry value"
	case "_st_within":
		return "is the column contained in the given geometry value"
	default:
		return ""
	}
}
