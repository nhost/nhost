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
	fkColumns      []string
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
	fkColumns, parentColumns, targetColumns, isReverse, err := buildJoinCondition(
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
		fkColumns:         fkColumns,
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
		fkColumns:         nil,
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
		fkColumns:         nil,
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

// getRelationshipPk reports the FK columns named by the Using clause and
// whether the join direction is reversed (FK lives on the target table).
// Only the introspected-FK shapes are handled here: manual configuration is
// dispatched to buildManualJoinCondition by the sole caller (buildJoinCondition)
// before this function is reached.
//
// Forward case (ForeignKeyColumns set): returns the parent-side column list.
// Reverse case (ForeignKeyConstraint set): returns the target-side column
// list (the columns that live on the target table).
func getRelationshipPk(
	using metadata.RelationshipUsing,
) ([]string, bool) {
	switch {
	case len(using.ForeignKeyColumns) > 0:
		// Simple: FK in parent table
		return append([]string(nil), using.ForeignKeyColumns...), false
	case using.ForeignKeyConstraint != nil:
		// Complex: FK in target table
		return append([]string(nil), using.ForeignKeyConstraint.Columns...), true
	}

	return nil, false
}

// buildManualJoinCondition builds the join column structure for manually
// configured relationships. Manual configurations specify explicit
// local->remote column mappings; multi-column mappings are supported and the
// downstream renderer AND-joins each column pair.
// Returns: (fkColumns, parentColumns, targetColumns, isReversed).
func buildManualJoinCondition(
	mapping map[string]string,
	isArray bool,
) ([]string, []string, []string, bool) {
	if len(mapping) == 0 {
		return nil, nil, nil, false
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

	return localCols, localCols, remoteCols, isArray
}

// buildJoinCondition resolves the join column structure for a local
// relationship and returns the structured join info consumed by the
// relationship renderer. Composite FKs (multiple columns per relationship)
// are supported; each parent column is paired to its target column in the
// order the metadata listed them, and the downstream emitter AND-joins the
// pairs.
// Returns: (fkColumns, parentColumns, targetColumns, isReversed).
func buildJoinCondition(
	using metadata.RelationshipUsing,
	isArray bool,
	parentTable *introspection.Table,
	objects *introspection.Objects,
) ([]string, []string, []string, bool, error) {
	if using.ManualConfiguration != nil {
		fk, pc, tc, rev := buildManualJoinCondition(
			using.ManualConfiguration.ColumnMapping,
			isArray,
		)

		return fk, pc, tc, rev, nil
	}

	fkColumns, isReverse := getRelationshipPk(using)

	switch {
	case isReverse:
		// Reverse: FK lives on the target table. Pair each FK column on the
		// target with the matching column on the parent via the introspected
		// FK metadata of the target table.
		return buildReverseJoin(using, fkColumns, objects)
	case isArray:
		// Array forward (rare): treat each FK column as pointing at the
		// parent's matching primary key column. The introspection emitter
		// produces one ForeignKey entry per column pair, so look those up.
		parentCols, targetCols := pairForwardColumns(fkColumns, parentTable)

		return fkColumns, parentCols, targetCols, true, nil
	default:
		// Forward: parent.fk = target.column. Pair each parent FK column
		// with its target column via parentTable.ForeignKeys.
		targetSchema, targetTableName := getRelationshipTarget(using, parentTable)

		if targetTableName != "" {
			if _, ok := objects.GetTable(targetSchema, targetTableName); !ok {
				return nil, nil, nil, false,
					fmt.Errorf(
						"%w: %s.%s",
						errRelationshipTargetTableIntrospectionNotFound,
						targetSchema,
						targetTableName,
					)
			}
		}

		parentCols, targetCols := pairForwardColumns(fkColumns, parentTable)

		return fkColumns, parentCols, targetCols, false, nil
	}
}

// pairForwardColumns returns the parent-side and target-side column lists for
// a forward FK relationship. Each entry in fkColumns is matched against the
// parent table's introspected ForeignKeys; the target column is read off the
// matching entry.
//
// Callers are expected to validate the target table's existence (and, in the
// forward branch, that every fkColumn agrees on the same target) before
// invoking this function — typically via getRelationshipTarget /
// (*introspection.Table).LookupForwardFKTarget. An unmatched fkColumn would
// emit a pair of (parentCol, "") whose downstream rendering through
// core.WriteQualifiedColumn / core.WriteQuotedIdentifier is malformed SQL
// (an empty quoted identifier `""`), so reaching that state indicates a
// metadata/introspection invariant violation rather than a graceful
// degradation path.
func pairForwardColumns(
	fkColumns []string,
	parentTable *introspection.Table,
) ([]string, []string) {
	if len(fkColumns) == 0 {
		return nil, nil
	}

	parentCols := make([]string, 0, len(fkColumns))
	targetCols := make([]string, 0, len(fkColumns))

	for _, col := range fkColumns {
		parentCols = append(parentCols, col)

		var matched string

		for _, fk := range parentTable.ForeignKeys {
			if fk.ColumnName == col {
				matched = fk.ForeignColumnName
				break
			}
		}

		targetCols = append(targetCols, matched)
	}

	return parentCols, targetCols
}

// buildReverseJoin pairs reverse-FK columns: the columns named in
// ForeignKeyConstraint.Columns live on the target table; their counterparts
// on the parent are read from the target table's introspected ForeignKeys
// (those whose ForeignTable/ForeignSchema point back at the parent). Returns
// errRelationshipReverseFKColumnUnmatched when a configured FK column has no
// corresponding introspection entry — emitting an empty parent column there
// would render as `"alias".""` and fail at execution time, so the caller
// surfaces the inconsistency at construction time and reconcile drops the
// relationship.
func buildReverseJoin(
	using metadata.RelationshipUsing,
	fkColumns []string,
	objects *introspection.Objects,
) ([]string, []string, []string, bool, error) {
	if using.ForeignKeyConstraint == nil || len(fkColumns) == 0 {
		return fkColumns, nil, nil, true, nil
	}

	targetSchema := using.ForeignKeyConstraint.Table.Schema
	targetTableName := using.ForeignKeyConstraint.Table.Name

	targetTable, ok := objects.GetTable(targetSchema, targetTableName)
	if !ok {
		return nil, nil, nil, true,
			fmt.Errorf(
				"%w: %s.%s",
				errRelationshipTargetTableIntrospectionNotFound,
				targetSchema,
				targetTableName,
			)
	}

	parentCols := make([]string, 0, len(fkColumns))
	targetCols := make([]string, 0, len(fkColumns))

	for _, col := range fkColumns {
		var matched string

		for _, fk := range targetTable.ForeignKeys {
			if fk.ColumnName == col {
				matched = fk.ForeignColumnName
				break
			}
		}

		if matched == "" {
			return nil, nil, nil, true,
				fmt.Errorf(
					"%w: %s.%s.%s",
					errRelationshipReverseFKColumnUnmatched,
					targetSchema,
					targetTableName,
					col,
				)
		}

		parentCols = append(parentCols, matched)
		targetCols = append(targetCols, col)
	}

	return fkColumns, parentCols, targetCols, true, nil
}

// getRelationshipTarget resolves the schema-qualified name of the relationship
// target table. For the forward-FK shortcut (ForeignKeyColumns) the target is
// derived from the first matching introspected FK on the parent table; all
// listed columns must agree on the same target, otherwise the function returns
// empty strings and the caller treats the relationship as misconfigured.
func getRelationshipTarget(
	using metadata.RelationshipUsing,
	parentTable *introspection.Table,
) (string, string) {
	switch {
	case len(using.ForeignKeyColumns) > 0:
		return parentTable.LookupForwardFKTarget(using.ForeignKeyColumns)
	case using.ForeignKeyConstraint != nil:
		return using.ForeignKeyConstraint.Table.Schema,
			using.ForeignKeyConstraint.Table.Name
	case using.ManualConfiguration != nil:
		return using.ManualConfiguration.RemoteTable.Schema,
			using.ManualConfiguration.RemoteTable.Name
	}

	return "", ""
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
