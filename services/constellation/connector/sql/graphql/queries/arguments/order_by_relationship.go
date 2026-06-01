package arguments

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

// orderByAliasGen hands out unique, quoted subquery aliases for relationship
// and aggregate ordering terms within a single order_by parse. A distinctive
// prefix avoids shadowing real table names in the correlated subqueries.
type orderByAliasGen struct {
	n int
}

func (g *orderByAliasGen) next() string {
	alias := fmt.Sprintf("_cs_ob%d", g.n)
	g.n++

	return core.QuoteIdentifier(alias)
}

// appendRelationshipOrderBy dispatches a non-scalar order_by field to either
// object-relationship ordering (`<rel>: <target>_order_by`) or array-relationship
// aggregate ordering (`<rel>_aggregate: <target>_aggregate_order_by`).
func appendRelationshipOrderBy(
	t Table,
	field *ast.ChildValue,
	parentSource string,
	role string,
	sessionVariables map[string]any,
	gen *orderByAliasGen,
) ([]OrderByItem, error) {
	rel := t.Relationship(field.Name)
	if rel == nil {
		return nil, fmt.Errorf(
			"%w: column %s not found in table %s",
			ErrInvalidArgument, field.Name, t.TableName(),
		)
	}

	if field.Value.Kind != ast.ObjectValue {
		return nil, fmt.Errorf(
			"%w: order_by on relationship %s must be an object", ErrInvalidArgument, field.Name,
		)
	}

	target := rel.TargetTable()
	if target == nil {
		return nil, fmt.Errorf(
			"%w: relationship %s has no local target table", ErrInvalidArgument, field.Name,
		)
	}

	// Object relationship: order by columns of the single related row.
	if field.Name == rel.Name() && !rel.IsArray() {
		return buildRelationshipOrderItems(
			rel, target, field.Value, parentSource, role, sessionVariables, gen,
		)
	}

	// Array-relationship aggregate: order by an aggregate over the related rows.
	if field.Name == rel.AggregateName() && rel.IsArray() {
		return buildAggregateOrderItems(
			rel, target, field.Value, parentSource, role, sessionVariables, gen,
		)
	}

	return nil, fmt.Errorf(
		"%w: %s is not an orderable relationship of table %s",
		ErrInvalidArgument, field.Name, t.TableName(),
	)
}

// buildRelationshipOrderItems builds ordering terms for an object relationship.
// Each leaf column produces one ORDER BY term rendering a correlated scalar
// subquery; nested object relationships and aggregates recurse, wrapping the
// inner expression in this relationship's subquery.
func buildRelationshipOrderItems(
	rel Relationship,
	target Table,
	value *ast.Value,
	parentSource string,
	role string,
	sessionVariables map[string]any,
	gen *orderByAliasGen,
) ([]OrderByItem, error) {
	alias := gen.next()

	var items []OrderByItem

	for _, child := range value.Children {
		if column := target.ColumnFromGraphqlName(child.Name); column != nil {
			direction, err := orderByDirection(child.Value)
			if err != nil {
				return nil, err
			}

			items = append(items, OrderByItem{
				Column: "",
				term: newRelationshipOrderTerm(
					rel, target, parentSource, alias,
					&columnOrderExpr{qualifier: alias, column: column.SQLName},
					role, sessionVariables,
				),
				Direction: direction,
			})

			continue
		}

		nested, err := buildNestedRelationshipOrderItems(
			target, child, alias, role, sessionVariables, gen,
		)
		if err != nil {
			return nil, err
		}

		for _, ni := range nested {
			items = append(items, OrderByItem{
				Column: "",
				term: newRelationshipOrderTerm(
					rel, target, parentSource, alias, ni.term, role, sessionVariables,
				),
				Direction: ni.Direction,
			})
		}
	}

	return items, nil
}

// buildNestedRelationshipOrderItems handles a relationship or aggregate nested
// inside an object-relationship order_by, returning items whose term renders the
// inner subquery correlated with the enclosing relationship's alias.
func buildNestedRelationshipOrderItems(
	target Table,
	child *ast.ChildValue,
	parentAlias string,
	role string,
	sessionVariables map[string]any,
	gen *orderByAliasGen,
) ([]OrderByItem, error) {
	childRel := target.Relationship(child.Name)
	if childRel == nil || child.Value.Kind != ast.ObjectValue {
		return nil, fmt.Errorf(
			"%w: %s is not an orderable field of table %s",
			ErrInvalidArgument, child.Name, target.TableName(),
		)
	}

	childTarget := childRel.TargetTable()
	if childTarget == nil {
		return nil, fmt.Errorf(
			"%w: relationship %s has no local target table", ErrInvalidArgument, child.Name,
		)
	}

	if child.Name == childRel.Name() && !childRel.IsArray() {
		return buildRelationshipOrderItems(
			childRel, childTarget, child.Value, parentAlias, role, sessionVariables, gen,
		)
	}

	if child.Name == childRel.AggregateName() && childRel.IsArray() {
		return buildAggregateOrderItems(
			childRel, childTarget, child.Value, parentAlias, role, sessionVariables, gen,
		)
	}

	return nil, fmt.Errorf(
		"%w: %s is not an orderable relationship of table %s",
		ErrInvalidArgument, child.Name, target.TableName(),
	)
}

// buildAggregateOrderItems builds ordering terms for an array-relationship
// aggregate order_by ({count: dir, max: {col: dir}, avg: {col: dir}, …}). Each
// entry produces one ORDER BY term rendering a correlated aggregate subquery.
func buildAggregateOrderItems(
	rel Relationship,
	target Table,
	value *ast.Value,
	parentSource string,
	role string,
	sessionVariables map[string]any,
	gen *orderByAliasGen,
) ([]OrderByItem, error) {
	alias := gen.next()

	var items []OrderByItem

	for _, child := range value.Children {
		if child.Name == "count" {
			direction, err := orderByDirection(child.Value)
			if err != nil {
				return nil, err
			}

			items = append(items, OrderByItem{
				Column: "",
				term: newAggregateOrderTerm(
					rel,
					target,
					parentSource,
					alias,
					"COUNT(*)",
					role,
					sessionVariables,
				),
				Direction: direction,
			})

			continue
		}

		funcName, ok := aggregateOrderByFuncs[child.Name]
		if !ok {
			return nil, fmt.Errorf(
				"%w: unknown aggregate order_by field %s", ErrInvalidArgument, child.Name,
			)
		}

		columnItems, err := buildAggregateColumnOrderItems(
			rel, target, parentSource, alias, funcName, child.Value, role, sessionVariables,
		)
		if err != nil {
			return nil, err
		}

		items = append(items, columnItems...)
	}

	return items, nil
}

// buildAggregateColumnOrderItems handles the per-column aggregate order_by
// objects (max/min/avg/sum/stddev/…): {col: dir, …} → one term per column
// rendering <func>(<alias>.<col>).
func buildAggregateColumnOrderItems(
	rel Relationship,
	target Table,
	parentSource string,
	alias string,
	funcName string,
	value *ast.Value,
	role string,
	sessionVariables map[string]any,
) ([]OrderByItem, error) {
	if value.Kind != ast.ObjectValue {
		return nil, fmt.Errorf(
			"%w: aggregate order_by %s must be an object", ErrInvalidArgument, funcName,
		)
	}

	if varianceOrderByFuncs[funcName] && !target.Dialect().SupportsStableVarianceOrderBy() {
		return nil, fmt.Errorf(
			"%w: %s ordering is not supported on this database backend",
			ErrUnsupportedAggregateOrderBy, funcName,
		)
	}

	var items []OrderByItem

	for _, child := range value.Children {
		column := target.ColumnFromGraphqlName(child.Name)
		if column == nil {
			return nil, fmt.Errorf(
				"%w: column %s not found in table %s",
				ErrInvalidArgument, child.Name, target.TableName(),
			)
		}

		direction, err := orderByDirection(child.Value)
		if err != nil {
			return nil, err
		}

		var columnExpr strings.Builder
		core.WriteQualifiedColumn(&columnExpr, alias, column.SQLName)

		var expr strings.Builder
		target.Dialect().WriteAggregateOrderByExpr(&expr, funcName, columnExpr.String())

		items = append(items, OrderByItem{
			Column: "",
			term: newAggregateOrderTerm(
				rel, target, parentSource, alias, expr.String(), role, sessionVariables,
			),
			Direction: direction,
		})
	}

	return items, nil
}

// aggregateOrderByFuncs is the closed set of aggregate order_by object keys.
// count is handled separately (COUNT(*)). bool_and/bool_or are intentionally
// absent — Hasura does not expose them in aggregate order_by. The values are
// GraphQL function names passed to the dialect, which renders backend-specific
// SQL for functions such as stddev/variance.
//
//nolint:gochecknoglobals // immutable lookup table.
var aggregateOrderByFuncs = map[string]string{
	"avg":         "avg",
	"max":         "max",
	"min":         "min",
	"sum":         "sum",
	"stddev":      "stddev",
	"stddev_pop":  "stddev_pop",
	"stddev_samp": "stddev_samp",
	"var_pop":     "var_pop",
	"var_samp":    "var_samp",
	"variance":    "variance",
}

// varianceOrderByFuncs is the subset of aggregateOrderByFuncs whose result is
// only well-defined for ordering on backends with native, numerically stable
// stddev/variance aggregates. Backends without them (SQLite) gate these via
// dialect.SupportsStableVarianceOrderBy and the ordering is rejected.
//
//nolint:gochecknoglobals // immutable lookup table.
var varianceOrderByFuncs = map[string]bool{
	"stddev":      true,
	"stddev_pop":  true,
	"stddev_samp": true,
	"var_pop":     true,
	"var_samp":    true,
	"variance":    true,
}

// columnOrderExpr is the innermost expression of a relationship ordering
// subquery: a qualified column reference. It appends no params.
type columnOrderExpr struct {
	qualifier string
	column    string
}

func (c *columnOrderExpr) writeExpr(
	b *strings.Builder, params []any, paramIndex int,
) ([]any, int, error) {
	core.WriteQualifiedColumn(b, c.qualifier, c.column)

	return params, paramIndex, nil
}

// relationshipOrderTerm renders an object-relationship ordering as a correlated
// scalar subquery: (SELECT <inner> FROM <target> <alias> WHERE <join>
// [AND <perms>] LIMIT 1). inner is a column reference, a nested relationship
// term, or a nested aggregate term.
type relationshipOrderTerm struct {
	rel              Relationship
	target           Table
	parentSource     string
	alias            string
	inner            orderByTerm
	role             string
	sessionVariables map[string]any
}

func newRelationshipOrderTerm( //nolint:ireturn,nolintlint
	rel Relationship,
	target Table,
	parentSource string,
	alias string,
	inner orderByTerm,
	role string,
	sessionVariables map[string]any,
) orderByTerm {
	return &relationshipOrderTerm{
		rel:              rel,
		target:           target,
		parentSource:     parentSource,
		alias:            alias,
		inner:            inner,
		role:             role,
		sessionVariables: sessionVariables,
	}
}

func (term *relationshipOrderTerm) writeExpr(
	b *strings.Builder, params []any, paramIndex int,
) ([]any, int, error) {
	b.WriteString("(SELECT ")

	var err error

	params, paramIndex, err = term.inner.writeExpr(b, params, paramIndex)
	if err != nil {
		return nil, 0, err
	}

	b.WriteString(" FROM ")
	b.WriteString(term.target.TableFromClause())
	b.WriteByte(' ')
	b.WriteString(term.alias)
	b.WriteString(" WHERE ")
	term.rel.WriteJoinConditionAliased(b, term.parentSource, term.alias)

	params, paramIndex, err = writeOrderByPerms(
		b, term.target, term.role, term.sessionVariables, term.alias, params, paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	b.WriteString(" LIMIT 1)")

	return params, paramIndex, nil
}

// aggregateOrderTerm renders an array-relationship aggregate ordering as a
// correlated aggregate subquery: (SELECT <aggExpr> FROM <target> <alias>
// WHERE <join> [AND <perms>]). No LIMIT — a scalar aggregate yields one row.
type aggregateOrderTerm struct {
	rel              Relationship
	target           Table
	parentSource     string
	alias            string
	aggExpr          string
	role             string
	sessionVariables map[string]any
}

func newAggregateOrderTerm( //nolint:ireturn,nolintlint
	rel Relationship,
	target Table,
	parentSource string,
	alias string,
	aggExpr string,
	role string,
	sessionVariables map[string]any,
) orderByTerm {
	return &aggregateOrderTerm{
		rel:              rel,
		target:           target,
		parentSource:     parentSource,
		alias:            alias,
		aggExpr:          aggExpr,
		role:             role,
		sessionVariables: sessionVariables,
	}
}

func (term *aggregateOrderTerm) writeExpr(
	b *strings.Builder, params []any, paramIndex int,
) ([]any, int, error) {
	b.WriteString("(SELECT ")
	b.WriteString(term.aggExpr)
	b.WriteString(" FROM ")
	b.WriteString(term.target.TableFromClause())
	b.WriteByte(' ')
	b.WriteString(term.alias)
	b.WriteString(" WHERE ")
	term.rel.WriteJoinConditionAliased(b, term.parentSource, term.alias)

	params, paramIndex, err := writeOrderByPerms(
		b, term.target, term.role, term.sessionVariables, term.alias, params, paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	b.WriteByte(')')

	return params, paramIndex, nil
}

// writeOrderByPerms appends ` AND <row-level-permissions>` for the target table
// when the role has any, so a relationship/aggregate ordering only considers
// rows the role may see — matching how Hasura applies select permissions when
// traversing relationships in order_by.
func writeOrderByPerms(
	b *strings.Builder,
	target Table,
	role string,
	sessionVariables map[string]any,
	alias string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	if role == "" || !target.HasRowLevelPermissions(role) {
		return params, paramIndex, nil
	}

	b.WriteString(" AND ")

	params, paramIndex, err := target.WriteRowLevelPermissions(
		b, params, paramIndex, role, sessionVariables, alias,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to apply order_by row-level permissions: %w", err)
	}

	return params, paramIndex, nil
}
