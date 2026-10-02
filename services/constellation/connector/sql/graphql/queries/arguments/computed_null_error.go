package arguments

import "fmt"

// NewComputedNullArgumentError mirrors Hasura's validation response when a
// computed field receives an explicit null args object or JSON path.
func NewComputedNullArgumentError(argumentName, typeName string) *QueryValidationError {
	article, kind := "a", "string"
	if argumentName == "args" {
		article, kind = "an", "object"
	}

	message := fmt.Sprintf("expected %s %s for type '%s', but found null", article, kind, typeName)

	return newQueryValidationError(
		message,
		fmt.Errorf("%w: %s", ErrInvalidArgument, message),
		argumentName,
	)
}
