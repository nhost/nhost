package where

import (
	"fmt"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
)

// operatorParser parses one operator inside a field-comparison object
// (the {_eq: x, _in: [...], ...} value) into a single Statement.
type operatorParser func(
	column *core.Column,
	target *comparisonTarget,
	value *ast.Value,
	variables map[string]any,
	d dialect.Dialect,
) (Statement, error)

// scalarParser adapts a filter constructor that consumes a single resolved Go
// value (used by _eq/_neq/_gt/_gte/_lt/_lte/_like family/_regex family/_has_key).
func scalarParser(
	build func(*core.Column, *comparisonTarget, any, dialect.Dialect) Statement,
) operatorParser {
	return func(
		c *core.Column,
		target *comparisonTarget,
		v *ast.Value,
		vars map[string]any,
		d dialect.Dialect,
	) (Statement, error) {
		val, err := resolveTargetScalarValue(c, target, v, vars)
		if err != nil {
			return nil, err
		}

		return build(c, target, val, d), nil
	}
}

// arrayParser adapts a filter constructor that consumes a resolved []any
// (used by _in/_nin).
func arrayParser(
	build func(*core.Column, *comparisonTarget, []any, dialect.Dialect) Statement,
) operatorParser {
	return func(
		c *core.Column,
		target *comparisonTarget,
		v *ast.Value,
		vars map[string]any,
		d dialect.Dialect,
	) (Statement, error) {
		vals, err := resolveTargetArrayValue(c, target, v, vars)
		if err != nil {
			return nil, err
		}

		return build(c, target, vals, d), nil
	}
}

// stringArrayParser adapts a filter constructor that consumes a resolved
// []string (used by _has_keys_all/_has_keys_any).
func stringArrayParser(
	build func(*core.Column, []string, dialect.Dialect) Statement,
) operatorParser {
	return func(
		c *core.Column,
		_ *comparisonTarget,
		v *ast.Value,
		vars map[string]any,
		d dialect.Dialect,
	) (Statement, error) {
		keys, err := resolveStringArrayValue(v, vars)
		if err != nil {
			return nil, err
		}

		return build(c, keys, d), nil
	}
}

// buildLike returns a scalar filter constructor for a LIKE-family operator
// parameterized by positivity (LIKE vs NOT LIKE) and case sensitivity
// (LIKE vs ILIKE).
func buildLike(
	negated, caseInsensitive bool,
) func(*core.Column, *comparisonTarget, any, dialect.Dialect) Statement {
	return func(c *core.Column, target *comparisonTarget, v any, d dialect.Dialect) Statement {
		pattern := values.AnyToString(v)
		caseSensitive := !caseInsensitive
		column := sourceColumnForTarget(c, target)

		if negated {
			return &notLikeFilter{
				column: column, pattern: pattern, caseSensitive: caseSensitive, dialect: d,
			}
		}

		return &likeFilter{
			column: column, pattern: pattern, caseSensitive: caseSensitive, dialect: d,
		}
	}
}

// buildRegex returns an operatorParser for a regex-family operator
// parameterized by positivity (~ vs !~) and case sensitivity (~ vs ~*).
// The parser asserts that the dialect supports regex (regexFilter and
// notRegexFilter emit Postgres operators verbatim) so a bypass of the
// schema-level gate in connector/sql/graphql/schema/inputs.go is caught
// at SQL generation rather than at execution time.
func buildRegex(negated, caseInsensitive bool) operatorParser {
	return func(
		c *core.Column,
		target *comparisonTarget,
		v *ast.Value,
		vars map[string]any,
		d dialect.Dialect,
	) (Statement, error) {
		if !d.SupportsRegex() {
			return nil, errRegexUnsupportedByDialect
		}

		val, err := resolveScalarValue(v, vars)
		if err != nil {
			return nil, err
		}

		pattern := values.AnyToString(val)
		caseSensitive := !caseInsensitive
		column := sourceColumnForTarget(c, target)

		if negated {
			return &notRegexFilter{
				column: column, pattern: pattern, caseSensitive: caseSensitive, dialect: d,
			}, nil
		}

		return &regexFilter{
			column: column, pattern: pattern, caseSensitive: caseSensitive, dialect: d,
		}, nil
	}
}

// parseIsNull handles _is_null. The value must be resolved first: a client may
// parameterize it as `_is_null: $v` (the schema types it as a nullable Boolean),
// in which case the AST is an ast.Variable whose .Raw is the variable name, not
// the boolean — so reading .Raw directly would ignore $v entirely. A literal or
// variable-resolved true yields IS NULL, false yields IS NOT NULL. An explicit
// null (literal or variable) is rejected, matching Hasura, which fails such a
// query with "expected a boolean for type 'Boolean', but found null" rather
// than treating it as a filter.
func parseIsNull( //nolint:ireturn,nolintlint
	column *core.Column,
	target *comparisonTarget,
	value *ast.Value,
	variables map[string]any,
	_ dialect.Dialect,
) (Statement, error) {
	resolved, err := values.ResolveVariable(value, variables)
	if err != nil {
		return nil, fmt.Errorf("resolving _is_null value: %w", err)
	}

	v, err := values.ExtractGoValue(resolved)
	if err != nil {
		return nil, fmt.Errorf("extracting _is_null value: %w", err)
	}

	isNull, ok := v.(bool)
	if !ok {
		return nil, fmt.Errorf("%w: got %T", errIsNullMustBeBoolean, v)
	}

	return &isNullFilter{
		column: sourceColumnForTarget(column, target),
		target: target,
		isNull: isNull,
	}, nil
}

// containmentParser handles _contains / _contained_in, which dispatch on
// column.IsArray to produce either an array or a JSONB filter.
func containmentParser(
	buildArray func(*core.Column, []any, dialect.Dialect) Statement,
	buildJSONB func(*core.Column, any, dialect.Dialect) Statement,
) operatorParser {
	return func(
		c *core.Column,
		_ *comparisonTarget,
		v *ast.Value,
		vars map[string]any,
		d dialect.Dialect,
	) (Statement, error) {
		resolved, err := values.ResolveVariable(v, vars)
		if err != nil {
			return nil, fmt.Errorf("resolving containment value: %w", err)
		}

		if c.IsArray {
			arr, err := values.ExtractArrayValues(resolved)
			if err != nil {
				return nil, fmt.Errorf("extracting containment array: %w", err)
			}

			return buildArray(c, arr, d), nil
		}

		val, err := values.ExtractJSONBValue(resolved)
		if err != nil {
			return nil, fmt.Errorf("extracting containment jsonb: %w", err)
		}

		return buildJSONB(c, val, d), nil
	}
}

// operatorParserFor consults the dispatch table used by ParseFieldComparison.
// Adding a new operator means adding one entry to operatorParserTable.
func operatorParserFor(name string) (operatorParser, bool) {
	parser, ok := operatorParserTable()[name]

	return parser, ok
}

//nolint:funlen // operator dispatch table is intentionally kept in one place.
func operatorParserTable() map[string]operatorParser {
	return map[string]operatorParser{
		"_eq": scalarParser(
			func(c *core.Column, target *comparisonTarget, v any, d dialect.Dialect) Statement {
				return &equalsFilter{column: c, target: target, value: v, dialect: d}
			},
		),
		"_neq": scalarParser(
			func(c *core.Column, target *comparisonTarget, v any, d dialect.Dialect) Statement {
				return &notEqualsFilter{column: c, target: target, value: v, dialect: d}
			},
		),
		"_gt": scalarParser(
			func(c *core.Column, target *comparisonTarget, v any, d dialect.Dialect) Statement {
				return &greaterThanFilter{column: c, target: target, value: v, dialect: d}
			},
		),
		"_gte": scalarParser(
			func(c *core.Column, target *comparisonTarget, v any, d dialect.Dialect) Statement {
				return &greaterThanOrEqualFilter{column: c, target: target, value: v, dialect: d}
			},
		),
		"_lt": scalarParser(
			func(c *core.Column, target *comparisonTarget, v any, d dialect.Dialect) Statement {
				return &lessThanFilter{column: c, target: target, value: v, dialect: d}
			},
		),
		"_lte": scalarParser(
			func(c *core.Column, target *comparisonTarget, v any, d dialect.Dialect) Statement {
				return &lessThanOrEqualFilter{column: c, target: target, value: v, dialect: d}
			},
		),
		"_in": arrayParser(
			func(c *core.Column, target *comparisonTarget, vs []any, d dialect.Dialect) Statement {
				return &inFilter{column: c, target: target, values: vs, dialect: d}
			},
		),
		"_nin": arrayParser(
			func(c *core.Column, target *comparisonTarget, vs []any, d dialect.Dialect) Statement {
				return &notInFilter{column: c, target: target, values: vs, dialect: d}
			},
		),
		"_like":    scalarParser(buildLike(false, false)),
		"_nlike":   scalarParser(buildLike(true, false)),
		"_ilike":   scalarParser(buildLike(false, true)),
		"_nilike":  scalarParser(buildLike(true, true)),
		"_regex":   buildRegex(false, false),
		"_nregex":  buildRegex(true, false),
		"_iregex":  buildRegex(false, true),
		"_niregex": buildRegex(true, true),
		"_is_null": parseIsNull,
		"_cast":    parseSpatialCast,
		"_contains": containmentParser(
			func(c *core.Column, vs []any, d dialect.Dialect) Statement {
				return &arrayContainsFilter{
					column: c.SQLName, sqlType: c.SQLType, value: vs, dialect: d,
				}
			},
			func(c *core.Column, v any, d dialect.Dialect) Statement {
				return &jsonbContainsFilter{column: c.SQLName, value: v, dialect: d}
			},
		),
		"_contained_in": containmentParser(
			func(c *core.Column, vs []any, d dialect.Dialect) Statement {
				return &arrayContainedInFilter{
					column: c.SQLName, sqlType: c.SQLType, value: vs, dialect: d,
				}
			},
			func(c *core.Column, v any, d dialect.Dialect) Statement {
				return &jsonbContainedInFilter{column: c.SQLName, value: v, dialect: d}
			},
		),
		"_has_key": scalarParser(
			func(c *core.Column, _ *comparisonTarget, v any, d dialect.Dialect) Statement {
				return &jsonbHasKeyFilter{column: c.SQLName, key: values.AnyToString(v), dialect: d}
			},
		),
		"_has_keys_all": stringArrayParser(
			func(c *core.Column, keys []string, d dialect.Dialect) Statement {
				return &jsonbHasKeysAllFilter{column: c.SQLName, keys: keys, dialect: d}
			},
		),
		"_has_keys_any": stringArrayParser(
			func(c *core.Column, keys []string, d dialect.Dialect) Statement {
				return &jsonbHasKeysAnyFilter{column: c.SQLName, keys: keys, dialect: d}
			},
		),
		"_st_3d_d_within": spatialDWithinParser(true),
		"_st_3d_intersects": spatialPredicateParser(
			dialect.SpatialPredicate3DIntersects,
			spatialOperatorGeometryOnly,
		),
		"_st_contains": spatialPredicateParser(
			dialect.SpatialPredicateContains,
			spatialOperatorGeometryOnly,
		),
		"_st_crosses": spatialPredicateParser(
			dialect.SpatialPredicateCrosses,
			spatialOperatorGeometryOnly,
		),
		"_st_d_within": spatialDWithinParser(false),
		"_st_equals": spatialPredicateParser(
			dialect.SpatialPredicateEquals,
			spatialOperatorGeometryOnly,
		),
		"_st_intersects": spatialPredicateParser(
			dialect.SpatialPredicateIntersects,
			spatialOperatorAnySpatial,
		),
		"_st_overlaps": spatialPredicateParser(
			dialect.SpatialPredicateOverlaps,
			spatialOperatorGeometryOnly,
		),
		"_st_touches": spatialPredicateParser(
			dialect.SpatialPredicateTouches,
			spatialOperatorGeometryOnly,
		),
		"_st_within": spatialPredicateParser(
			dialect.SpatialPredicateWithin,
			spatialOperatorGeometryOnly,
		),
	}
}
