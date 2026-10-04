package schema

import (
	"fmt"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// Table-returning computed fields derive access from the returned table's
// select permission, not from a computed_fields grant on the parent table.
func tableComputedFields(
	s *graph.Schema,
	parent *metadata.TableMetadata,
	objects *introspection.Objects,
	md *metadata.DatabaseMetadata,
	role string,
	caps Capabilities,
	used map[string]struct{},
) []*graph.Field {
	if !caps.SupportsComputedFields || !caps.SupportsComputedTableSelection {
		return nil
	}

	var fields []*graph.Field
	for _, field := range parent.ComputedFields {
		lookup, ok := objects.GetComputedFunction(
			parent.Table.Schema,
			parent.Table.Name,
			field.Name,
		)
		if !ok || lookup.Function == nil || !lookup.Function.ReturnSet ||
			lookup.Function.ReturnRelOID == 0 {
			continue
		}

		fn := lookup.Function

		target := computedTargetTable(md, fn)

		if target == nil || role != roleAdmin && getSelectPermission(target, role) == nil {
			continue
		}

		targetName := getCustomOrDefaultTypeName(target)

		description := field.Comment
		if description == "" {
			description = fmt.Sprintf(
				"A computed field, executes function %q",
				computedDescriptionName(fn.Schema, fn.Name),
			)
		}

		args := tableComputedArguments(s, parent, field, fn, targetName, caps, used)

		fields = append(fields, &graph.Field{
			Name: field.Name, Description: description,
			Type:      graph.NewListType(graph.NewNonNullType(targetName)),
			Arguments: args, Directives: nil,
		})
	}

	return fields
}

func computedTargetTable(
	md *metadata.DatabaseMetadata,
	fn *introspection.ComputedFunction,
) *metadata.TableMetadata {
	for i := range md.Tables {
		if md.Tables[i].Table.Schema == fn.ReturnType.Schema &&
			md.Tables[i].Table.Name == fn.ReturnType.Name {
			return &md.Tables[i]
		}
	}

	return nil
}

func tableComputedArguments(
	s *graph.Schema,
	parent *metadata.TableMetadata,
	field metadata.ComputedField,
	fn *introspection.ComputedFunction,
	targetName string,
	caps Capabilities,
	used map[string]struct{},
) []*graph.Argument {
	args := collectionArguments(targetName, caps)
	userArgs := make([]*graph.InputField, 0)

	required := false
	for i, name := range fn.GraphQLArgumentNames(field.Definition.SessionArgument) {
		if name == "" {
			continue
		}

		arg := fn.Arguments[i]
		typ := getGraphQLScalarType(arg.Type.Name)
		used[typ] = struct{}{}
		userArgs = append(userArgs, &graph.InputField{
			Name:         name,
			Type:         graph.NewNamedType(typ),
			Description:  "",
			DefaultValue: nil,
			Directives:   nil,
		})

		if !arg.HasDefault {
			required = true
		}
	}

	if len(userArgs) == 0 {
		return args
	}

	name := field.Name + "_" + getCustomOrDefaultTypeName(parent) + "_args"
	s.Inputs = append(s.Inputs, &graph.InputObjectType{
		Name: name, Fields: userArgs, Description: "", Directives: nil,
	})

	typ := graph.NewNamedType(name)
	if required {
		typ = graph.NewNonNullType(name)
	}

	return append([]*graph.Argument{{
		Name: "args", Type: typ,
		Description: fmt.Sprintf("input parameters for computed field %q defined on table %q",
			field.Name, computedDescriptionName(parent.Table.Schema, parent.Table.Name)),
		DefaultValue: nil, Directives: nil,
	}}, args...)
}
