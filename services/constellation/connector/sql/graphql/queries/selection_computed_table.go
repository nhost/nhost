package queries

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

type computedTable struct {
	call  computedScalar
	table *table
	roles map[string]struct{}
}

func (t *table) initializeComputedTables(
	objects *introspection.Objects,
	parent metadata.TableMetadata,
	metadataTables []metadata.TableMetadata,
	tables map[string]*table,
) {
	for _, field := range parent.ComputedFields {
		lookup, found := objects.GetComputedFunction(t.schemaName, t.tableName, field.Name)
		if !found || lookup.Function == nil || !lookup.Function.ReturnSet ||
			lookup.Function.ReturnRelOID == 0 {
			continue
		}

		fn := lookup.Function
		key := fn.ReturnType.Schema + "." + fn.ReturnType.Name

		target := tables[key]
		if target == nil {
			continue
		}

		roles := make(map[string]struct{})
		for i := range metadataTables {
			if metadataTables[i].Table.Schema != fn.ReturnType.Schema ||
				metadataTables[i].Table.Name != fn.ReturnType.Name {
				continue
			}

			for _, permission := range metadataTables[i].SelectPermissions {
				roles[permission.Role] = struct{}{}
			}

			break
		}

		t.computedTables = append(t.computedTables, computedTable{
			call: computedScalar{
				name: field.Name, function: fn, sessionArgument: field.Definition.SessionArgument,
			},
			table: target,
			roles: roles,
		})
	}
}

func (t *table) computedTableFromGraphqlName(name, role string) *computedTable {
	for i := range t.computedTables {
		computed := &t.computedTables[i]
		if computed.call.name != name {
			continue
		}

		if role == metadata.RoleAdmin {
			return computed
		}

		if _, ok := computed.roles[role]; ok {
			return computed
		}
	}

	return nil
}

// buildSelectionSQL dispatches table-valued fields through the same collection
// builder as array relationships. The function result, not its base table, is
// the target FROM source, so target filters and modifiers cannot escape it.
func (selected relationshipSelection) buildSelectionSQL(
	b *strings.Builder,
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	params []any,
	paramIndex int,
	parentAlias string,
	alias string,
	parentArgumentPath string,
) ([]any, int, error) {
	if selected.computed == nil {
		return selected.relationship.buildSelectionSQL(
			b, field, fragments, variables, role, sessionVariables, roots,
			params, paramIndex, parentAlias, alias, parentArgumentPath,
		)
	}

	computed := selected.computed
	parent := selected.parent

	var call strings.Builder

	argumentPath := childArgumentPath(parentArgumentPath, field)

	params, paramIndex, err := parent.writeComputedCall(
		&call, &computed.call, field, parentAlias, argumentPath,
		variables, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("building computed table call %s: %w", field.Name, err)
	}

	// Quote an internal alias rather than the function's table name. A function
	// returning SETOF rows is not the tracked base table even when their column
	// names coincide; this reference also scopes scalar computed where/order
	// expressions to the returned rows.
	sourceRef := core.QuoteIdentifier(sqlAlias(alias, ".source"))
	from := call.String() + " AS " + sourceRef

	params, paramIndex, err = computed.table.writeQueryCollectionSQLFromSource(
		b, field, fragments, variables, role, sessionVariables, roots,
		params, paramIndex, alias, rootFieldName(field), from, sourceRef, argumentPath,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("building computed table selection %s: %w", field.Name, err)
	}

	return params, paramIndex, nil
}
