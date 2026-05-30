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
	errIsNullMustBeBoolean         = errors.New("_is_null must be a boolean")
	errFieldComparisonMustBeObject = errors.New("field comparison must be an object")
	errUnknownWhereOperator        = errors.New("unknown operator")
)
