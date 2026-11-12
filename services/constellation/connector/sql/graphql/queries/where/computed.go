package where

import (
	"fmt"
	"slices"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
	"github.com/nhost/nhost/services/constellation/connector/sql/pgtypes"
)

type computedComparison struct {
	expression       core.ComputedExpression
	value            *ast.Value
	variables        map[string]any
	dialect          dialect.Dialect
	sessionVariables map[string]any
	current          Table
	root             Table
	rootColumn       bool
}

func parseComputedComparison( //nolint:ireturn // The where parser composes Statement implementations.
	t Table,
	computed core.ComputedExpression,
	value *ast.Value,
	variables, sessionVariables map[string]any,
	root Table,
) (Statement, error) {
	if value.Kind != ast.ObjectValue {
		return nil, errFieldComparisonMustBeObject
	}

	c := &computedComparison{
		expression: computed, value: value, variables: variables, dialect: t.Dialect(),
		sessionVariables: sessionVariables, current: t, root: root, rootColumn: false,
	}
	column := computedComparisonColumn(computed.SQLType())
	target := &comparisonTarget{
		sourceColumn: column.SQLName,
		sqlType:      column.SQLType,
		render:       func(_ *strings.Builder, _ string) {},
	}

	comparison, err := parseFieldComparisonValue(
		column,
		target,
		value,
		variables,
		t.Dialect(),
		t,
		root,
	)
	if err != nil {
		return nil, fmt.Errorf("parsing computed predicate: %w", err)
	}

	c.rootColumn = containsRootColumn(comparison)
	if comparison == nil {
		// An empty comparison is true even inside _or/_not. Keep it as a
		// statement rather than dropping it (which changes boolean semantics).
		return NewRawFilter("true"), nil
	}

	return c, nil
}

func computedComparisonColumn(sqlType string) *core.Column {
	return &core.Column{
		SQLName: "computed", GraphqlName: "", SQLType: sqlType,
		IsArray: false, IsGenerated: false, IsIdentity: false, HasDefault: false, DefaultExpr: "",
	}
}

func (c *computedComparison) sourceColumns() []string {
	return c.expression.SourceColumns()
}

func (c *computedComparison) WriteCondition(
	b *strings.Builder, source string, params []any, paramIndex int,
) ([]any, int, error) {
	return c.writeWithRoot(b, source, source, params, paramIndex)
}

func (c *computedComparison) writeWithRoot(
	b *strings.Builder, source, root string, params []any, paramIndex int,
) ([]any, int, error) {
	var expression strings.Builder

	params, paramIndex, err := c.expression.WriteExpression(
		&expression, source, c.sessionVariables, params, paramIndex,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("writing computed predicate expression: %w", err)
	}

	column := computedComparisonColumn(c.expression.SQLType())
	target := &comparisonTarget{
		sourceColumn: column.SQLName,
		sqlType:      column.SQLType,
		render:       func(b *strings.Builder, _ string) { b.WriteString(expression.String()) },
	}

	comparison, err := parseFieldComparisonValue(
		column,
		target,
		c.value,
		c.variables,
		c.dialect,
		c.current,
		c.root,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("parsing computed predicate comparison: %w", err)
	}

	params, paramIndex, err = writeConditionRoot(
		comparison,
		b,
		source,
		root,
		params,
		paramIndex,
		nil,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("writing computed predicate comparison: %w", err)
	}

	return params, paramIndex, nil
}

// SupportedComputedPermissionComparison classifies a computed scalar filter
// against the same operator dispatch used by ParseFieldComparison. Unsupported
// operators or type/operator pairs must revoke the whole metadata permission
// before roots are built; otherwise a parse failure would drop the source.
func SupportedComputedPermissionComparison(
	sqlType string,
	comparison map[string]any,
	columnResolvers ...func(name string, root bool) (string, bool, bool),
) bool {
	// Hasura disallows the PostgreSQL json type in metadata permission filters
	// even for operators (such as _is_null) that need no JSON equality.
	if sqlType == "json" {
		return false
	}

	remaining := make(map[string]any, len(comparison))
	for originalOp, value := range comparison {
		op := canonicalComparisonOperator(originalOp)
		if columnComparisonOperator(op) != "" {
			if !validComputedColumnReference(sqlType, value, columnResolvers) {
				return false
			}

			continue
		}

		if _, implemented := operatorParserFor(originalOp); !implemented {
			return false
		}
		// Nested casts are validated recursively with their table context;
		// parsing them again without that context would reject column refs.
		if op != "_cast" {
			remaining[originalOp] = value
		}

		if !supportedComputedOperandShape(sqlType, op, value) ||
			!supportedComputedOperatorType(sqlType, op, value, columnResolvers) {
			return false
		}
	}

	// Use the same AST conversion and parser as permission initialization to
	// reject malformed operands at permission granularity, not source granularity.
	value, err := values.GoValueToAST(remaining)
	if err != nil {
		return false
	}

	column := computedComparisonColumn(sqlType)
	target := newColumnComparisonTarget(column)
	_, err = parseFieldComparisonValue(column, &target, value, nil, dialect.NewPostgresDialect())

	return err == nil
}

// SupportedComputedTableColumnComparison validates a column predicate nested
// beneath a computed-table permission before the permission is installed. In
// particular, malformed comparison operators must not fail root construction.
func SupportedComputedTableColumnComparison(sqlType string, isArray bool, comparison any,
	resolve func(name string, root bool) (string, bool, bool),
) bool {
	operands, ok := comparison.(map[string]any)
	if !ok {
		operands = map[string]any{"_eq": comparison}
	}

	if !isArray {
		return SupportedComputedPermissionComparison(sqlType, operands, resolve)
	}

	remaining := make(map[string]any, len(operands))
	for key, operand := range operands {
		if columnComparisonOperator(canonicalComparisonOperator(key)) != "" {
			value, err := values.GoValueToAST(operand)
			if err != nil {
				return false
			}

			name, root, err := columnReference(value, nil)
			if err != nil {
				return false
			}

			rhsType, rhsArray, found := resolve(name, root)
			if !found || !rhsArray || rhsType != sqlType {
				return false
			}

			continue
		}

		if !supportedArrayPermissionOperator(canonicalComparisonOperator(key)) {
			return false
		}

		remaining[key] = operand
	}

	value, err := values.GoValueToAST(remaining)
	if err != nil {
		return false
	}

	column := computedComparisonColumn(sqlType)
	column.IsArray = true
	target := newColumnComparisonTarget(column)
	_, err = parseFieldComparisonValue(column, &target, value, nil, dialect.NewPostgresDialect())

	return err == nil
}

func supportedArrayPermissionOperator(op string) bool {
	switch op {
	case "_contained_in", "_contains", "_eq", "_gt", "_gte", "_in", "_is_null",
		"_lt", "_lte", "_neq", "_nin":
		return true
	default:
		return false
	}
}

func validComputedColumnReference(sqlType string, operand any,
	resolvers []func(name string, root bool) (string, bool, bool),
) bool {
	if len(resolvers) != 1 {
		return false
	}

	value, err := values.GoValueToAST(operand)
	if err != nil {
		return false
	}

	name, root, err := columnReference(value, nil)
	if err != nil {
		return false
	}

	rhsType, isArray, found := resolvers[0](name, root)

	return found && !isArray && rhsType == sqlType
}

//nolint:cyclop // One closed type-family dispatch mirrors the operator parser's supported families.
func supportedComputedOperatorType(sqlType, op string, value any,
	columnResolvers []func(name string, root bool) (string, bool, bool),
) bool {
	switch op {
	case "_like",
		"_nlike",
		"_ilike",
		"_nilike",
		"_regex",
		"_nregex",
		"_iregex",
		"_niregex",
		"_similar",
		"_nsimilar":
		if sqlType != "text" && sqlType != "varchar" && sqlType != "bpchar" &&
			sqlType != "citext" {
			return false
		}
	case "_contains", "_contained_in", "_has_key", "_has_keys_all", "_has_keys_any":
		if sqlType != "jsonb" {
			return false
		}
	case "_cast":
		cast, ok := value.(map[string]any)
		if !ok || !supportedComputedCast(sqlType, cast, columnResolvers...) {
			return false
		}
	case "_ancestor", "_ancestor_any", "_descendant", "_descendant_any",
		"_matches", "_matches_any", "_matches_fulltext":
		if sqlType != "ltree" {
			return false
		}
	case "_st_3d_d_within", "_st_3d_intersects", "_st_contains", "_st_crosses",
		"_st_equals", "_st_overlaps", "_st_touches", "_st_within":
		if !pgtypes.IsGeometry(sqlType) {
			return false
		}
	case "_st_d_within", "_st_intersects":
		if !pgtypes.IsSpatial(sqlType) {
			return false
		}
	}

	return true
}

// Reject structured values for scalar comparison placeholders before the
// permission is served. _in/_nin and JSON, array and spatial operands have
// separate coercion rules and remain valid.
func supportedComputedOperandShape(sqlType, op string, value any) bool {
	if sqlType == "json" || sqlType == "jsonb" || pgtypes.IsSpatial(sqlType) ||
		strings.HasPrefix(sqlType, "_") || strings.HasSuffix(sqlType, "[]") {
		return true
	}

	switch op {
	case "_in", "_nin", "_ancestor_any", "_descendant_any", "_matches_any":
		list, ok := value.([]any)
		if !ok {
			return true // Let the parser report an invalid non-list operand.
		}

		return !slices.ContainsFunc(list, structuredComputedOperand)
	case "_cast", "_has_keys_all", "_has_keys_any", "_contains", "_contained_in":
		return true // The operator parser validates these structured operands.
	default:
		return strings.HasPrefix(op, "_st_") || !structuredComputedOperand(value)
	}
}

func structuredComputedOperand(value any) bool {
	switch value.(type) {
	case map[string]any, []any:
		return true
	default:
		return false
	}
}

func supportedComputedCast(sqlType string, cast map[string]any,
	columnResolvers ...func(name string, root bool) (string, bool, bool),
) bool {
	for target, value := range cast {
		child, ok := value.(map[string]any)
		if !ok {
			return false
		}

		switch {
		case sqlType == "jsonb" && target == "String":
			if !SupportedComputedPermissionComparison("text", child, columnResolvers...) {
				return false
			}
		case pgtypes.IsGeography(sqlType) && target == pgtypes.Geometry:
			if !SupportedComputedPermissionComparison(pgtypes.Geometry, child, columnResolvers...) {
				return false
			}
		case pgtypes.IsGeometry(sqlType) && target == pgtypes.Geography:
			if !SupportedComputedPermissionComparison(
				pgtypes.Geography,
				child,
				columnResolvers...) {
				return false
			}
		default:
			return false
		}
	}

	return sqlType == "jsonb" || pgtypes.IsSpatial(sqlType)
}
