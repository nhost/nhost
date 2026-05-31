package queries

import "errors"

var (
	errFieldDoesNotExist  = errors.New("field does not exist")
	errRemoteRelationship = errors.New(
		"remote relationship - handled by remote join executor",
	)
	errFunctionNotFound = errors.New(
		"function not found in introspection",
	)
	errMissingRequiredFunctionArgument = errors.New(
		"missing required function argument",
	)
	errCannotCallFunctionArgumentPositionally = errors.New(
		"cannot omit a defaulted function argument before a later supplied unnamed argument",
	)

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
	errTableNotFoundInIntrospection  = errors.New(
		"unable to find table in introspection objects",
	)

	// ErrNoRootsForRole is returned by Roots.BuildQuery when the Roots value has
	// no map for the operation kind of the request.
	ErrNoRootsForRole = errors.New("no roots found for role")
)
