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
	case opIn, nin:
		return graph.NewListType(graph.NewNonNullType(scalarType))
	case isNull:
		return graph.NewNamedType("Boolean")
	case hasKey:
		return graph.NewNamedType(scalarString)
	case hasKeysAll, hasKeysAny:
		return graph.NewListType(graph.NewNonNullType(scalarString))
	case cast:
		return graph.NewNamedType(caps.castExpName(scalarType))
	case opContains, containedIn:
		return graph.NewNamedType(scalarType)
	case stDWithin:
		if scalarType == pgtypes.Geography {
			return graph.NewNamedType("st_d_within_geography_input")
		}

		return graph.NewNamedType("st_d_within_input")
	case st3dDWithin:
		return graph.NewNamedType("st_d_within_input")
	default:
		return graph.NewNamedType(scalarType)
	}
}

func generateCastExp(scalarType string, caps Capabilities) *graph.InputObjectType {
	switch scalarType {
	case scalarJSONB:
		if !caps.SupportsJSONB {
			return nil
		}

		return &graph.InputObjectType{ //nolint:exhaustruct
			Name: caps.castExpName(scalarJSONB),
			Fields: []*graph.InputField{
				{
					Name: scalarString,
					Type: graph.NewNamedType(caps.comparisonExpName(scalarString)),
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
	case scalarString, "bpchar": //nolint:goconst,nolintlint
		ops = []string{
			eq, gt, gte, ilike, opIn, iregex, isNull,
			like, lt, lte, neq, nilike, nin, niregex,
			nlike, nregex, nsimilar, regex, similar,
		}
	case "Boolean", "Int": //nolint:goconst,nolintlint
		return []string{eq, gt, gte, opIn, isNull, lt, lte, neq, nin}
	case "citext":
		ops = []string{
			eq, gt, gte, ilike, opIn, iregex, isNull,
			like, lt, lte, neq, nilike, nin, niregex,
			nlike, nregex, nsimilar, regex, similar,
		}
	case scalarJSONB:
		if !caps.SupportsJSONB {
			return []string{eq, gt, gte, opIn, isNull, lt, lte, neq, nin}
		}

		return []string{
			cast, containedIn, opContains, eq, gt, gte,
			hasKey, hasKeysAll, hasKeysAny, opIn, isNull,
			lt, lte, neq, nin,
		}
	case pgtypes.Geography:
		if caps.SupportsSpatialTypes {
			return []string{
				cast, eq, gt, gte, opIn, isNull, lt, lte,
				neq, nin, stDWithin, stIntersects,
			}
		}

		return []string{eq, gt, gte, opIn, isNull, lt, lte, neq, nin}
	case pgtypes.Geometry:
		if caps.SupportsSpatialTypes {
			return []string{
				cast, eq, gt, gte, opIn, isNull, lt, lte,
				neq, nin, st3dDWithin, "_st_3d_intersects",
				"_st_contains", "_st_crosses", stDWithin, "_st_equals",
				stIntersects, "_st_overlaps", "_st_touches", "_st_within",
			}
		}

		return []string{eq, gt, gte, opIn, isNull, lt, lte, neq, nin}
	default:
		return []string{eq, gt, gte, opIn, isNull, lt, lte, neq, nin}
	}

	if !caps.SupportsRegex {
		filtered := make([]string, 0, len(ops))

		for _, op := range ops {
			switch op {
			case iregex, niregex, nregex, regex, similar, nsimilar:
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
			Name:        containedIn,
			Description: "is the array contained in the given array value",
			Type:        listType,
		},
		{
			Name:        opContains,
			Description: "does the array contain the given value",
			Type:        listType,
		},
		{Name: eq, Type: listType},
		{Name: gt, Type: listType},
		{Name: gte, Type: listType},
		{
			Name: opIn,
			Type: listOfListType,
		},
		{
			Name: isNull,
			Type: graph.NewNamedType("Boolean"),
		},
		{Name: lt, Type: listType},
		{Name: lte, Type: listType},
		{Name: neq, Type: listType},
		{
			Name: nin,
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
	case ilike:
		return "does the column match the given case-insensitive pattern"
	case iregex:
		return "does the column match the given POSIX regular expression, case insensitive"
	case like:
		return "does the column match the given pattern"
	case nilike:
		return "does the column NOT match the given case-insensitive pattern"
	case niregex:
		return "does the column NOT match the given POSIX regular expression, case insensitive"
	case nlike:
		return "does the column NOT match the given pattern"
	case nregex:
		return "does the column NOT match the given POSIX regular expression, case sensitive"
	case nsimilar:
		return "does the column NOT match the given SQL regular expression"
	case regex:
		return "does the column match the given POSIX regular expression, case sensitive"
	case similar:
		return "does the column match the given SQL regular expression"
	case containedIn:
		return "is the column contained in the given json value"
	case opContains:
		return "does the column contain the given json value at the top level"
	case hasKey:
		return "does the string exist as a top-level key in the column"
	case hasKeysAll:
		return "do all of these strings exist as top-level keys in the column"
	case hasKeysAny:
		return "do any of these strings exist as top-level keys in the column"
	case st3dDWithin:
		return "is the column within a given 3D distance from the given geometry value"
	case "_st_3d_intersects":
		return "does the column spatially intersect the given geometry value in 3D"
	case "_st_contains":
		return "does the column contain the given geometry value"
	case "_st_crosses":
		return "does the column cross the given geometry value"
	case stDWithin:
		if scalarType == pgtypes.Geography {
			return "is the column within a given distance from the given geography value"
		}

		return "is the column within a given distance from the given geometry value"
	case "_st_equals":
		return "is the column equal to given geometry value (directionality is ignored)"
	case stIntersects:
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

// GraphQL comparison operators, scalar names and schema keys.
const (
	scalarString    = "String"
	cast            = "_cast"
	containedIn     = "_contained_in"
	opContains      = "_contains"
	eq              = "_eq"
	gt              = "_gt"
	gte             = "_gte"
	hasKey          = "_has_key"
	hasKeysAll      = "_has_keys_all"
	hasKeysAny      = "_has_keys_any"
	ilike           = "_ilike"
	opIn            = "_in"
	iregex          = "_iregex"
	isNull          = "_is_null"
	like            = "_like"
	lt              = "_lt"
	lte             = "_lte"
	neq             = "_neq"
	nilike          = "_nilike"
	nin             = "_nin"
	niregex         = "_niregex"
	nlike           = "_nlike"
	nregex          = "_nregex"
	nsimilar        = "_nsimilar"
	regex           = "_regex"
	similar         = "_similar"
	st3dDWithin     = "_st_3d_d_within"
	stDWithin       = "_st_d_within"
	stIntersects    = "_st_intersects"
	argumentsKey    = "arguments"
	columnNameLabel = "column name"
	count           = "count"
	distinct        = "distinct"
	filter          = "filter"
	onConflict      = "on_conflict"
	predicate       = "predicate"
	upsertCondition = "upsert condition"
	where           = "where"
)
