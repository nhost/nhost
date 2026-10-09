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
		if input == nil || !hasComputedInputConflict(role, input, roleSchemas) &&
			!hasComputedScalarConflict(
				role,
				input,
				roleSchemas[owner.connector][role],
				roleSchemas,
			) {
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

	pruneEmptyComputedSelectionTypes(&copySchema, schema)
	pruneOrphanedComputedArgumentTypes(&copySchema, schema, remove)

	return &copySchema
}

// Remove only object types made empty by the omission, then remove fields that
// reference them. A removed field can empty another type, so repeat until the
// role schema has no new empty objects. Never discard operation root types.
func pruneEmptyComputedSelectionTypes(copySchema, original *graph.Schema) {
	roots := make(map[string]struct{})
	for _, name := range []*string{original.QueryType, original.MutationType, original.SubscriptionType} {
		if name != nil {
			roots[*name] = struct{}{}
		}
	}
	// gqlparser uses these names when no explicit operation root is provided.
	for _, name := range []string{"Query", "Mutation", "Subscription"} {
		roots[name] = struct{}{}
	}

	copySchema.Interfaces = append([]*graph.InterfaceType(nil), original.Interfaces...)

	wasNonEmpty := make(map[string]bool, len(original.Types))
	for _, obj := range original.Types {
		wasNonEmpty[obj.Name] = len(obj.Fields) > 0
	}

	for {
		dropped := make(map[string]struct{})

		kept := copySchema.Types[:0]
		for _, obj := range copySchema.Types {
			_, root := roots[obj.Name]
			if !root && wasNonEmpty[obj.Name] && len(obj.Fields) == 0 {
				dropped[obj.Name] = struct{}{}
				continue
			}

			kept = append(kept, obj)
		}

		copySchema.Types = kept

		if len(dropped) == 0 {
			return
		}

		for _, obj := range copySchema.Types {
			obj.Fields = withoutDroppedOutputTypes(obj.Fields, dropped)
		}

		for i, iface := range copySchema.Interfaces {
			fields := withoutDroppedOutputTypes(iface.Fields, dropped)
			if len(fields) != len(iface.Fields) {
				clone := *iface
				clone.Fields = fields
				copySchema.Interfaces[i] = &clone
			}
		}
	}
}

func withoutDroppedOutputTypes(fields []*graph.Field, dropped map[string]struct{}) []*graph.Field {
	var kept []*graph.Field
	for i, field := range fields {
		if _, ok := dropped[namedGraphType(field.Type)]; ok {
			if kept == nil {
				kept = append(make([]*graph.Field, 0, len(fields)-1), fields[:i]...)
			}

			continue
		}

		if kept != nil {
			kept = append(kept, field)
		}
	}

	if kept == nil {
		return fields
	}

	return kept
}

//nolint:cyclop // A scalar is orphaned only after checking inputs, object/interface fields and directive references.
func pruneOrphanedComputedArgumentTypes(
	copySchema, schema *graph.Schema, remove map[string]struct{},
) {
	// A generated input (or one of its scalars) can belong to more than one
	// computed selection. Keep it whenever a surviving field still uses it.
	keepInputsUsedBySurvivingFields(remove, copySchema)

	copySchema.Inputs = make([]*graph.InputObjectType, 0, len(schema.Inputs))

	orphanedScalars := make(map[string]struct{})
	for _, input := range schema.Inputs {
		if _, omitted := remove[input.Name]; omitted {
			for _, field := range input.Fields {
				orphanedScalars[namedGraphType(field.Type)] = struct{}{}
			}
		} else {
			copySchema.Inputs = append(copySchema.Inputs, input)
		}
	}

	// A surviving object field may refer to a tracked object with the same
	// name as the orphaned argument scalar. That object reference must not
	// preserve the conflicting scalar (nor erase the object) after omission.
	protectScalar := func(typ *graph.Type) {
		name := namedGraphType(typ)
		if !conflictsWithScalar(copySchema, name) {
			delete(orphanedScalars, name)
		}
	}

	for _, input := range copySchema.Inputs {
		for _, field := range input.Fields {
			protectScalar(field.Type)
		}
	}

	for _, obj := range copySchema.Types {
		for _, field := range obj.Fields {
			protectScalar(field.Type)

			for _, arg := range field.Arguments {
				protectScalar(arg.Type)
			}
		}
	}

	for _, iface := range copySchema.Interfaces {
		for _, field := range iface.Fields {
			protectScalar(field.Type)

			for _, arg := range field.Arguments {
				protectScalar(arg.Type)
			}
		}
	}

	for _, directive := range copySchema.Directives {
		for _, arg := range directive.Arguments {
			protectScalar(arg.Type)
		}
	}

	copySchema.Scalars = make([]*graph.ScalarType, 0, len(schema.Scalars))
	for _, scalar := range schema.Scalars {
		if _, orphaned := orphanedScalars[scalar.Name]; !orphaned {
			copySchema.Scalars = append(copySchema.Scalars, scalar)
		}
	}
}

func keepInputsUsedBySurvivingFields(remove map[string]struct{}, schema *graph.Schema) {
	for _, obj := range schema.Types {
		for _, field := range obj.Fields {
			for _, arg := range field.Arguments {
				delete(remove, namedGraphType(arg.Type))
			}
		}
	}

	for _, iface := range schema.Interfaces {
		for _, field := range iface.Fields {
			for _, arg := range field.Arguments {
				delete(remove, namedGraphType(arg.Type))
			}
		}
	}

	for _, directive := range schema.Directives {
		for _, arg := range directive.Arguments {
			delete(remove, namedGraphType(arg.Type))
		}
	}
}

func namedGraphType(typ *graph.Type) string {
	for typ != nil && typ.Elem != nil {
		typ = typ.Elem
	}

	if typ == nil {
		return ""
	}

	return typ.NamedType
}

func hasComputedScalarConflict(
	role string, input *graph.InputObjectType, source *graph.Schema,
	roleSchemas map[string]map[string]*graph.Schema,
) bool {
	for _, field := range input.Fields {
		name := namedGraphType(field.Type)
		if !hasScalar(source, name) {
			continue
		}

		for _, schemas := range roleSchemas {
			if schemas[role] != nil && conflictsWithScalar(schemas[role], name) {
				return true
			}
		}
	}

	return false
}

func hasScalar(schema *graph.Schema, name string) bool {
	for _, scalar := range schema.Scalars {
		if scalar.Name == name {
			return true
		}
	}

	return false
}

func conflictsWithScalar(schema *graph.Schema, name string) bool {
	for _, input := range schema.Inputs {
		if input.Name == name {
			return true
		}
	}

	for _, obj := range schema.Types {
		if obj.Name == name {
			return true
		}
	}

	for _, enum := range schema.Enums {
		if enum.Name == name {
			return true
		}
	}

	for _, iface := range schema.Interfaces {
		if iface.Name == name {
			return true
		}
	}

	for _, union := range schema.Unions {
		if union.Name == name {
			return true
		}
	}

	return false
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
