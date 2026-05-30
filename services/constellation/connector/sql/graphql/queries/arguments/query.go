package arguments

import (
	"fmt"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

// ParseQuery parses the where/order_by/limit/offset/distinct_on arguments of a
// collection or aggregate query. sourceRef is the qualified reference of the
// base relation being filtered/ordered (the table ref, or a function-call
// alias); relationship order_by correlates its subqueries against it. The
// function is a flat sequence of one independent block per GraphQL argument;
// that is clearer than threading shared variables/err state through
// per-argument helpers.
//
//nolint:funlen // see godoc above for rationale
func ParseQuery(
	t Table,
	arguments ast.ArgumentList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	sourceRef string,
) (where.Clause, []QueryModifier, *DistinctOn, error) {
	var (
		whereClause where.Clause
		modifiers   []QueryModifier
		dOn         *DistinctOn
		err         error
	)

	if arg := arguments.ForName("where"); arg != nil {
		whereClause, err = t.ParseWhere(
			arg.Value, variables, role, sessionVariables, 0, where.QueryAliases,
		)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("failed to parse where clause: %w", err)
		}
	}

	if arg := arguments.ForName("order_by"); arg != nil {
		items, err := ParseOrderBy(t, arg.Value, variables, role, sessionVariables, sourceRef)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("failed to parse order_by: %w", err)
		}

		modifiers = append(modifiers, &OrderBy{Items: items})
	}

	if arg := arguments.ForName("limit"); arg != nil {
		limitVal, err := ParseLimitOffset(arg.Value, variables)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("failed to parse limit: %w", err)
		}

		if limitVal != nil {
			modifiers = append(modifiers, &Limit{Value: *limitVal})
		}
	}

	if arg := arguments.ForName("offset"); arg != nil {
		offsetVal, err := ParseLimitOffset(arg.Value, variables)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("failed to parse offset: %w", err)
		}

		if offsetVal != nil {
			modifiers = append(modifiers, &Offset{Value: *offsetVal})
		}
	}

	if arg := arguments.ForName("distinct_on"); arg != nil {
		columns, err := ParseDistinctOn(t, arg.Value, variables)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("failed to parse distinct_on: %w", err)
		}

		if len(columns) > 0 {
			dOn = &DistinctOn{Columns: columns}
		}
	}

	modifiers, err = validateDistinctOnOrderBy(dOn, modifiers)
	if err != nil {
		return nil, nil, nil, err
	}

	return whereClause, modifiers, dOn, nil
}

// validateDistinctOnOrderBy enforces PostgreSQL's rule that the DISTINCT ON
// expressions must be the leading ORDER BY expressions, matching Hasura's
// behaviour exactly:
//
//   - distinct_on present, no order_by: synthesise a leading ORDER BY on the
//     distinct columns (ASC NULLS LAST, the same default the aggregate
//     json_agg ordering uses) so row selection is deterministic.
//   - distinct_on present, order_by whose leading columns are exactly the
//     distinct_on columns (same set of columns within the prefix; prefix order
//     and direction are irrelevant): allowed, left untouched — the DISTINCT ON /
//     ORDER BY already agree.
//   - distinct_on present, order_by whose leading prefix does NOT contain the
//     distinct_on columns: rejected with a *QueryValidationError wrapping
//     ErrDistinctOnOrderByMismatch, mirroring Hasura's validation-failed error.
//     Constellation does not silently reorder the ORDER BY, because that would
//     return different rows than the user's order_by requested and diverge from
//     Hasura.
//
// It is a no-op when there is no distinct_on (dOn == nil), so non-distinct
// queries and dialects without DISTINCT ON support (SQLite) are unaffected.
func validateDistinctOnOrderBy(
	dOn *DistinctOn,
	modifiers []QueryModifier,
) ([]QueryModifier, error) {
	if dOn == nil || len(dOn.Columns) == 0 {
		return modifiers, nil
	}

	orderByIdx, userItems := findOrderBy(modifiers)

	// No user order_by existed; synthesise a leading ORDER BY on the distinct
	// columns so row selection is deterministic (matching Hasura).
	if orderByIdx < 0 {
		prefix := make([]OrderByItem, len(dOn.Columns))
		for i, col := range dOn.Columns {
			prefix[i] = OrderByItem{Column: col, Direction: core.OrderAscNullsLast}
		}

		return append([]QueryModifier{&OrderBy{Items: prefix}}, modifiers...), nil
	}

	// An order_by was supplied; its leading prefix must contain exactly the
	// distinct_on columns. Prefix order and direction are irrelevant to the
	// PostgreSQL constraint and to Hasura's check; a non-distinct column before
	// the full distinct_on set is not allowed. Reject otherwise.
	if !distinctOnMatchesOrderByPrefix(dOn.Columns, userItems) {
		return nil, &QueryValidationError{
			Err:       ErrDistinctOnOrderByMismatch,
			RootField: "",
		}
	}

	return modifiers, nil
}

// distinctOnMatchesOrderByPrefix reports whether the leading order_by prefix
// contains exactly the distinct_on columns. PostgreSQL accepts the distinct_on
// expressions in any order within the leftmost ORDER BY prefix, but no
// non-distinct expression may appear before that prefix is complete.
func distinctOnMatchesOrderByPrefix(columns []string, orderBy []OrderByItem) bool {
	if len(orderBy) < len(columns) {
		return false
	}

	remaining := make(map[string]int, len(columns))
	for _, col := range columns {
		remaining[col]++
	}

	for _, item := range orderBy[:len(columns)] {
		if remaining[item.Column] == 0 {
			return false
		}

		remaining[item.Column]--
	}

	return true
}

// findOrderBy returns the index of the *OrderBy modifier in modifiers and its
// items, or (-1, nil) when no order_by was supplied.
func findOrderBy(modifiers []QueryModifier) (int, []OrderByItem) {
	for i, m := range modifiers {
		if ob, ok := m.(*OrderBy); ok {
			return i, ob.Items
		}
	}

	return -1, nil
}

// ParseLimitOffset parses a limit or offset integer argument from GraphQL.
// Accepts both IntValue and FloatValue because JSON numbers come in as floats
// by default after variable resolution.
func ParseLimitOffset(value *ast.Value, variables map[string]any) (*int, error) {
	value, err := values.ResolveVariable(value, variables)
	if err != nil {
		return nil, fmt.Errorf("resolving limit/offset: %w", err)
	}

	var intVal int

	switch value.Kind { //nolint:exhaustive
	case ast.IntValue:
		_, err := fmt.Sscanf(value.Raw, "%d", &intVal)
		if err != nil {
			return nil, fmt.Errorf("failed to parse limit value: %w", err)
		}
	case ast.FloatValue:
		var floatVal float64

		_, err := fmt.Sscanf(value.Raw, "%f", &floatVal)
		if err != nil {
			return nil, fmt.Errorf("failed to parse limit value: %w", err)
		}

		if floatVal != float64(int(floatVal)) {
			return nil, fmt.Errorf("%w: limit must be a whole number", ErrInvalidArgument)
		}

		intVal = int(floatVal)
	default:
		return nil, fmt.Errorf("%w: limit must be an integer", ErrInvalidArgument)
	}

	// Hasura rejects negative limit/offset during query parsing rather than
	// forwarding the value to the database (where Postgres raises "LIMIT must
	// not be negative" / "OFFSET must not be negative" at execution and SQLite
	// silently treats a negative LIMIT as unlimited / a negative OFFSET as 0).
	// Reject here so the request fails pre-execution with a stable validation
	// error, matching Hasura and keeping behaviour consistent across dialects.
	if intVal < 0 {
		return nil, fmt.Errorf("%w: limit/offset must be non-negative", ErrInvalidArgument)
	}

	return &intVal, nil
}

// ParseOrderBy parses an order_by argument from GraphQL. role and
// sessionVariables are threaded so relationship/aggregate ordering can apply
// the target table's row-level permissions inside its correlated subquery,
// matching Hasura.
func ParseOrderBy(
	t Table,
	value *ast.Value,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	parentSource string,
) ([]OrderByItem, error) {
	value, err := values.ResolveVariable(value, variables)
	if err != nil {
		return nil, fmt.Errorf("resolving order_by: %w", err)
	}

	gen := &orderByAliasGen{n: 0}

	if value.Kind == ast.ObjectValue {
		return appendOrderByObject(t, nil, value, parentSource, role, sessionVariables, gen)
	}

	if value.Kind != ast.ListValue {
		return nil, fmt.Errorf("%w: order_by must be a list or an object", ErrInvalidArgument)
	}

	var orderBy []OrderByItem

	for _, child := range value.Children {
		if child.Value.Kind != ast.ObjectValue {
			return nil, fmt.Errorf("%w: order_by items must be objects", ErrInvalidArgument)
		}

		orderBy, err = appendOrderByObject(
			t, orderBy, child.Value, parentSource, role, sessionVariables, gen,
		)
		if err != nil {
			return nil, err
		}
	}

	return orderBy, nil
}

// appendOrderByObject parses one order_by object and appends each entry to
// orderBy. A field is dispatched as a scalar column, an object-relationship
// ordering (`<rel>: <target>_order_by`), or an array-relationship aggregate
// ordering (`<rel>_aggregate: <target>_aggregate_order_by`). The latter two
// emit correlated-subquery ordering terms; everything else errors, matching the
// schema, which only advertises those three shapes.
func appendOrderByObject(
	t Table,
	orderBy []OrderByItem,
	value *ast.Value,
	parentSource string,
	role string,
	sessionVariables map[string]any,
	gen *orderByAliasGen,
) ([]OrderByItem, error) {
	for _, field := range value.Children {
		if column := t.ColumnFromGraphqlName(field.Name); column != nil {
			direction, err := orderByDirection(field.Value)
			if err != nil {
				return nil, err
			}

			orderBy = append(orderBy, OrderByItem{
				Column:    column.SQLName,
				term:      nil,
				Direction: direction,
			})

			continue
		}

		items, err := appendRelationshipOrderBy(
			t, field, parentSource, role, sessionVariables, gen,
		)
		if err != nil {
			return nil, err
		}

		orderBy = append(orderBy, items...)
	}

	return orderBy, nil
}

// orderByDirection resolves an order_by leaf value to a typed direction. The
// value must be an enum (asc, desc, asc_nulls_first, …).
func orderByDirection(value *ast.Value) (core.OrderDirection, error) {
	if value.Kind != ast.EnumValue {
		return core.OrderAsc, fmt.Errorf(
			"%w: order_by direction must be an enum value", ErrInvalidArgument,
		)
	}

	return convertOrderByDirection(value.Raw)
}

// convertOrderByDirection converts a GraphQL order_by enum value to its typed
// core.OrderDirection. Returning a typed value (rather than a SQL fragment
// string) keeps SQL rendering centralised in core.OrderDirection.SQL and
// prevents callers from concatenating user-controlled strings into ORDER BY.
func convertOrderByDirection(direction string) (core.OrderDirection, error) {
	switch direction {
	case "asc":
		return core.OrderAsc, nil
	case "asc_nulls_first":
		return core.OrderAscNullsFirst, nil
	case "asc_nulls_last":
		return core.OrderAscNullsLast, nil
	case "desc":
		return core.OrderDesc, nil
	case "desc_nulls_first":
		return core.OrderDescNullsFirst, nil
	case "desc_nulls_last":
		return core.OrderDescNullsLast, nil
	default:
		return core.OrderAsc, fmt.Errorf(
			"%w: unknown order_by direction %q", ErrInvalidArgument, direction,
		)
	}
}

// ParseDistinctOn parses a distinct_on argument from GraphQL.
func ParseDistinctOn(
	t Table,
	value *ast.Value,
	variables map[string]any,
) ([]string, error) {
	value, err := values.ResolveVariable(value, variables)
	if err != nil {
		return nil, fmt.Errorf("resolving distinct_on: %w", err)
	}

	// GraphQL allows passing either a single enum value or an array of enum
	// values; both are accepted as the distinct_on column set.
	if value.Kind == ast.EnumValue {
		customColName := value.Raw

		column := t.ColumnFromGraphqlName(customColName)
		if column == nil {
			return nil, fmt.Errorf(
				"%w: column %s not found in table %s",
				ErrInvalidArgument, customColName, t.TableName(),
			)
		}

		return []string{column.SQLName}, nil
	}

	if value.Kind != ast.ListValue {
		return nil, fmt.Errorf(
			"%w: distinct_on must be a list or an enum value", ErrInvalidArgument,
		)
	}

	distinctOn := make([]string, 0, len(value.Children))
	for _, child := range value.Children {
		if child.Value.Kind != ast.EnumValue {
			return nil, fmt.Errorf(
				"%w: distinct_on column names must be enum values", ErrInvalidArgument,
			)
		}

		customColName := child.Value.Raw

		column := t.ColumnFromGraphqlName(customColName)
		if column == nil {
			return nil, fmt.Errorf(
				"%w: column %s not found in table %s",
				ErrInvalidArgument, customColName, t.TableName(),
			)
		}

		distinctOn = append(distinctOn, column.SQLName)
	}

	return distinctOn, nil
}

// ParseQueryByPk parses the primary key arguments for a query_by_pk operation.
// Unlike update_by_pk which uses pk_columns, query_by_pk takes primary key
// columns as direct arguments (e.g., users_by_pk(id: "...")).
func ParseQueryByPk(
	t Table,
	field *ast.Field,
	variables map[string]any,
) (where.Clause, error) {
	return parsePkArguments(t, field.Arguments, variables)
}

// parsePkArguments builds an equality WHERE clause from primary-key columns
// provided as direct arguments. Used by both ParseQueryByPk and
// ParseDeleteByPk, which share this argument shape (unlike update_by_pk,
// which nests its PK arguments inside `pk_columns`).
func parsePkArguments(
	t Table,
	arguments ast.ArgumentList,
	variables map[string]any,
) (where.Clause, error) {
	pkColumns := t.PKColumns()
	pkConditions := make([]where.Statement, len(pkColumns))

	for i, col := range pkColumns {
		arg := arguments.ForName(col.GraphqlName)
		if arg == nil {
			return nil, fmt.Errorf(
				"%w: missing required primary key argument: %s",
				ErrInvalidArgument, col.GraphqlName,
			)
		}

		value, err := values.ResolveASTValue(arg.Value, variables)
		if err != nil {
			return nil, fmt.Errorf(
				"failed to resolve pk column %s: %w", col.GraphqlName, err,
			)
		}

		pkConditions[i] = where.NewEqualsFilter(col, value, t.Dialect())
	}

	return pkConditions, nil
}
