package arguments

import (
	"errors"
	"fmt"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

// ParseQuery parses the where/order_by/limit/offset/distinct_on arguments of a
// collection or aggregate query.
func ParseQuery(
	t Table,
	arguments ast.ArgumentList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
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
		items, err := ParseOrderBy(t, arg.Value, variables)
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

	return whereClause, modifiers, dOn, nil
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
			return nil, errors.New("limit must be a whole number")
		}

		intVal = int(floatVal)
	default:
		return nil, errors.New("limit must be an integer")
	}

	return &intVal, nil
}

// ParseOrderBy parses an order_by argument from GraphQL.
func ParseOrderBy(
	t Table,
	value *ast.Value,
	variables map[string]any,
) ([]OrderByItem, error) {
	value, err := values.ResolveVariable(value, variables)
	if err != nil {
		return nil, fmt.Errorf("resolving order_by: %w", err)
	}

	if value.Kind == ast.ObjectValue {
		return appendOrderByObject(t, nil, value)
	}

	if value.Kind != ast.ListValue {
		return nil, errors.New("order_by must be a list or an object")
	}

	var orderBy []OrderByItem
	for _, child := range value.Children {
		if child.Value.Kind != ast.ObjectValue {
			return nil, errors.New("order_by items must be objects")
		}

		orderBy, err = appendOrderByObject(t, orderBy, child.Value)
		if err != nil {
			return nil, err
		}
	}

	return orderBy, nil
}

// appendOrderByObject parses one `{column: direction, ...}` object and appends
// each entry to orderBy.
func appendOrderByObject(
	t Table,
	orderBy []OrderByItem,
	value *ast.Value,
) ([]OrderByItem, error) {
	for _, field := range value.Children {
		column := t.ColumnFromGraphqlName(field.Name)
		if column == nil {
			return nil, fmt.Errorf(
				"column %s not found in table %s", field.Name, t.TableName(),
			)
		}

		if field.Value.Kind != ast.EnumValue {
			return nil, errors.New("order_by direction must be an enum value")
		}

		direction, err := convertOrderByDirection(field.Value.Raw)
		if err != nil {
			return nil, err
		}

		orderBy = append(orderBy, OrderByItem{
			Column:    column.SQLName,
			Direction: direction,
		})
	}

	return orderBy, nil
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
		return core.OrderAsc, fmt.Errorf("unknown order_by direction %q", direction)
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
			return nil, fmt.Errorf("column %s not found in table %s", customColName, t.TableName())
		}

		return []string{column.SQLName}, nil
	}

	if value.Kind != ast.ListValue {
		return nil, errors.New("distinct_on must be a list or an enum value")
	}

	distinctOn := make([]string, 0, len(value.Children))
	for _, child := range value.Children {
		if child.Value.Kind != ast.EnumValue {
			return nil, errors.New("distinct_on column names must be enum values")
		}

		customColName := child.Value.Raw

		column := t.ColumnFromGraphqlName(customColName)
		if column == nil {
			return nil, fmt.Errorf("column %s not found in table %s", customColName, t.TableName())
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
				"missing required primary key argument: %s", col.GraphqlName)
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
