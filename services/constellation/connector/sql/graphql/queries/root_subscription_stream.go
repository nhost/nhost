package queries

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/multiplexed"
)

// buildSubscriptionStreamSQL builds multiplexed SQL for a streaming subscription.
// Stream subscriptions return rows in batches based on cursor position.
// Returns SQLOperation with SQL containing the ready-to-use multiplexed query.
//
// The cursor values are stored in result_vars (not as static parameters) so the
// subscription manager can update them between polls. The SQLOperation includes
// streamCursors metadata for the subscription manager to:
// 1. Initialize result_vars with initial cursor values under the "cursor" key
// 2. Extract new cursor values from results after each poll
// 3. Update result_vars for subsequent polls.
func (t *table) buildSubscriptionStreamSQL(
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
) (core.SQLOperation, error) {
	alias := field.Alias
	if alias == "" {
		alias = field.Name
	}

	// Parse stream-specific arguments
	streamArgs, err := arguments.ParseStream(t, field.Arguments, variables, role, sessionVariables)
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf("failed to parse stream arguments: %w", err)
	}

	b := getBuilder()

	// Build the query with stream-specific modifiers
	params, _, err := t.buildQueryStreamSQL(
		b,
		field,
		fragments,
		variables,
		role,
		sessionVariables,
		roots,
		[]any{},
		1,
		"_root",
		"_root",
		rootFieldName(field),
		streamArgs,
	)
	if err != nil {
		putBuilder(b)
		return core.SQLOperation{}, fmt.Errorf("failed to build stream SQL: %w", err)
	}

	sql := b.String()
	putBuilder(b)

	op := core.SQLOperation{
		Name:          alias,
		SQL:           sql,
		Parameters:    params,
		StreamCursors: streamCursorInfos(streamArgs.Cursors),
		Sequential:    nil,
	}

	// Convert to multiplexed and build final SQL
	op.SQL, op.Parameters, err = multiplexed.Multiplex(op)
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf(
			"failed to multiplex stream subscription SQL: %w",
			err,
		)
	}

	return op, nil
}

// streamCursorInfos converts parsed stream cursors into the StreamCursorInfo
// metadata the subscription manager uses to seed and advance result_vars
// between polls.
func streamCursorInfos(cursors []arguments.StreamCursor) []core.StreamCursorInfo {
	infos := make([]core.StreamCursorInfo, len(cursors))
	for i, cursor := range cursors {
		infos[i] = core.StreamCursorInfo{
			ColumnName:   cursor.Column.SQLName,
			GraphQLName:  cursor.Column.GraphqlName,
			InitialValue: cursor.Value,
			Ordering:     cursor.Ordering,
		}
	}

	return infos
}

// buildQueryStreamSQL builds the inner SQL for a stream query.
func (t *table) buildQueryStreamSQL(
	b *strings.Builder,
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	params []any,
	paramIndex int,
	alias string,
	relName string,
	argumentPath string,
	streamArgs arguments.Stream,
) ([]any, int, error) {
	// Outer aggregation: SELECT coalesce(json_agg("alias"), '[]') AS "relName" FROM (
	b.WriteString("SELECT ")
	b.WriteString(t.dialect.CoalesceJSONArray(alias))
	b.WriteString(` AS "`)
	b.WriteString(relName)
	b.WriteString(`" FROM (`)

	params, paramIndex, err := t.buildStreamQuerySQL(
		b,
		field,
		fragments,
		variables,
		role,
		sessionVariables,
		roots,
		params,
		paramIndex,
		alias,
		alias,
		t.tableFromClause(),
		t.tableSourceRef(),
		argumentPath,
		streamArgs,
	)
	if err != nil {
		return nil, 0, err
	}

	// Close outer wrapper: ) AS "alias"
	b.WriteString(`) AS "`)
	b.WriteString(alias)
	b.WriteByte('"')

	return params, paramIndex, nil
}

// buildStreamQuerySQL is the core SQL generation logic for stream queries.
func (t *table) buildStreamQuerySQL( //nolint:cyclop,funlen,gocognit,gocyclo,maintidx
	b *strings.Builder,
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
	params []any,
	paramIndex int,
	alias string,
	outputAlias string,
	fromClause string,
	sourceRef string,
	argumentPath string,
	streamArgs arguments.Stream,
) ([]any, int, error) {
	// Note: Remote relationships are not supported in subscriptions and are ignored
	columns, relationships, err := t.astToQuerySelection(field, fragments)
	if err != nil {
		return nil, 0, err
	}

	baseAlias := alias + ".base"

	b.WriteString(`WITH "`)
	b.WriteString(baseAlias)
	b.WriteString(`" AS (SELECT `)
	b.WriteString("* FROM ")
	b.WriteString(fromClause)

	// Build WHERE clause combining user where, cursor conditions, and row-level permissions
	hasWhere := false

	// Add cursor conditions (cursorValue params will be converted to result_vars references)
	if len(streamArgs.Cursors) > 0 {
		b.WriteString(" WHERE ")

		hasWhere = true

		params, paramIndex = t.writeCursorConditions(b, streamArgs.Cursors, params, paramIndex)
	}

	// Add user WHERE clause
	if len(streamArgs.Where) > 0 {
		if hasWhere {
			b.WriteString(" AND ")
		} else {
			b.WriteString(" WHERE ")

			hasWhere = true
		}

		params, paramIndex, err = streamArgs.Where.WriteCondition(
			b, sourceRef, params, paramIndex,
		)
		if err != nil {
			return nil, 0, fmt.Errorf(
				"error building where clause for table %s: %w",
				t.tableName,
				err,
			)
		}
	}

	// Add row-level permissions
	if t.hasRowLevelPermissions(role) {
		if hasWhere {
			b.WriteString(" AND ")
		} else {
			b.WriteString(" WHERE ")
		}

		params, paramIndex, err = t.writeRowLevelPermissions(
			b, params, paramIndex, role, sessionVariables, sourceRef,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("error building row level permissions: %w", err)
		}
	}

	// Add ORDER BY based on cursor columns
	if len(streamArgs.Cursors) > 0 {
		b.WriteString(" ORDER BY ")

		for i, cursor := range streamArgs.Cursors {
			if i > 0 {
				b.WriteString(", ")
			}

			core.WriteQuotedIdentifier(b, cursor.Column.SQLName)
			b.WriteByte(' ')
			b.WriteString(cursor.Ordering.SQL())
		}
	}

	// Add LIMIT based on batch_size. The parser enforces BatchSize > 0; this
	// guard catches programmatic constructions that bypassed ParseStream.
	if streamArgs.BatchSize <= 0 {
		return nil, 0, fmt.Errorf(
			"%w, got %d", errStreamBatchSizeMustBePositive, streamArgs.BatchSize,
		)
	}

	b.WriteString(" LIMIT ")
	b.WriteString(strconv.Itoa(streamArgs.BatchSize))

	b.WriteString(") ")

	// Build JSON row: SELECT row_to_json/json_object(...) AS "outputAlias"
	b.WriteString("SELECT ")
	t.dialect.WriteJSONRowPrefix(b)

	// Build column selections
	first := true

	for _, colSel := range columns {
		if !first {
			b.WriteString(", ")
		}

		if colSel.literal != "" {
			t.dialect.WriteJSONRowColumn(b, colSel.alias, "'"+colSel.literal+"'")
		} else {
			t.dialect.WriteJSONRowColumn(b, colSel.alias,
				core.QuoteIdentifier(baseAlias)+"."+core.QuoteIdentifier(colSel.column.SQLName))
		}

		first = false
	}

	if t.dialect.SupportsLateral() {
		// PostgreSQL: reference LATERAL aliases in the row
		for _, relSel := range relationships {
			if !first {
				b.WriteString(", ")
			}

			relAlias := alias + ".r." + relSel.alias
			t.dialect.WriteJSONRowColumn(b, relSel.alias,
				`"`+relAlias+`"."`+relSel.alias+`"`)

			first = false
		}
	}

	// Add cursor columns to the output for cursor advancement (if not already selected)
	for _, cursor := range streamArgs.Cursors {
		alreadySelected := false
		for _, colSel := range columns {
			if colSel.column != nil && colSel.column.SQLName == cursor.Column.SQLName {
				alreadySelected = true
				break
			}
		}

		if alreadySelected {
			continue
		}

		if !first {
			b.WriteString(", ")
		}

		t.dialect.WriteJSONRowColumn(b, cursor.Column.GraphqlName,
			core.QuoteIdentifier(baseAlias)+"."+core.QuoteIdentifier(cursor.Column.SQLName))

		first = false
	}

	if t.dialect.SupportsLateral() {
		t.dialect.WriteJSONRowSuffix(b, outputAlias)

		// FROM clause
		b.WriteString(` FROM "`)
		b.WriteString(baseAlias)
		b.WriteByte('"')

		// LEFT OUTER JOIN LATERAL for each nested relationship
		for _, relSel := range relationships {
			relAlias := alias + ".r." + relSel.alias

			b.WriteString(" LEFT OUTER JOIN LATERAL (")

			params, paramIndex, err = relSel.relationship.buildSelectionSQL(
				b, relSel.field, fragments, variables, role, sessionVariables,
				roots, params, paramIndex, baseAlias, relAlias, argumentPath,
			)
			if err != nil {
				return nil, 0, fmt.Errorf("error building relationship %s: %w", relSel.alias, err)
			}

			b.WriteString(`) AS "`)
			b.WriteString(relAlias)
			b.WriteString(`" ON ('true')`)
		}
	} else {
		// SQLite: embed relationships as correlated subqueries
		for _, relSel := range relationships {
			if !first {
				b.WriteString(", ")
			}

			relAlias := alias + ".r." + relSel.alias

			b.WriteByte('\'')
			b.WriteString(relSel.alias)
			b.WriteString("', (")

			params, paramIndex, err = relSel.relationship.buildSelectionSQL(
				b, relSel.field, fragments, variables, role, sessionVariables,
				roots, params, paramIndex, baseAlias, relAlias, argumentPath,
			)
			if err != nil {
				return nil, 0, fmt.Errorf("error building relationship %s: %w", relSel.alias, err)
			}

			b.WriteString(")")

			first = false
		}

		t.dialect.WriteJSONRowSuffix(b, outputAlias)

		// FROM clause
		b.WriteString(` FROM "`)
		b.WriteString(baseAlias)
		b.WriteByte('"')
	}

	return params, paramIndex, nil
}

// writeCursorConditions writes the WHERE conditions for cursor-based streaming.
// For ASC ordering: column > value
// For DESC ordering: column < value
//
// Cursor values are added as core.CursorValue parameters. multiplexed.Multiplex
// recognizes these and rewrites them to result_vars references, allowing the
// subscription manager to update cursor values between polls.
func (t *table) writeCursorConditions(
	b *strings.Builder,
	cursors []arguments.StreamCursor,
	params []any,
	paramIndex int,
) ([]any, int) {
	b.WriteString("(")

	for i, cursor := range cursors {
		if i > 0 {
			b.WriteString(" AND ")
		}

		operator := ">"
		if cursor.Ordering.IsDescending() {
			operator = "<"
		}

		// Add cursor value as a core.CursorValue parameter
		// multiplexed.Multiplex will rewrite this to reference result_vars
		ph := t.dialect.Placeholder(paramIndex)

		core.WriteQuotedIdentifier(b, cursor.Column.SQLName)
		b.WriteByte(' ')
		b.WriteString(operator)
		b.WriteByte(' ')
		b.WriteString(t.dialect.TypeCast(ph, cursor.Column.SQLType))

		params = append(params, core.CursorValue{
			ColumnName: cursor.Column.SQLName,
			Value:      cursor.Value,
		})
		paramIndex++
	}

	b.WriteString(")")

	return params, paramIndex
}
