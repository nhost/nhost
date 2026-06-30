package where

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
	"github.com/nhost/nhost/services/constellation/connector/sql/pgtypes"
)

type spatialOperatorTarget int

const (
	spatialOperatorAnySpatial spatialOperatorTarget = iota
	spatialOperatorGeometryOnly
)

type spatialPredicateFilter struct {
	column    *core.Column
	target    *comparisonTarget
	predicate dialect.SpatialPredicate
	value     any
	dialect   dialect.Dialect
}

func (f *spatialPredicateFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	if !f.dialect.SupportsSpatialTypes() {
		return nil, 0, errSpatialUnsupportedByDialect
	}

	target := comparisonTargetFor(f.column, f.target)
	if !pgtypes.IsSpatial(target.sqlType) {
		return nil, 0, errSpatialOperatorOnNonSpatialColumn
	}

	coerced, err := values.CoerceSQLValue(target.sqlType, f.value)
	if err != nil {
		return nil, 0, fmt.Errorf("coercing spatial predicate value: %w", err)
	}

	f.dialect.WriteSpatialPredicate(
		b,
		f.predicate,
		target.sqlExpression(source),
		f.dialect.SpatialValueExpression(f.dialect.Placeholder(paramIndex), target.sqlType),
	)

	params = append(params, coerced)

	return params, paramIndex + 1, nil
}

type spatialDWithinFilter struct {
	column           *core.Column
	target           *comparisonTarget
	from             any
	distance         any
	useSpheroid      *bool
	threeDimensional bool
	dialect          dialect.Dialect
}

func (f *spatialDWithinFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	if !f.dialect.SupportsSpatialTypes() {
		return nil, 0, errSpatialUnsupportedByDialect
	}

	target := comparisonTargetFor(f.column, f.target)
	if !pgtypes.IsSpatial(target.sqlType) {
		return nil, 0, errSpatialOperatorOnNonSpatialColumn
	}

	from, err := values.CoerceSQLValue(target.sqlType, f.from)
	if err != nil {
		return nil, 0, fmt.Errorf("coercing _st_d_within.from: %w", err)
	}

	fromExpr := f.dialect.SpatialValueExpression(f.dialect.Placeholder(paramIndex), target.sqlType)
	distanceExpr := f.dialect.Placeholder(paramIndex + 1)
	params = append(params, from, f.distance)
	paramIndex += 2

	var useSpheroidExpr *string
	if pgtypes.IsGeography(target.sqlType) {
		useSpheroid := true
		if f.useSpheroid != nil {
			useSpheroid = *f.useSpheroid
		}

		expr := f.dialect.Placeholder(paramIndex)
		useSpheroidExpr = &expr

		params = append(params, useSpheroid)
		paramIndex++
	}

	f.dialect.WriteSpatialDWithinPredicate(
		b,
		f.threeDimensional,
		target.sqlExpression(source),
		fromExpr,
		distanceExpr,
		target.sqlType,
		useSpheroidExpr,
	)

	return params, paramIndex, nil
}

func spatialPredicateParser(
	predicate dialect.SpatialPredicate,
	allowedTarget spatialOperatorTarget,
) operatorParser {
	return func(
		column *core.Column,
		target *comparisonTarget,
		value *ast.Value,
		variables map[string]any,
		d dialect.Dialect,
	) (Statement, error) {
		if !d.SupportsSpatialTypes() {
			return nil, errSpatialUnsupportedByDialect
		}

		comparisonTarget := comparisonTargetFor(column, target)
		if err := validateSpatialOperatorTarget(
			comparisonTarget.sqlType,
			allowedTarget,
		); err != nil {
			return nil, err
		}

		val, err := resolveTargetScalarValue(column, target, value, variables)
		if err != nil {
			return nil, err
		}

		return &spatialPredicateFilter{
			column:    column,
			target:    target,
			predicate: predicate,
			value:     val,
			dialect:   d,
		}, nil
	}
}

func spatialDWithinParser(threeDimensional bool) operatorParser {
	return func(
		column *core.Column,
		target *comparisonTarget,
		value *ast.Value,
		variables map[string]any,
		d dialect.Dialect,
	) (Statement, error) {
		if !d.SupportsSpatialTypes() {
			return nil, errSpatialUnsupportedByDialect
		}

		comparisonTarget := comparisonTargetFor(column, target)

		allowedTarget := spatialOperatorAnySpatial
		if threeDimensional {
			allowedTarget = spatialOperatorGeometryOnly
		}

		if err := validateSpatialOperatorTarget(
			comparisonTarget.sqlType,
			allowedTarget,
		); err != nil {
			return nil, err
		}

		input, err := parseSpatialDWithinInput(value, variables)
		if err != nil {
			return nil, err
		}

		return &spatialDWithinFilter{
			column:           column,
			target:           target,
			from:             input.from,
			distance:         input.distance,
			useSpheroid:      input.useSpheroid,
			threeDimensional: threeDimensional,
			dialect:          d,
		}, nil
	}
}

type spatialDWithinInput struct {
	from        any
	distance    any
	useSpheroid *bool
}

func parseSpatialDWithinInput(
	value *ast.Value,
	variables map[string]any,
) (spatialDWithinInput, error) {
	value, err := values.ResolveVariable(value, variables)
	if err != nil {
		return spatialDWithinInput{}, fmt.Errorf("resolving _st_d_within input: %w", err)
	}

	if value.Kind != ast.ObjectValue {
		return spatialDWithinInput{}, errSpatialDWithinMustBeObject
	}

	input := spatialDWithinInput{from: nil, distance: nil, useSpheroid: nil}
	for _, child := range value.Children {
		childValue, err := values.ResolveASTValue(child.Value, variables)
		if err != nil {
			return spatialDWithinInput{}, fmt.Errorf(
				"resolving _st_d_within.%s: %w",
				child.Name,
				err,
			)
		}

		switch child.Name {
		case "from":
			input.from = childValue
		case "distance":
			input.distance = childValue
		case "use_spheroid":
			useSpheroid, ok := childValue.(bool)
			if !ok {
				return spatialDWithinInput{}, fmt.Errorf(
					"%w: got %T",
					errSpatialDWithinUseSpheroidMustBeBoolean,
					childValue,
				)
			}

			input.useSpheroid = &useSpheroid
		}
	}

	if input.from == nil {
		return spatialDWithinInput{}, errSpatialDWithinFromRequired
	}

	if input.distance == nil {
		return spatialDWithinInput{}, errSpatialDWithinDistanceRequired
	}

	return input, nil
}

func parseSpatialCast( //nolint:ireturn,nolintlint
	column *core.Column,
	target *comparisonTarget,
	value *ast.Value,
	variables map[string]any,
	d dialect.Dialect,
) (Statement, error) {
	if !d.SupportsSpatialTypes() {
		return nil, errSpatialUnsupportedByDialect
	}

	baseTarget := comparisonTargetFor(column, target)
	if !pgtypes.IsSpatial(baseTarget.sqlType) {
		return nil, fmt.Errorf("%w: _cast", errUnknownWhereOperator)
	}

	value, err := values.ResolveVariable(value, variables)
	if err != nil {
		return nil, fmt.Errorf("resolving spatial _cast value: %w", err)
	}

	if value.Kind != ast.ObjectValue {
		return nil, errSpatialCastMustBeObject
	}

	conditions := make([]Statement, 0, len(value.Children))
	for _, child := range value.Children {
		toSQLType, err := spatialCastTarget(baseTarget.sqlType, child.Name)
		if err != nil {
			return nil, err
		}

		castTarget := newSpatialCastComparisonTarget(baseTarget, toSQLType, d)

		cond, err := parseFieldComparisonValue(column, &castTarget, child.Value, variables, d)
		if err != nil {
			return nil, fmt.Errorf("failed to parse spatial _cast.%s: %w", child.Name, err)
		}

		if cond != nil {
			conditions = append(conditions, cond)
		}
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

func validateSpatialOperatorTarget(sqlType string, allowed spatialOperatorTarget) error {
	if !pgtypes.IsSpatial(sqlType) {
		return errSpatialOperatorOnNonSpatialColumn
	}

	if allowed == spatialOperatorGeometryOnly && !pgtypes.IsGeometry(sqlType) {
		return errSpatialOperatorOnWrongType
	}

	return nil
}

func spatialCastTarget(fromSQLType, targetName string) (string, error) {
	toSQLType := pgtypes.SpatialScalarName(targetName)
	if toSQLType == "" || toSQLType == pgtypes.SpatialScalarName(fromSQLType) {
		return "", fmt.Errorf("%w: %s", errSpatialCastTargetInvalid, targetName)
	}

	return toSQLType, nil
}
