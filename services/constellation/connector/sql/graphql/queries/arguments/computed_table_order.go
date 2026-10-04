package arguments

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

type computedTableOrderTerm struct {
	call             core.ComputedTableExpression
	target           Table
	source           string
	alias            string
	aggregate        string
	role             string
	sessionVariables map[string]any
}

func (term *computedTableOrderTerm) SQLType() string { return "integer" }
func (term *computedTableOrderTerm) SourceColumns() []string {
	return term.call.SourceColumns()
}

func (term *computedTableOrderTerm) WriteExpression(
	b *strings.Builder, source string, sessionVariables map[string]any,
	params []any, paramIndex int,
) ([]any, int, error) {
	copyTerm := *term
	copyTerm.source = source
	copyTerm.sessionVariables = sessionVariables

	return copyTerm.writeExpr(b, params, paramIndex)
}

func (term *computedTableOrderTerm) writeExpr(
	b *strings.Builder, params []any, paramIndex int,
) ([]any, int, error) {
	b.WriteString("(SELECT ")
	b.WriteString(term.aggregate)
	b.WriteString(" FROM ")

	var err error

	params, paramIndex, err = term.call.WriteExpression(
		b, term.source, term.sessionVariables, params, paramIndex,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("writing computed aggregate source: %w", err)
	}

	b.WriteString(" AS ")
	b.WriteString(term.alias)

	if term.role != "" && term.target.HasRowLevelPermissions(term.role) {
		b.WriteString(" WHERE ")

		params, paramIndex, err = term.target.WriteRowLevelPermissions(
			b, params, paramIndex, term.role, term.sessionVariables, term.alias,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("writing computed aggregate permissions: %w", err)
		}
	}

	b.WriteByte(')')

	return params, paramIndex, nil
}

//nolint:funlen // Count and numeric aggregate families share one target/alias permission context.
func appendComputedTableOrderBy(
	t Table, call core.ComputedTableExpression, value *ast.Value, source, role string,
	sessionVariables map[string]any, gen *orderByAliasGen,
) ([]OrderByItem, error) {
	target := t.OrderTableBySchemaName(call.TargetSchema(), call.TargetName())
	if target == nil || value.Kind != ast.ObjectValue {
		return nil, fmt.Errorf("%w: invalid computed aggregate order", ErrInvalidArgument)
	}

	alias := gen.next()

	items := make([]OrderByItem, 0, len(value.Children))
	for _, child := range value.Children {
		if child.Name == "count" {
			direction, err := orderByDirection(child.Value)
			if err != nil {
				return nil, err
			}

			items = append(items, OrderByItem{
				Column: "", Direction: direction,
				term: &computedTableOrderTerm{
					call: call, target: target, source: source, alias: alias,
					aggregate: "COUNT(*)", role: role, sessionVariables: sessionVariables,
				},
			})

			continue
		}

		funcName, ok := aggregateOrderByFuncs[child.Name]
		if !ok || child.Value.Kind != ast.ObjectValue {
			return nil, fmt.Errorf(
				"%w: invalid aggregate order field %s",
				ErrInvalidArgument,
				child.Name,
			)
		}

		if varianceOrderByFuncs[funcName] && !target.Dialect().SupportsStableVarianceOrderBy() {
			return nil, fmt.Errorf("%w: %s", ErrUnsupportedAggregateOrderBy, funcName)
		}

		for _, col := range child.Value.Children {
			column := target.ColumnFromGraphqlName(col.Name)
			if column == nil {
				return nil, fmt.Errorf("%w: column %s not found in table %s",
					ErrInvalidArgument, col.Name, target.TableName())
			}

			direction, err := orderByDirection(col.Value)
			if err != nil {
				return nil, err
			}

			var columnExpr, aggregate strings.Builder
			core.WriteQualifiedColumn(&columnExpr, alias, column.SQLName)
			target.Dialect().WriteAggregateOrderByExpr(&aggregate, funcName, columnExpr.String())
			items = append(items, OrderByItem{
				Column: "", Direction: direction,
				term: &computedTableOrderTerm{
					call: call, target: target, source: source, alias: alias,
					aggregate: aggregate.String(), role: role, sessionVariables: sessionVariables,
				},
			})
		}
	}

	return items, nil
}
