package queries

import (
	"fmt"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
)

// buildNestedInsertCTE renders the CTE for a single nested insert, recursing
// into deeper nested inserts. It replaces the (*nestedInsert).buildCTE method
// from before the arguments extraction: arguments.NestedInsert is pure data,
// so the CTE-building logic that calls back into queries-internal table
// methods (buildSingleInsertCTE) lives here.
func buildNestedInsertCTE(
	b *strings.Builder,
	ni *arguments.NestedInsert,
	parentCTEName string,
	params []any,
	paramIndex int,
	role string,
	sessionVariables map[string]any,
) ([]any, int, error) {
	cteName := "nested_" + ni.RelationshipName

	if b.Len() > 0 {
		b.WriteString(", ")
	}

	nestedFKIndex := ni.ApplyArrayFKColumn(parentCTEName)

	for _, col := range ni.NestedObject.Columns {
		if _, isFK := nestedFKIndex[col.Column.SQLName]; !isFK {
			params = append(params, col.Value)
		}
	}

	// ni.TargetTable always arrives as a *table — that's the only thing the
	// parser stores there (see arguments_adapter.go's TargetTable method on
	// *relationship). Use a checked assertion so a future parser change fails
	// loudly instead of panicking.
	target, ok := ni.TargetTable.(*table)
	if !ok {
		return nil, 0, fmt.Errorf(
			"nested insert %s: target table is %T, expected *table",
			ni.RelationshipName, ni.TargetTable,
		)
	}

	params, paramIndex, err := target.buildSingleInsertCTE(
		b, cteName, ni.NestedObject, ni.OnConflict, nestedFKIndex,
		params, paramIndex, role, sessionVariables,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to build CTE for %s: %w", ni.RelationshipName, err)
	}

	for i := range ni.NestedObject.NestedInserts {
		nested := &ni.NestedObject.NestedInserts[i]

		params, paramIndex, err = buildNestedInsertCTE(
			b, nested, cteName, params, paramIndex, role, sessionVariables,
		)
		if err != nil {
			return nil, 0, fmt.Errorf(
				"failed to build nested CTE for %s: %w", nested.RelationshipName, err,
			)
		}
	}

	return params, paramIndex, nil
}

// buildNestedInsertCTEs builds CTEs for all nested inserts.
// Returns the CTE SQL string and updated params/paramIndex.
func (t *table) buildNestedInsertCTEs(
	insertObjs []arguments.InsertObject,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) (string, []any, int, error) {
	if len(insertObjs) == 0 || len(insertObjs[0].NestedInserts) == 0 {
		return "", params, paramIndex, nil
	}

	var cteSQL strings.Builder
	for i := range insertObjs[0].NestedInserts {
		nested := &insertObjs[0].NestedInserts[i]

		var err error

		params, paramIndex, err = buildNestedInsertCTE(
			&cteSQL, nested, "mutation_result", params, paramIndex, role, sessionVariables,
		)
		if err != nil {
			return "", nil, 0, fmt.Errorf(
				"failed to build CTE for %s: %w",
				nested.RelationshipName,
				err,
			)
		}
	}

	return cteSQL.String(), params, paramIndex, nil
}

// buildNestedFKIndex maps foreign-key columns to their nested CTE names. For
// object relationships the FK lives on the parent row, so the FK column is
// appended to every insert object — array relationships put the FK on the
// child and don't need this fix-up.
func (t *table) buildNestedFKIndex(
	insertObjs []arguments.InsertObject,
) map[string]string {
	nestedFKIndex := make(map[string]string) // column -> CTE name
	if len(insertObjs) == 0 {
		return nestedFKIndex
	}

	for _, nested := range insertObjs[0].NestedInserts {
		cteName := "nested_" + nested.RelationshipName
		nestedFKIndex[nested.ForeignKeyColumn] = cteName

		if !nested.IsArrayRelationship {
			fkColumn := t.columnFromSQLName(nested.ForeignKeyColumn)
			if fkColumn != nil {
				for _, obj := range insertObjs {
					obj.Columns = append(obj.Columns, arguments.InsertColumn{
						Column: fkColumn,
						Value:  nil,
					})
				}
			}
		}
	}

	return nestedFKIndex
}

// buildNestedCTEsMap builds a map of relationship names to CTE names for response building.
func (t *table) buildNestedCTEsMap(insertObjs []arguments.InsertObject) map[string]string {
	nestedCTEs := make(map[string]string)
	if len(insertObjs) == 0 {
		return nestedCTEs
	}

	for _, nested := range insertObjs[0].NestedInserts {
		cteName := "nested_" + nested.RelationshipName
		nestedCTEs[nested.RelationshipName] = cteName
	}

	return nestedCTEs
}
