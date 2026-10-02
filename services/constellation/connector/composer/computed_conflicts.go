package composer

import (
	"context"
	"fmt"
	"log/slog"
	"reflect"
	"strings"

	"github.com/nhost/nhost/services/constellation/graph"
)

// computedArgumentOwner is identified by the SQL generator's argument
// description, not by a guessed _args suffix (remote schemas may use that
// suffix for unrelated inputs). The description survives customization.
type computedArgumentOwner struct {
	connector, input, table, field string
	selection                      *graph.Field
}

func (c *Composer) omitConflictingComputedArgs(
	ctx context.Context, logger *slog.Logger,
	roleSchemas map[string]map[string]*graph.Schema,
) {
	if c.meta == nil {
		return
	}

	sources := make(map[string]struct{}, len(c.meta.Databases))
	for _, db := range c.meta.Databases {
		sources[db.Name] = struct{}{}
	}

	roles := make(map[string]struct{})
	for _, schemas := range roleSchemas {
		for role := range schemas {
			roles[role] = struct{}{}
		}
	}

	for role := range roles {
		c.omitRoleComputedConflicts(ctx, logger, role, roleSchemas, sources)
	}
}

func (c *Composer) omitRoleComputedConflicts(
	ctx context.Context, logger *slog.Logger, role string,
	roleSchemas map[string]map[string]*graph.Schema, sources map[string]struct{},
) {
	var owners []computedArgumentOwner
	for connName, schemas := range roleSchemas {
		if _, ok := sources[connName]; ok && schemas[role] != nil {
			owners = append(owners, computedArgumentOwners(connName, schemas[role])...)
		}
	}

	conflicts := make(map[string]map[*graph.Field]computedArgumentOwner)
	for _, owner := range owners {
		input := findInput(roleSchemas[owner.connector][role], owner.input)
		if input == nil || !hasComputedInputConflict(role, input, roleSchemas) {
			continue
		}

		if conflicts[owner.connector] == nil {
			conflicts[owner.connector] = make(map[*graph.Field]computedArgumentOwner)
		}

		conflicts[owner.connector][owner.selection] = owner
	}

	for source, selections := range conflicts {
		roleSchemas[source][role] = withoutComputedSelections(roleSchemas[source][role], selections)
		for _, owner := range selections {
			tableSchema, tableName := c.computedOwnerTable(owner)
			c.inconsistencies.RecordComputedField(
				ctx,
				logger,
				source,
				tableSchema,
				tableName,
				owner.field,
				fmt.Sprintf(
					"computed argument type %q conflicts in composed role %q",
					owner.input,
					role,
				),
			)
		}
	}
}

// Resolve the description against tracked table identities: SQL identifiers
// themselves may contain dots, so splitting the displayed name is unsafe.
func (c *Composer) computedOwnerTable(owner computedArgumentOwner) (string, string) {
	for _, source := range c.meta.Databases {
		if source.Name != owner.connector {
			continue
		}

		for _, table := range source.Tables {
			schema, name := table.Table.Schema, table.Table.Name
			if owner.table == name && schema == "public" ||
				owner.table == schema+"."+name {
				return schema, name
			}
		}
	}

	// A provider's schema can outlive an inconsistent metadata entry; retain
	// the inconsistency rather than silently discarding it.
	schema, name, qualified := strings.Cut(owner.table, ".")
	if qualified {
		return schema, name
	}

	return "public", owner.table
}

func hasComputedInputConflict(
	role string, input *graph.InputObjectType,
	roleSchemas map[string]map[string]*graph.Schema,
) bool {
	for _, schemas := range roleSchemas {
		if schemas[role] != nil && conflictsWithInput(schemas[role], input) {
			return true
		}
	}

	return false
}

// The original *graph.Schema is never mutated. roleSchemas[source] is the
// provider's own map, so replacing its role entry also makes GetSchema return
// the pruned copy. Compose runs once per newly built connector set.
func withoutComputedSelections(
	schema *graph.Schema, selections map[*graph.Field]computedArgumentOwner,
) *graph.Schema {
	copySchema := *schema

	copySchema.Types = make([]*graph.ObjectType, len(schema.Types))
	for i, obj := range schema.Types {
		clone := *obj

		clone.Fields = make([]*graph.Field, 0, len(obj.Fields))
		for _, field := range obj.Fields {
			if _, omitted := selections[field]; !omitted {
				clone.Fields = append(clone.Fields, field)
			}
		}

		copySchema.Types[i] = &clone
	}

	remove := make(map[string]struct{}, len(selections))
	for _, owner := range selections {
		remove[owner.input] = struct{}{}
	}

	copySchema.Inputs = make([]*graph.InputObjectType, 0, len(schema.Inputs))
	for _, input := range schema.Inputs {
		if _, omitted := remove[input.Name]; !omitted {
			copySchema.Inputs = append(copySchema.Inputs, input)
		}
	}

	return &copySchema
}

func computedArgumentOwners(source string, schema *graph.Schema) []computedArgumentOwner {
	var owners []computedArgumentOwner
	for _, obj := range schema.Types {
		for _, field := range obj.Fields {
			for _, arg := range field.Arguments {
				if arg.Name != "args" || arg.Type == nil || arg.Type.Elem != nil {
					continue
				}

				const prefix = "input parameters for computed field "
				if !strings.HasPrefix(arg.Description, prefix) {
					continue
				}

				var name, table string
				if _, err := fmt.Sscanf(
					arg.Description,
					prefix+"%q defined on table %q",
					&name,
					&table,
				); err != nil {
					continue
				}

				owners = append(owners, computedArgumentOwner{
					connector: source, input: arg.Type.NamedType, table: table,
					field: name, selection: field,
				})
			}
		}
	}

	return owners
}

func findInput(schema *graph.Schema, name string) *graph.InputObjectType {
	for _, input := range schema.Inputs {
		if input.Name == name {
			return input
		}
	}

	return nil
}

func conflictsWithInput(schema *graph.Schema, input *graph.InputObjectType) bool {
	for _, other := range schema.Inputs {
		if other.Name == input.Name && !sameInputFields(input, other) {
			return true
		}
	}

	for _, obj := range schema.Types {
		if obj.Name == input.Name {
			return true
		}
	}

	for _, scalar := range schema.Scalars {
		if scalar.Name == input.Name {
			return true
		}
	}

	for _, enum := range schema.Enums {
		if enum.Name == input.Name {
			return true
		}
	}

	for _, iface := range schema.Interfaces {
		if iface.Name == input.Name {
			return true
		}
	}

	for _, union := range schema.Unions {
		if union.Name == input.Name {
			return true
		}
	}

	return false
}

func sameInputFields(a, b *graph.InputObjectType) bool {
	if len(a.Fields) != len(b.Fields) {
		return false
	}

	for _, field := range a.Fields {
		matched := false
		for _, candidate := range b.Fields {
			if candidate.Name == field.Name && reflect.DeepEqual(candidate.Type, field.Type) {
				matched = true
			}
		}

		if !matched {
			return false
		}
	}

	return true
}
