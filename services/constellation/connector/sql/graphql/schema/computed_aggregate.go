package schema

import "github.com/nhost/nhost/services/constellation/graph"

// Hasura uses the computed function's declared return type for aggregate
// results, even for avg and variance where physical columns use Float.
// Aggregate output fields retain the selection's args but not its JSON path.
func computedAggregateField(field *graph.Field) *graph.Field {
	var args []*graph.Argument
	for _, arg := range field.Arguments {
		if arg.Name == "args" {
			args = append(args, arg)
		}
	}

	return &graph.Field{
		Name: field.Name, Description: field.Description,
		Type: field.Type, Arguments: args, Directives: nil,
	}
}

func comparableComputedAggregateFields(fields []*graph.Field) []*graph.Field {
	var result []*graph.Field
	for _, field := range fields {
		switch field.Type.NamedType {
		case "String", "bpchar", "citext", "smallint", "Int", "bigint", "float4", "float8",
			"numeric", "money", "date", "timestamp", "timestamptz", "uuid":
			result = append(result, computedAggregateField(field))
		}
	}

	return result
}

func numericComputedAggregateFields(fields []*graph.Field) []*graph.Field {
	var result []*graph.Field
	for _, field := range fields {
		switch field.Type.NamedType {
		case "Int", "smallint", "bigint", "float4", "float8", "numeric", "money":
			result = append(result, computedAggregateField(field))
		}
	}

	return result
}

func hasNumericComputedFields(fields []*graph.Field) bool {
	return len(numericComputedAggregateFields(fields)) != 0
}
