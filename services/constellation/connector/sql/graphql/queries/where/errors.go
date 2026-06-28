package where

import "errors"

var (
	errRegexUnsupportedByDialect = errors.New(
		"regex operators are not supported by the current dialect",
	)
	errSpatialUnsupportedByDialect = errors.New(
		"spatial operators are not supported by the current dialect",
	)
	errSpatialOperatorOnNonSpatialColumn = errors.New(
		"spatial operator requires a geometry or geography column",
	)
	errSpatialOperatorOnWrongType = errors.New(
		"spatial operator is not supported for this spatial type",
	)
	errSpatialCastMustBeObject        = errors.New("_cast must be an object")
	errSpatialCastTargetInvalid       = errors.New("invalid spatial cast target")
	errSpatialDWithinMustBeObject     = errors.New("_st_d_within input must be an object")
	errSpatialDWithinFromRequired     = errors.New("_st_d_within.from is required")
	errSpatialDWithinDistanceRequired = errors.New(
		"_st_d_within.distance is required",
	)
	errSpatialDWithinUseSpheroidMustBeBoolean = errors.New(
		"_st_d_within.use_spheroid must be a boolean",
	)

	errExistsMustBeObject          = errors.New("_exists must be an object")
	errExistsTableMustBeObject     = errors.New("_exists._table must be an object")
	errExistsTableNameRequired     = errors.New("_exists._table.name is required")
	errExistsTableNotFound         = errors.New("table not found for _exists operator")
	errExpectedObjectValue         = errors.New("expected object value")
	errUnknownFieldInWhereClause   = errors.New("unknown field in where clause")
	errAndMustBeListOrObject       = errors.New("_and must be a list or an object")
	errOrMustBeListOrObject        = errors.New("_or must be a list or an object")
	errIsNullMustBeBoolean         = errors.New("_is_null must be a boolean")
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
