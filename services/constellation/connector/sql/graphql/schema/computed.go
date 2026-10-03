package schema

import (
	"fmt"
	"slices"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// scalarComputedFields adds only reconciled, role-granted scalar selections.
// A denied role must not receive even an otherwise unreferenced _args type.
//
//nolint:cyclop,funlen // Role grants, signature checks, optional args and JSON paths are independent gates.
func scalarComputedFields(
	s *graph.Schema,
	table *metadata.TableMetadata,
	objects *introspection.Objects,
	role string,
	caps Capabilities,
	used map[string]struct{},
) []*graph.Field {
	if !caps.SupportsComputedFields || !caps.SupportsComputedScalarSelection {
		return nil
	}

	var fields []*graph.Field
	for _, field := range table.ComputedFields {
		lookup, ok := objects.GetComputedFunction(table.Table.Schema, table.Table.Name, field.Name)
		if !ok || lookup.Function == nil || lookup.Function.ReturnRelOID != 0 ||
			lookup.Function.ReturnSet ||
			lookup.Function.ReturnType.Kind != "b" {
			continue
		}

		if !computedSelectGrant(table, role, field.Name) {
			continue
		}

		fn := lookup.Function
		argumentNames := fn.GraphQLArgumentNames(field.Definition.SessionArgument)
		scalar := getGraphQLScalarType(fn.ReturnType.Name)
		used[scalar] = struct{}{}

		description := field.Comment
		if description == "" {
			description = fmt.Sprintf(
				"A computed field, executes function %q",
				computedDescriptionName(fn.Schema, fn.Name),
			)
		}

		graphField := &graph.Field{
			Name:        field.Name,
			Description: description,
			Type:        graph.NewNamedType(scalar),
			Arguments:   nil,
			Directives:  nil,
		}

		var args []*graph.InputField

		required := false
		for i, arg := range fn.Arguments {
			name := argumentNames[i]
			if name == "" {
				continue
			}

			typ := getGraphQLScalarType(arg.Type.Name)
			used[typ] = struct{}{}

			if !arg.HasDefault {
				required = true
			}

			args = append(args, &graph.InputField{
				Name:         name,
				Type:         graph.NewNamedType(typ),
				Description:  "",
				DefaultValue: nil,
				Directives:   nil,
			})
		}

		if len(args) > 0 {
			name := field.Name + "_" + getCustomOrDefaultTypeName(table) + "_args"
			s.Inputs = append(s.Inputs, &graph.InputObjectType{
				Name: name, Fields: args, Description: "", Directives: nil,
			})

			argsType := graph.NewNamedType(name)
			if required {
				argsType = graph.NewNonNullType(name)
			}

			graphField.Arguments = append(
				graphField.Arguments,
				&graph.Argument{
					Name: "args",
					Type: argsType,
					Description: fmt.Sprintf(
						"input parameters for computed field %q defined on table %q",
						field.Name,
						computedDescriptionName(table.Table.Schema, table.Table.Name),
					),
					DefaultValue: nil,
					Directives:   nil,
				},
			)
		}

		if scalar == "json" || scalar == "jsonb" {
			graphField.Arguments = append(
				graphField.Arguments,
				&graph.Argument{
					Name:         "path",
					Type:         graph.NewNamedType("String"),
					Description:  "JSON select path",
					DefaultValue: nil,
					Directives:   nil,
				},
			)
		}

		fields = append(fields, graphField)
	}

	return fields
}

func computedRequiresUserArgs(field *graph.Field) bool {
	for _, arg := range field.Arguments {
		if arg.Name == "args" {
			return true
		}
	}

	return false
}

func computedDescriptionName(schema, name string) string {
	if schema == "public" {
		return name
	}

	return schema + "." + name
}

func computedSelectGrant(table *metadata.TableMetadata, role, name string) bool {
	if role == roleAdmin {
		return true
	}

	permission := getSelectPermission(table, role)
	if permission == nil {
		return false
	}

	return slices.Contains(permission.Permission.ComputedFields, name)
}
