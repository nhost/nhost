package where

import "errors"

var (
	errRegexUnsupportedByDialect = errors.New(
		"regex operators are not supported by the current dialect",
	)

	errExistsMustBeObject          = errors.New("_exists must be an object")
	errExistsTableMustBeObject     = errors.New("_exists._table must be an object")
	errExistsTableNameRequired     = errors.New("_exists._table.name is required")
	errExistsTableNotFound         = errors.New("table not found for _exists operator")
	errExpectedObjectValue         = errors.New("expected object value")
	errUnknownFieldInWhereClause   = errors.New("unknown field in where clause")
	errAndMustBeListOrObject       = errors.New("_and must be a list or an object")
	errOrMustBeListOrObject        = errors.New("_or must be a list or an object")
	errFieldComparisonMustBeObject = errors.New("field comparison must be an object")
	errUnknownWhereOperator        = errors.New("unknown operator")

	errAggregateOnNonArrayRelationship = errors.New(
		"aggregate filter is only valid on array relationships",
	)
	errAggregateRelationshipNoTarget = errors.New(
		"aggregate filter relationship has no local target table",
	)
	errUnknownAggregatePredicate = errors.New(
		"unknown aggregate predicate (expected count, bool_and, or bool_or)",
	)
	errAggregatePredicateRequired    = errors.New("aggregate predicate is required")
	errInvalidAggregateArguments     = errors.New("invalid aggregate arguments")
	errUnknownAggregateFilterColumn  = errors.New("unknown column in aggregate arguments")
	errAggregateArgumentsMustBeNames = errors.New("aggregate arguments must be column names")
)
