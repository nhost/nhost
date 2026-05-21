package queries

import "errors"

var (
	errFieldDoesNotExist  = errors.New("field does not exist")
	errRemoteRelationship = errors.New(
		"remote relationship - handled by remote join executor",
	)
	errFunctionNotFound                = errors.New("function not found in introspection")
	errMissingRequiredFunctionArgument = errors.New("missing required function argument")

	// ErrNoRootsForRole is returned by Roots.BuildQuery when the Roots value has
	// no map for the operation kind of the request.
	ErrNoRootsForRole = errors.New("no roots found for role")
)
