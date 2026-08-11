package where

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
)

// aggResultColumn is the alias of the computed aggregate inside the correlated
// subquery. The predicate comparison resolves against this synthetic column.
const aggResultColumn = "__cs_agg"

// aggregateFuncKind selects which aggregate the predicate compares against.
type aggregateFuncKind int

const (
	aggFuncCount aggregateFuncKind = iota
	aggFuncBoolAnd
	aggFuncBoolOr
)

// parseAggregateRelationshipPredicate parses a `<rel>_aggregate` value (a
// `<target>_aggregate_bool_exp`) into a Statement. Each of count/bool_and/
// bool_or present contributes one correlated-subquery predicate; multiple
// fields are AND-ed, matching Hasura's combination of aggregate bool_exp fields.
//
// This must be dispatched ahead of the plain relationship filter: the
// `<rel>_aggregate` key resolves to the same relationship as `<rel>`, so without
// the explicit branch the predicate body (count/bool_and/bool_or) would be
// parsed as ordinary target-table fields and rejected — or, worse, silently
// degrade into a plain EXISTS join.
func parseAggregateRelationshipPredicate( //nolint:ireturn,nolintlint
	rel Relationship,
	value *ast.Value,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	nestingLevel int,
	aliases Aliases,
) (Statement, error) {
	if !rel.IsArray() {
		return nil, fmt.Errorf("%w: %s", errAggregateOnNonArrayRelationship, rel.AggregateName())
	}

	target := rel.Target()
	if target == nil {
		return nil, fmt.Errorf("%w: %s", errAggregateRelationshipNoTarget, rel.AggregateName())
	}

	resolved, err := values.ResolveVariable(value, variables)
	if err != nil {
		return nil, fmt.Errorf("resolving aggregate bool_exp: %w", err)
	}

	if resolved.Kind != ast.ObjectValue {
		return nil, fmt.Errorf("%w: got %v", errExpectedObjectValue, resolved.Kind)
	}

	conditions := make(Clause, 0, len(resolved.Children))

	for _, child := range resolved.Children {
		kind, err := aggregateFuncKindFromName(child.Name)
		if err != nil {
			return nil, err
		}

		stmt, err := parseAggregatePredicateBody(
			rel, target, kind, child.Value,
			variables, role, sessionVariables, nestingLevel, aliases,
		)
		if err != nil {
			return nil, err
		}

		conditions = append(conditions, stmt)
	}

	switch len(conditions) {
	case 0:
		// An empty aggregate bool_exp imposes no constraint, like an empty
		// bool_exp; emit the always-true constant rather than a degenerate EXISTS.
		return boolConstant(true), nil
	case 1:
		return conditions[0], nil
	default:
		return &andFilter{conditions: conditions}, nil
	}
}

func aggregateFuncKindFromName(name string) (aggregateFuncKind, error) {
	switch name {
	case "count":
		return aggFuncCount, nil
	case "bool_and":
		return aggFuncBoolAnd, nil
	case "bool_or":
		return aggFuncBoolOr, nil
	default:
		return 0, fmt.Errorf("%w: %s", errUnknownAggregatePredicate, name)
	}
}

// aggregatePredicateBody holds the raw fields of a count/bool_and/bool_or
// predicate body before they are resolved against the target table.
type aggregatePredicateBody struct {
	argsValue      *ast.Value
	distinct       bool
	filterValue    *ast.Value
	predicateValue *ast.Value
}

// extractAggregatePredicateBody reads the {arguments, distinct, filter,
// predicate} fields off a resolved predicate-body object, resolving the
// distinct boolean (which may be a variable).
func extractAggregatePredicateBody(
	resolved *ast.Value,
	variables map[string]any,
) (aggregatePredicateBody, error) {
	var body aggregatePredicateBody

	for _, child := range resolved.Children {
		switch child.Name {
		case "arguments":
			body.argsValue = child.Value
		case "distinct":
			distinctVal, err := values.ResolveASTValue(child.Value, variables)
			if err != nil {
				return body, fmt.Errorf("resolving aggregate distinct: %w", err)
			}

			if b, ok := distinctVal.(bool); ok {
				body.distinct = b
			}
		case "filter":
			body.filterValue = child.Value
		case "predicate":
			body.predicateValue = child.Value
		}
	}

	return body, nil
}

// parseAggregatePredicateBody parses one count/bool_and/bool_or predicate body
// ({arguments, distinct, filter, predicate}) into an aggregateRelationshipFilter.
func parseAggregatePredicateBody( //nolint:funlen,ireturn,nolintlint
	rel Relationship,
	target Table,
	kind aggregateFuncKind,
	value *ast.Value,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	nestingLevel int,
	aliases Aliases,
) (Statement, error) {
	resolved, err := values.ResolveVariable(value, variables)
	if err != nil {
		return nil, fmt.Errorf("resolving aggregate predicate body: %w", err)
	}

	if resolved.Kind != ast.ObjectValue {
		return nil, fmt.Errorf("%w: got %v", errExpectedObjectValue, resolved.Kind)
	}

	body, err := extractAggregatePredicateBody(resolved, variables)
	if err != nil {
		return nil, err
	}

	if body.predicateValue == nil {
		return nil, errAggregatePredicateRequired
	}

	columns, err := resolveAggregateArgumentColumns(target, body.argsValue, variables)
	if err != nil {
		return nil, err
	}

	// count may scope over zero or more columns; bool_and/bool_or operate on a
	// single boolean column.
	if kind != aggFuncCount && len(columns) != 1 {
		return nil, fmt.Errorf(
			"%w: bool_and/bool_or require exactly one column", errInvalidAggregateArguments,
		)
	}

	predicate, err := parseAggregatePredicateComparison(
		target, kind, body.predicateValue, variables,
	)
	if err != nil {
		return nil, err
	}

	filter, err := parseAggregateFilter(
		target, body.filterValue, variables, role, sessionVariables, nestingLevel, aliases,
	)
	if err != nil {
		return nil, err
	}

	return &aggregateRelationshipFilter{
		relationship:     rel,
		target:           target,
		kind:             kind,
		columns:          columns,
		distinct:         body.distinct,
		boolAggFunc:      boolAggFunc(target, kind),
		predicate:        predicate,
		filter:           filter,
		role:             role,
		sessionVariables: sessionVariables,
		nestingLevel:     nestingLevel,
		aliasPrefix:      aliases.Relationship,
	}, nil
}

// boolAggFunc returns the dialect aggregate function for bool_and/bool_or, or ""
// for count (which renders count(...) directly).
func boolAggFunc(target Table, kind aggregateFuncKind) string {
	switch kind {
	case aggFuncBoolAnd:
		return target.Dialect().BoolAndFunc()
	case aggFuncBoolOr:
		return target.Dialect().BoolOrFunc()
	case aggFuncCount:
		return ""
	default:
		return ""
	}
}

// parseAggregatePredicateComparison parses the `predicate` operator object
// (Int_comparison_exp for count, Boolean_comparison_exp for bool_and/bool_or)
// against a synthetic column whose SQL name is the subquery's aggregate alias.
// Reusing ParseFieldComparison keeps operator handling and parameterisation
// centralised: the comparison renders `<subAlias>."__cs_agg" <op> $n`.
//
// A whole-predicate variable (`predicate: $p`) is resolved here before
// ParseFieldComparison sees it: the schema types `predicate` as a non-null
// comparison input object, so a variable bound to that input object is valid
// GraphQL, exactly as parseLogicalAnd/parseLogicalOr resolve a whole-argument
// _and/_or variable. ParseFieldComparison itself only resolves variables inside
// operator values, and it is shared with permission filters, so the resolution
// stays at this boundary rather than broadening that shared contract. A literal
// predicate object is returned unchanged by ResolveVariable, so non-variable
// predicates parse exactly as before.
func parseAggregatePredicateComparison( //nolint:ireturn,nolintlint
	target Table,
	kind aggregateFuncKind,
	predicateValue *ast.Value,
	variables map[string]any,
) (Statement, error) {
	resultType := "integer"
	if kind != aggFuncCount {
		resultType = "boolean"
	}

	syntheticCol := &core.Column{
		SQLName:     aggResultColumn,
		GraphqlName: aggResultColumn,
		SQLType:     resultType,
		IsArray:     false,
		IsGenerated: false,
		IsIdentity:  false,
		HasDefault:  false,
		DefaultExpr: "",
	}

	resolved, err := values.ResolveVariable(predicateValue, variables)
	if err != nil {
		return nil, fmt.Errorf("resolving aggregate predicate: %w", err)
	}

	predicate, err := ParseFieldComparison(target, syntheticCol, resolved, variables)
	if err != nil {
		return nil, fmt.Errorf("parsing aggregate predicate: %w", err)
	}

	if predicate == nil {
		return nil, errAggregatePredicateRequired
	}

	return predicate, nil
}

// parseAggregateFilter parses the optional `filter` (a `<target>_bool_exp`)
// against the target table. It recurses through parseBoolExp at the next
// nesting level so any relationship traversals inside the filter get fresh
// aliases. A nil/empty filter yields a nil Statement (no AND fragment emitted).
func parseAggregateFilter( //nolint:ireturn,nolintlint
	target Table,
	filterValue *ast.Value,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	nestingLevel int,
	aliases Aliases,
) (Statement, error) {
	if filterValue == nil {
		return nil, nil //nolint:nilnil
	}

	filterClause, err := parseBoolExp(
		target, filterValue, variables, role, sessionVariables, nestingLevel+1, aliases,
	)
	if err != nil {
		return nil, fmt.Errorf("parsing aggregate filter: %w", err)
	}

	if len(filterClause) == 0 {
		return nil, nil //nolint:nilnil
	}

	return filterClause, nil
}

// resolveAggregateArgumentColumns normalises the `arguments` value (a list of
// column-enum names for count, a single enum for bool_and/bool_or, possibly via
// a variable, or absent) into resolved target columns, rejecting any name that
// is not a column of the target table.
func resolveAggregateArgumentColumns(
	target Table,
	argsValue *ast.Value,
	variables map[string]any,
) ([]*core.Column, error) {
	if argsValue == nil {
		return nil, nil
	}

	raw, err := values.ResolveASTValue(argsValue, variables)
	if err != nil {
		return nil, fmt.Errorf("resolving aggregate arguments: %w", err)
	}

	if raw == nil {
		return nil, nil
	}

	var names []string

	switch v := raw.(type) {
	case []any:
		names = make([]string, 0, len(v))

		for _, elem := range v {
			name, ok := elem.(string)
			if !ok {
				return nil, errAggregateArgumentsMustBeNames
			}

			names = append(names, name)
		}
	case string:
		names = []string{v}
	default:
		return nil, errAggregateArgumentsMustBeNames
	}

	columns := make([]*core.Column, 0, len(names))

	for _, name := range names {
		col := target.ColumnFromGraphqlName(name)
		if col == nil {
			return nil, fmt.Errorf("%w: %s", errUnknownAggregateFilterColumn, name)
		}

		columns = append(columns, col)
	}

	return columns, nil
}

// aggregateRelationshipFilter renders an aggregate bool_exp predicate as a
// correlated subquery matching Hasura's shape:
//
//	EXISTS (SELECT 1 FROM (
//	    SELECT <agg> AS "__cs_agg"
//	    FROM <target> <t> WHERE <join> [AND <filter>] [AND <perms>]
//	) <s> WHERE <s>."__cs_agg" <predicate>)
//
// The aggregate value is computed in an inner subquery (a scalar aggregate over
// the matching rows) and compared in the outer WHERE, so an empty related set
// yields count 0 / bool_and NULL exactly as Hasura does.
type aggregateRelationshipFilter struct {
	relationship     Relationship
	target           Table
	kind             aggregateFuncKind
	columns          []*core.Column
	distinct         bool
	boolAggFunc      string
	predicate        Statement
	filter           Statement
	role             string
	sessionVariables map[string]any
	nestingLevel     int
	aliasPrefix      string
}

// WriteCondition renders the aggregate predicate against the base target table.
// It delegates to writeConditionSubstituted with a nil substitution map, which
// is identical to a non-substituted render (no FROM-clause is rewritten and the
// nested filter/predicate fall through to their plain WriteCondition). Keeping a
// single renderer means the base and insert-CTE paths can never drift.
func (f *aggregateRelationshipFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	return f.writeConditionSubstituted(b, source, params, paramIndex, nil)
}

// writeAggregateExpr writes the scalar aggregate (count(*) / count([DISTINCT]
// cols) / bool_and(col) / bool_or(col)) qualifying columns against the inner
// target alias. Count rendering is delegated to the dialect so SQLite avoids
// PostgreSQL-only row-value COUNT syntax.
func (f *aggregateRelationshipFilter) writeAggregateExpr(b *strings.Builder, targetAlias string) {
	if f.kind != aggFuncCount {
		b.WriteString(f.boolAggFunc)
		b.WriteByte('(')
		core.WriteQualifiedColumn(b, targetAlias, f.columns[0].SQLName)
		b.WriteByte(')')

		return
	}

	f.target.Dialect().WriteCountAggregate(
		b, f.distinct, aggregateColumnExpressions(targetAlias, f.columns),
	)
}

func aggregateColumnExpressions(targetAlias string, columns []*core.Column) []string {
	if len(columns) == 0 {
		return nil
	}

	expressions := make([]string, 0, len(columns))

	for _, col := range columns {
		var expr strings.Builder

		core.WriteQualifiedColumn(&expr, targetAlias, col.SQLName)
		expressions = append(expressions, expr.String())
	}

	return expressions
}
