package queries

import "errors"

var (
	errFieldDoesNotExist  = errors.New("field does not exist")
	errRemoteRelationship = errors.New(
		"remote relationship - handled by remote join executor",
	)
	errFunctionNotFound                = errors.New("function not found in introspection")
	errMissingRequiredFunctionArgument = errors.New("missing required function argument")

	errFunctionDoesNotReturnTableType = errors.New("function does not return a table type")
	errArgsMustBeObject               = errors.New("args must be an object")

	errNestedInsertTargetTableType = errors.New(
		"nested insert target table has unexpected type",
	)
	errPartitionedParentCTECountMismatch = errors.New("partitioned parent CTE count mismatch")

	errRelationshipTargetTableNotFound = errors.New(
		"unable to find relationship target table",
	)
	errRelationshipTargetTableObjectNotFound = errors.New(
		"unable to find relationship target table object",
	)
	errRemoteRelationshipRequiresManualConfig = errors.New(
		"remote relationship requires manual_configuration",
	)
	errRemoteSchemaRelationshipRequiresManualConfig = errors.New(
		"remote schema relationship requires manual_configuration",
	)
	errRemoteSchemaRelationshipRequiresRemoteSchema = errors.New(
		"remote schema relationship requires remote_schema",
	)
	errRelationshipTargetTableIntrospectionNotFound = errors.New(
		"target table not found in introspection",
	)
	errRelationshipReverseFKColumnUnmatched = errors.New(
		"reverse-FK column has no matching foreign key on the target table",
	)

	errUnknownJoinColumn             = errors.New("unknown join column")
	errStreamBatchSizeMustBePositive = errors.New("stream batch_size must be positive")
	errNoOperationForFieldInRole     = errors.New("no operation found for field in role")
	errUnknownAggregateColumn        = errors.New("unknown column")
	errInvalidCountArgument          = errors.New("invalid count argument")
	errTableNotFoundInIntrospection  = errors.New(
		"unable to find table in introspection objects",
	)

	// ErrNoRootsForRole is returned by Roots.BuildQuery when the Roots value has
	// no map for the operation kind of the request.
	ErrNoRootsForRole = errors.New("no roots found for role")

	// ErrUnsupportedVarianceAggregate is wrapped when an aggregate selection
	// requests a stddev/variance-family function (stddev, stddev_pop,
	// stddev_samp, var_pop, var_samp, variance) on a backend that has no such
	// aggregate function (SQLite). Schema generation already omits these fields,
	// so a schema-validated request never reaches the builder; this guards
	// callers that bypass validation, turning what would be an opaque "no such
	// function" execution error into a clear typed error that the HTTP layer can
	// errors.Is-classify as a client error. It is the aggregate-selection
	// counterpart to arguments.ErrUnsupportedAggregateOrderBy.
	ErrUnsupportedVarianceAggregate = errors.New(
		"stddev/variance aggregates are not supported on this database backend",
	)
)
