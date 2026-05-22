package queries

import (
	"fmt"
	"maps"
	"sort"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

type relationship struct {
	name           string
	aggregateName  string
	table          *table
	isArray        bool
	fkColumn       string
	parentColumns  []string
	targetColumns  []string
	joinIsReversed bool

	// Cross-database relationship fields. joinColumns maps the local column
	// name to its counterpart on the remote table; the controller resolves
	// the join after both sides have executed.
	isRemote          bool
	remoteSource      string
	remoteTableName   string
	remoteTableSchema string
	joinColumns       map[string]string

	// Remote schema relationship fields. lhsFields lists the columns from
	// this table that get substituted into remoteFieldPath when forwarding
	// the operation to the remote GraphQL schema.
	isRemoteSchema   bool
	remoteSchemaName string
	lhsFields        []string
	remoteFieldPath  []metadata.RemoteFieldPathEntry
}

// newRelationship dispatches to the concrete constructor for the relationship
// kind declared in the metadata: remote schema, cross-database, or local FK/manual.
func newRelationship(
	name string,
	using metadata.RelationshipUsing,
	isArray bool,
	parentTableObj *introspection.Table,
	objects *introspection.Objects,
	tables []*table,
) (*relationship, error) {
	if using.ManualConfiguration != nil && using.ManualConfiguration.RemoteSchema != "" {
		return newRemoteSchemaRelationship(name, using, isArray)
	}

	if using.ManualConfiguration != nil && using.ManualConfiguration.Source != "" {
		return newRemoteRelationship(name, using, isArray, parentTableObj)
	}

	return newLocalRelationship(name, using, isArray, parentTableObj, objects, tables)
}

func newLocalRelationship(
	name string,
	using metadata.RelationshipUsing,
	isArray bool,
	parentTableObj *introspection.Table,
	objects *introspection.Objects,
	tables []*table,
) (*relationship, error) {
	fkColumn, parentColumns, targetColumns, isReverse, err := buildJoinCondition(
		using,
		isArray,
		parentTableObj,
		objects,
	)
	if err != nil {
		return nil, fmt.Errorf("building join condition for relationship %s: %w", name, err)
	}

	tableObj, found := getRelationshipTable(using, objects, parentTableObj)
	if !found {
		return nil, fmt.Errorf("%w: %s", errRelationshipTargetTableNotFound, name)
	}

	var table *table
	for _, t := range tables {
		if t.schemaName == tableObj.Schema && t.tableName == tableObj.Name {
			table = t
			break
		}
	}

	if table == nil {
		return nil, fmt.Errorf(
			"%w: %s", errRelationshipTargetTableObjectNotFound, name)
	}

	return &relationship{
		name:              name,
		aggregateName:     name + "_aggregate",
		table:             table,
		isArray:           isArray,
		fkColumn:          fkColumn,
		parentColumns:     parentColumns,
		targetColumns:     targetColumns,
		joinIsReversed:    isReverse,
		isRemote:          false,
		remoteSource:      "",
		remoteTableName:   "",
		remoteTableSchema: "",
		joinColumns:       nil,
		isRemoteSchema:    false,
		remoteSchemaName:  "",
		lhsFields:         nil,
		remoteFieldPath:   nil,
	}, nil
}

// newRemoteRelationship creates a new remote (cross-database) relationship.
// Remote relationships don't have a local target table - the join is performed
// at the controller level after executing queries against multiple databases.
func newRemoteRelationship(
	name string,
	using metadata.RelationshipUsing,
	isArray bool,
	_ *introspection.Table,
) (*relationship, error) {
	if using.ManualConfiguration == nil {
		return nil, fmt.Errorf("%w: %s", errRemoteRelationshipRequiresManualConfig, name)
	}

	joinColumns := make(map[string]string, len(using.ManualConfiguration.ColumnMapping))
	maps.Copy(joinColumns, using.ManualConfiguration.ColumnMapping)

	parentColumns := make([]string, 0, len(joinColumns))
	for localCol := range joinColumns {
		parentColumns = append(parentColumns, localCol)
	}

	sort.Strings(parentColumns)

	return &relationship{
		name:              name,
		aggregateName:     name + "_aggregate",
		table:             nil, // No local table for remote relationships
		isArray:           isArray,
		fkColumn:          "",
		parentColumns:     parentColumns,
		targetColumns:     nil,
		joinIsReversed:    false,
		isRemote:          true,
		remoteSource:      using.ManualConfiguration.Source,
		remoteTableName:   using.ManualConfiguration.RemoteTable.Name,
		remoteTableSchema: using.ManualConfiguration.RemoteTable.Schema,
		joinColumns:       joinColumns,
		isRemoteSchema:    false,
		remoteSchemaName:  "",
		lhsFields:         nil,
		remoteFieldPath:   nil,
	}, nil
}

// newRemoteSchemaRelationship creates a new remote schema relationship.
// Remote schema relationships resolve against a remote GraphQL schema
// rather than a database table.
func newRemoteSchemaRelationship(
	name string,
	using metadata.RelationshipUsing,
	isArray bool,
) (*relationship, error) {
	if using.ManualConfiguration == nil {
		return nil, fmt.Errorf("%w: %s", errRemoteSchemaRelationshipRequiresManualConfig, name)
	}

	if using.ManualConfiguration.RemoteSchema == "" {
		return nil, fmt.Errorf("%w: %s", errRemoteSchemaRelationshipRequiresRemoteSchema, name)
	}

	lhsFields := make([]string, 0, len(using.ManualConfiguration.ColumnMapping))
	for localCol := range using.ManualConfiguration.ColumnMapping {
		lhsFields = append(lhsFields, localCol)
	}

	return &relationship{
		name:              name,
		aggregateName:     name + "_aggregate",
		table:             nil, // No local table for remote schema relationships
		isArray:           isArray,
		fkColumn:          "",
		parentColumns:     nil,
		targetColumns:     nil,
		joinIsReversed:    false,
		isRemote:          false,
		remoteSource:      "",
		remoteTableName:   "",
		remoteTableSchema: "",
		joinColumns:       nil,
		isRemoteSchema:    true,
		remoteSchemaName:  using.ManualConfiguration.RemoteSchema,
		lhsFields:         lhsFields,
		remoteFieldPath:   using.ManualConfiguration.RemoteFieldPath,
	}, nil
}

func (r *relationship) writeJoinConditionAliased(
	b *strings.Builder,
	parentAlias, targetAlias string,
) {
	for i := range r.parentColumns {
		if i > 0 {
			b.WriteString(" AND ")
		}

		if r.joinIsReversed {
			// target.fk = parent.pk
			core.WriteQualifiedColumn(b, targetAlias, r.targetColumns[i])
			b.WriteString(" = ")
			core.WriteQualifiedColumn(b, parentAlias, r.parentColumns[i])
		} else {
			// parent.fk = target.pk
			core.WriteQualifiedColumn(b, parentAlias, r.parentColumns[i])
			b.WriteString(" = ")
			core.WriteQualifiedColumn(b, targetAlias, r.targetColumns[i])
		}
	}
}

// buildJoinConditionForSelection returns the SQL join predicate used inside
// a relationship sub-select, qualifying the parent side with parentAlias and
// leaving the target columns unqualified (they refer to the FROM clause of
// the enclosing sub-select). parentAlias is supplied unquoted and is double-
// quoted here. Returns "TRUE" when no columns are configured.
//
// This replaces an earlier fmt.Sprintf-based templating approach: column
// names are written directly through core.WriteQualifiedColumn /
// core.WriteQuotedIdentifier, so a `%` embedded in a DDL-defined column name
// can no longer be interpreted as a format verb downstream.
func (r *relationship) buildJoinConditionForSelection(parentAlias string) string {
	if len(r.parentColumns) == 0 {
		return "TRUE"
	}

	var b strings.Builder

	quotedParent := core.QuoteIdentifier(parentAlias)

	for i := range r.parentColumns {
		if i > 0 {
			b.WriteString(" AND ")
		}

		if r.joinIsReversed {
			// target.fk (unqualified) = parent.pk
			core.WriteQuotedIdentifier(&b, r.targetColumns[i])
			b.WriteString(" = ")
			core.WriteQualifiedColumn(&b, quotedParent, r.parentColumns[i])
		} else {
			// parent.fk = target.pk (unqualified)
			core.WriteQualifiedColumn(&b, quotedParent, r.parentColumns[i])
			b.WriteString(" = ")
			core.WriteQuotedIdentifier(&b, r.targetColumns[i])
		}
	}

	return b.String()
}

// buildSelectionSQL emits SQL for a nested relationship selection — aggregate,
// array, or object — by dispatching to the target table's build* methods with a
// join-condition modifier. Returns errRemoteRelationship if the relationship is
// remote; callers are expected to skip those upstream, this is a safety net.
func (r *relationship) buildSelectionSQL( //nolint:funlen
	b *strings.Builder,
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	params []any,
	paramIndex int,
	parentTableAlias string,
	relationshipAlias string,
) ([]any, int, error) {
	if r.isRemote {
		return nil, 0, errRemoteRelationship
	}

	joinCondition := r.buildJoinConditionForSelection(parentTableAlias)

	outputName := relationshipAlias
	if idx := strings.LastIndex(relationshipAlias, "."); idx >= 0 {
		outputName = relationshipAlias[idx+1:]
	}

	var err error

	switch {
	case field.Name == r.aggregateName:
		params, paramIndex, err = r.table.writeQueryAggregateSQL(
			b,
			field,
			fragments,
			variables,
			role,
			sessionVariables,
			roots,
			params,
			paramIndex,
			outputName,
			r.table.tableFromClause(),
			r.table.tableSourceRef(),
			func(whereClause where.Clause, modifiers []arguments.QueryModifier) (where.Clause, []arguments.QueryModifier) {
				return append(whereClause, where.NewRawFilter(joinCondition)), modifiers
			},
		)
	case r.isArray:
		params, paramIndex, err = r.table.writeQueryCollectionSQL(
			b,
			field,
			fragments,
			variables,
			role,
			sessionVariables,
			roots,
			params,
			paramIndex,
			relationshipAlias,
			outputName,
			func(whereClause where.Clause, modifiers []arguments.QueryModifier) (where.Clause, []arguments.QueryModifier) {
				return append(whereClause, where.NewRawFilter(joinCondition)), modifiers
			},
		)
	default:
		params, paramIndex, err = r.table.writeQueryByPkSQL(
			b,
			field,
			fragments,
			variables,
			role,
			sessionVariables,
			roots,
			params,
			paramIndex,
			relationshipAlias,
			outputName,
			func(whereClause where.Clause, modifiers []arguments.QueryModifier) (where.Clause, []arguments.QueryModifier) {
				return append(whereClause, where.NewRawFilter(joinCondition)), modifiers
			},
		)
	}

	if err != nil {
		return nil, 0, fmt.Errorf("error building selection SQL for relationship %s: %w",
			r.name, err)
	}

	return params, paramIndex, nil
}

func getRelationshipPk(
	using metadata.RelationshipUsing,
) (string, bool) {
	var (
		fkColumn  string
		isReverse bool
	)

	switch {
	case using.ForeignKeyColumn != "":
		// Simple: FK in parent table
		fkColumn = using.ForeignKeyColumn
		isReverse = false
	case using.ForeignKeyConstraint != nil:
		// Complex: FK in target table
		fkColumn = using.ForeignKeyConstraint.Column
		isReverse = true
	case using.ManualConfiguration != nil:
		// Manual configuration
		if len(using.ManualConfiguration.ColumnMapping) > 0 {
			for _, targetCol := range using.ManualConfiguration.ColumnMapping {
				fkColumn = targetCol
				isReverse = false

				break
			}
		}
	}

	return fkColumn, isReverse
}

// buildManualJoinCondition builds the join column structure for manually
// configured relationships. Manual configurations specify explicit
// local->remote column mappings; multi-column mappings are supported and the
// downstream renderer AND-joins each column pair.
// Returns: (fkColumn, parentColumns, targetColumns, isReversed).
func buildManualJoinCondition(
	mapping map[string]string,
	isArray bool,
) (string, []string, []string, bool) {
	if len(mapping) == 0 {
		return "", nil, nil, false
	}

	// Sort keys for deterministic output (Go map iteration is random).
	localCols := make([]string, 0, len(mapping))
	for src := range mapping {
		localCols = append(localCols, src)
	}

	sort.Strings(localCols)

	remoteCols := make([]string, 0, len(mapping))
	for _, src := range localCols {
		remoteCols = append(remoteCols, mapping[src])
	}

	return localCols[0], localCols, remoteCols, isArray
}

// buildJoinCondition resolves the join column structure for a local
// relationship and returns the structured join info consumed by the
// relationship renderer.
// Returns: (fkColumn, parentColumns, targetColumns, isReversed).
func buildJoinCondition(
	using metadata.RelationshipUsing,
	isArray bool,
	parentTable *introspection.Table,
	objects *introspection.Objects,
) (string, []string, []string, bool, error) {
	if using.ManualConfiguration != nil {
		fk, pc, tc, rev := buildManualJoinCondition(
			using.ManualConfiguration.ColumnMapping,
			isArray,
		)

		return fk, pc, tc, rev, nil
	}

	// Determine foreign key columns and join direction
	fkColumn, isReverse := getRelationshipPk(using)

	switch {
	case isArray, isReverse:
		// Array/reverse relationship: target.fk = parent.pk
		if fkColumn != "" && len(parentTable.PrimaryKeys) > 0 {
			return fkColumn,
				[]string{parentTable.PrimaryKeys[0]}, []string{fkColumn}, true, nil
		}

		return fkColumn, nil, nil, true, nil
	default:
		// Forward relationship: parent.fk = target.pk
		targetSchema, targetTableName := getRelationshipTarget(using, parentTable)

		var targetPK string
		if targetTableName != "" {
			if targetTable, ok := objects.GetTable(targetSchema, targetTableName); ok {
				if len(targetTable.PrimaryKeys) > 0 {
					targetPK = targetTable.PrimaryKeys[0]
				}
			} else {
				return "", nil, nil, false,
					fmt.Errorf(
						"%w: %s.%s",
						errRelationshipTargetTableIntrospectionNotFound,
						targetSchema,
						targetTableName,
					)
			}
		}

		if fkColumn != "" {
			return fkColumn,
				[]string{fkColumn}, []string{targetPK}, false, nil
		}

		return fkColumn, nil, nil, false, nil
	}
}

func getRelationshipTarget(
	using metadata.RelationshipUsing,
	parentTable *introspection.Table,
) (string, string) {
	// FK in parent: parent.fk = target.pk
	// Determine target table from relationship configuration
	var targetSchema, targetTableName string

	switch {
	case using.ForeignKeyColumn != "":
		// Simple case: need to look up FK to find target table
		for _, fk := range parentTable.ForeignKeys {
			if fk.ColumnName == using.ForeignKeyColumn {
				targetSchema = fk.ForeignSchema
				targetTableName = fk.ForeignTable

				break
			}
		}
	case using.ForeignKeyConstraint != nil:
		targetSchema = using.ForeignKeyConstraint.Table.Schema
		targetTableName = using.ForeignKeyConstraint.Table.Name
	case using.ManualConfiguration != nil:
		targetSchema = using.ManualConfiguration.RemoteTable.Schema
		targetTableName = using.ManualConfiguration.RemoteTable.Name
	}

	return targetSchema, targetTableName
}

func getRelationshipTable(
	using metadata.RelationshipUsing,
	objects *introspection.Objects,
	parentTable *introspection.Table,
) (*introspection.Table, bool) {
	targetSchema, targetTableName := getRelationshipTarget(using, parentTable)

	if targetTableName != "" {
		if targetTable, ok := objects.GetTable(targetSchema, targetTableName); ok {
			return targetTable, true
		}
	}

	return nil, false
}
