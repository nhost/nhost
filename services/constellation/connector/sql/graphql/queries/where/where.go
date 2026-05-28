package where

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
)

// Statement is a piece of a WHERE clause that can render itself to SQL.
// All filter types (equals, in, _and, relationship, etc.) implement this.
type Statement interface {
	WriteCondition(
		b *strings.Builder, source string, params []any, paramIndex int,
	) ([]any, int, error)
}

// Clause is an ordered list of [Statement]s implicitly AND-ed together when
// rendered via [Clause.WriteCondition].
type Clause []Statement

// WriteCondition implements [Statement]. It renders the clause as
// `s1 AND s2 AND … AND sN`, returning the accumulated params and the next
// placeholder index.
func (w Clause) WriteCondition(
	b *strings.Builder, source string, params []any, paramIndex int,
) ([]any, int, error) {
	var err error
	for i, condition := range w {
		params, paramIndex, err = condition.WriteCondition(b, source, params, paramIndex)
		if err != nil {
			return nil, 0, fmt.Errorf(
				"failed to write where condition at pos %d: %w",
				i,
				err,
			)
		}

		if i < len(w)-1 {
			b.WriteString(" AND ")
		}
	}

	return params, paramIndex, nil
}

// Parse parses a top-level GraphQL where-clause argument into a Clause. The
// where argument is nullable, matching Hasura: a literal `where: null` or a
// variable that resolves to null (`where: $where` with $where = null) imposes
// no filter and yields a nil clause, exactly like omitting the argument. A
// genuinely omitted variable still errors, since values.ResolveVariable returns
// ErrVariableNotFound for a key absent from the variables map.
//
// Every nested bool_exp position (a relationship, `_not`, or an `_and`/`_or`
// element) goes through parseBoolExp instead, which rejects an explicit null:
// Hasura permits null only for the top-level argument.
//
// nestingLevel and aliases control alias generation for EXISTS subqueries; pass
// 0 and QueryAliases at the top level for user queries, PermissionAliases for
// permission filters.
func Parse(
	t Table,
	whereArg *ast.Value,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	nestingLevel int,
	aliases Aliases,
) (Clause, error) {
	if whereArg == nil {
		return nil, nil
	}

	resolved, err := values.ResolveVariable(whereArg, variables)
	if err != nil {
		return nil, fmt.Errorf("resolving where variable: %w", err)
	}

	if resolved.Kind == ast.NullValue {
		return nil, nil
	}

	return parseBoolExp(
		t, resolved, variables, role, sessionVariables, nestingLevel, aliases,
	)
}

// parseBoolExp parses a non-null bool_exp object into a Clause. It backs the
// resolved top-level argument and every nested bool_exp position. A value that
// resolves to anything other than an object -- including an explicit null -- is
// a validation error, matching Hasura, which only treats the top-level where
// argument as nullable.
func parseBoolExp(
	t Table,
	whereArg *ast.Value,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	nestingLevel int,
	aliases Aliases,
) (Clause, error) {
	whereArg, err := values.ResolveVariable(whereArg, variables)
	if err != nil {
		return nil, fmt.Errorf("resolving where variable: %w", err)
	}

	if whereArg.Kind != ast.ObjectValue {
		return nil, fmt.Errorf("%w: got %v", errExpectedObjectValue, whereArg.Kind)
	}

	conditions := make(Clause, 0, len(whereArg.Children))

	for _, child := range whereArg.Children {
		next, err := parseWhereChild(
			t, child, variables, role, sessionVariables, nestingLevel, aliases,
		)
		if err != nil {
			return nil, err
		}

		conditions = append(conditions, next...)
	}

	return conditions, nil
}

// parseWhereChild dispatches a single object field of a where-clause to the
// matching parser. Logical _and flattens into the parent clause; everything
// else contributes a single Statement, returned as a one-element Clause to
// keep the caller's append loop uniform.
func parseWhereChild(
	t Table,
	child *ast.ChildValue,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	nestingLevel int,
	aliases Aliases,
) (Clause, error) {
	switch child.Name {
	case "_and":
		andConditions, err := parseLogicalAnd(
			t, child.Value, variables, role, sessionVariables, nestingLevel, aliases,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to parse _and: %w", err)
		}

		return andConditions, nil

	case "_or":
		orCondition, err := parseLogicalOr(
			t, child.Value, variables, role, sessionVariables, nestingLevel, aliases,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to parse _or: %w", err)
		}

		return Clause{orCondition}, nil

	case "_not":
		notCondition, err := parseLogicalNot(
			t, child.Value, variables, role, sessionVariables, nestingLevel, aliases,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to parse _not: %w", err)
		}

		return Clause{notCondition}, nil

	case "_exists":
		existsCondition, err := parseExists(
			t, child.Value, variables, role, sessionVariables, nestingLevel, aliases,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to parse _exists: %w", err)
		}

		return Clause{existsCondition}, nil

	default:
		stmt, err := parseFieldOrRelationship(
			t, child.Name, child.Value, variables, role, sessionVariables, nestingLevel, aliases,
		)
		if err != nil {
			return nil, err
		}

		return Clause{stmt}, nil
	}
}

// parseFieldOrRelationship resolves a non-combinator field name against the
// table: a matching column dispatches to ParseFieldComparison; otherwise a
// matching relationship recurses into Parse with the relationship's target
// table; anything else is an unknown field.
func parseFieldOrRelationship( //nolint:ireturn,nolintlint
	t Table,
	fieldName string,
	value *ast.Value,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	nestingLevel int,
	aliases Aliases,
) (Statement, error) {
	if column := t.ColumnFromGraphqlName(fieldName); column != nil {
		cond, err := t.ParseFieldComparison(column, value, variables)
		if err != nil {
			return nil, fmt.Errorf("failed to parse field %s: %w", fieldName, err)
		}

		return cond, nil
	}

	if relationship := t.RelationshipFromGraphqlName(fieldName); relationship != nil {
		rf, err := parseRelationshipField(
			relationship, value, variables, role, sessionVariables, nestingLevel, aliases,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to parse relationship %s: %w", fieldName, err)
		}

		return rf, nil
	}

	return nil, fmt.Errorf("%w: %s", errUnknownFieldInWhereClause, fieldName)
}

// parseRelationshipField builds a relationshipFilter by recursively parsing
// the nested where object against the relationship's target table via
// parseBoolExp, so a null nested filter (`relationship: null`) is rejected like
// Hasura does. An empty nested object (`relationship: {}`) parses to an empty
// clause: the empty-Clause guard leaves conds as a nil Statement interface so
// the filter renders the EXISTS join with no inner predicate (Hasura's
// "any related row exists"), rather than wrapping an empty clause in a non-nil
// interface, which downstream WriteCondition callers must not see.
func parseRelationshipField(
	relationship Relationship,
	value *ast.Value,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	nestingLevel int,
	aliases Aliases,
) (*relationshipFilter, error) {
	relationshipConditions, err := parseBoolExp(
		relationship.Target(),
		value,
		variables,
		role,
		sessionVariables,
		nestingLevel+1,
		aliases,
	)
	if err != nil {
		return nil, err
	}

	var conds Statement
	if len(relationshipConditions) > 0 {
		conds = relationshipConditions
	}

	return &relationshipFilter{
		relationship:     relationship,
		conditions:       conds,
		role:             role,
		sessionVariables: sessionVariables,
		nestingLevel:     nestingLevel,
		aliasPrefix:      aliases.Relationship,
	}, nil
}

func parseLogicalAnd(
	t Table,
	value *ast.Value,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	nestingLevel int,
	aliases Aliases,
) (Clause, error) {
	if value.Kind == ast.ObjectValue {
		return parseBoolExp(
			t,
			value,
			variables,
			role,
			sessionVariables,
			nestingLevel,
			aliases,
		)
	}

	if value.Kind != ast.ListValue {
		return nil, errAndMustBeListOrObject
	}

	conditions := make(Clause, 0, len(value.Children))

	for _, item := range value.Children {
		itemConditions, err := parseBoolExp(
			t, item.Value, variables, role, sessionVariables, nestingLevel, aliases,
		)
		if err != nil {
			return nil, err
		}

		conditions = append(conditions, itemConditions...)
	}

	return conditions, nil
}

func parseLogicalOr(
	t Table,
	value *ast.Value,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	nestingLevel int,
	aliases Aliases,
) (*orFilter, error) {
	if value.Kind == ast.ObjectValue {
		itemConditions, err := parseBoolExp(
			t, value, variables, role, sessionVariables, nestingLevel, aliases,
		)
		if err != nil {
			return nil, err
		}

		return &orFilter{conditions: []Statement{orElement(itemConditions)}}, nil
	}

	if value.Kind != ast.ListValue {
		return nil, errOrMustBeListOrObject
	}

	orConditions := make([]Statement, 0, len(value.Children))
	for _, item := range value.Children {
		itemConditions, err := parseBoolExp(
			t, item.Value, variables, role, sessionVariables, nestingLevel, aliases,
		)
		if err != nil {
			return nil, err
		}

		orConditions = append(orConditions, orElement(itemConditions))
	}

	return &orFilter{conditions: orConditions}, nil
}

// orElement renders one element of an `_or` list. An empty bool_exp element
// (`{}` or `_and: []`) is always true, and Hasura keeps it as a true disjunct
// (e.g. `_or: [{}, ...]` matches everything). Returning the constant avoids an
// empty fragment inside the parenthesised OR.
func orElement(conditions Clause) Clause {
	if len(conditions) == 0 {
		return Clause{boolConstant(true)}
	}

	return conditions
}

func parseLogicalNot( //nolint:ireturn,nolintlint
	t Table,
	value *ast.Value,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	nestingLevel int,
	aliases Aliases,
) (Statement, error) {
	conditions, err := parseBoolExp(
		t, value, variables, role, sessionVariables, nestingLevel, aliases,
	)
	if err != nil {
		return nil, err
	}

	// `_not: {}` (and `_not: {_and: []}`) negate the always-true empty bool_exp,
	// so they are always false -- matching Hasura, where `_not: {}` returns no
	// rows. Emit the constant rather than `NOT ()`, which is invalid SQL.
	// `_not: null` never reaches here: parseBoolExp rejects a null bool_exp, as
	// Hasura does.
	if len(conditions) == 0 {
		return boolConstant(false), nil
	}

	return &notFilter{condition: conditions}, nil
}

// resolveScalarValue resolves a variable reference and extracts the underlying Go value.
// This is the common pattern for scalar comparison operators (_eq, _neq, _gt, etc.).
func resolveScalarValue(operatorValue *ast.Value, variables map[string]any) (any, error) {
	resolved, err := values.ResolveVariable(operatorValue, variables)
	if err != nil {
		return nil, fmt.Errorf("resolving scalar variable: %w", err)
	}

	v, err := values.ExtractGoValue(resolved)
	if err != nil {
		return nil, fmt.Errorf("extracting scalar value: %w", err)
	}

	return v, nil
}

// resolveArrayValue resolves a variable reference and extracts an array of values.
// This is the common pattern for array operators (_in, _nin).
func resolveArrayValue(
	operatorValue *ast.Value,
	variables map[string]any,
) ([]any, error) {
	resolved, err := values.ResolveVariable(operatorValue, variables)
	if err != nil {
		return nil, fmt.Errorf("resolving array variable: %w", err)
	}

	out, err := values.ExtractArrayValues(resolved)
	if err != nil {
		return nil, fmt.Errorf("extracting array values: %w", err)
	}

	return out, nil
}

// resolveStringArrayValue resolves a variable reference and extracts a string array.
// This is the common pattern for JSONB key operators (_has_keys_all, _has_keys_any).
func resolveStringArrayValue(
	operatorValue *ast.Value,
	variables map[string]any,
) ([]string, error) {
	resolved, err := values.ResolveVariable(operatorValue, variables)
	if err != nil {
		return nil, fmt.Errorf("resolving string array variable: %w", err)
	}

	out, err := values.ExtractStringArrayValues(resolved)
	if err != nil {
		return nil, fmt.Errorf("extracting string array values: %w", err)
	}

	return out, nil
}

// ParseFieldComparison parses an operator object ({_eq: ..., _in: ..., ...}) for a
// single column into a Statement. Multiple operators in the same object are
// AND-ed together. An empty object returns a nil Statement. The per-operator
// logic lives in the operatorParsers dispatch table in operators.go.
func ParseFieldComparison( //nolint:ireturn,nolintlint
	t Table,
	column *core.Column,
	value *ast.Value,
	variables map[string]any,
) (Statement, error) {
	if value.Kind != ast.ObjectValue {
		return nil, errFieldComparisonMustBeObject
	}

	d := t.Dialect()

	conditions := make([]Statement, 0, len(value.Children))

	for _, child := range value.Children {
		parser, ok := operatorParsers[child.Name]
		if !ok {
			return nil, fmt.Errorf("%w: %s", errUnknownWhereOperator, child.Name)
		}

		cond, err := parser(column, child.Value, variables, d)
		if err != nil {
			return nil, err
		}

		conditions = append(conditions, cond)
	}

	switch {
	case len(conditions) == 0:
		return nil, nil //nolint:nilnil
	case len(conditions) == 1:
		return conditions[0], nil
	default:
		return &andFilter{conditions: conditions}, nil
	}
}

type andFilter struct {
	conditions []Statement
}

func (f *andFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	var err error
	for i, condition := range f.conditions {
		if i > 0 {
			b.WriteString(" AND ")
		}

		params, paramIndex, err = condition.WriteCondition(b, source, params, paramIndex)
		if err != nil {
			return nil, 0, fmt.Errorf(
				"failed to write AND condition at pos %d: %w",
				i,
				err,
			)
		}
	}

	return params, paramIndex, nil
}

type orFilter struct {
	conditions []Statement
}

func (f *orFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	// An empty disjunction (`_or: []`) is false, matching Hasura. Rendering the
	// constant also avoids the invalid empty `()` fragment.
	if len(f.conditions) == 0 {
		b.WriteString("false")

		return params, paramIndex, nil
	}

	b.WriteByte('(')

	var err error
	for i, clause := range f.conditions {
		params, paramIndex, err = clause.WriteCondition(b, source, params, paramIndex)
		if err != nil {
			return nil, 0, fmt.Errorf(
				"failed to write OR condition at pos %d: %w",
				i,
				err,
			)
		}

		if i < len(f.conditions)-1 {
			b.WriteString(" OR ")
		}
	}

	b.WriteByte(')')

	return params, paramIndex, nil
}

// boolConstant renders a SQL boolean literal for logical expressions whose
// truth value is fixed regardless of any row: an empty `_or` element is true, a
// `_not` of the always-true empty bool_exp is false. Mirrors how Hasura
// evaluates these degenerate forms.
type boolConstant bool

func (c boolConstant) WriteCondition(
	b *strings.Builder, _ string, params []any, paramIndex int,
) ([]any, int, error) {
	if c {
		b.WriteString("true")
	} else {
		b.WriteString("false")
	}

	return params, paramIndex, nil
}

type notFilter struct {
	condition Statement
}

func (f *notFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	b.WriteString("NOT (")

	var err error

	params, paramIndex, err = f.condition.WriteCondition(b, source, params, paramIndex)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to write NOT condition: %w", err)
	}

	b.WriteByte(')')

	return params, paramIndex, nil
}
