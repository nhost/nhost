package arguments

import "fmt"

// NewComputedJSONPathError returns a trusted validation failure for a JSON
// selection path rejected before SQL construction. The path was supplied by
// the client and is echoed in the same diagnostic Hasura uses.
func NewComputedJSONPathError(path string) *QueryValidationError {
	message := fmt.Sprintf(
		"parse json path error: %s. Accept letters, digits, underscore (_) or hyphen (-) only. "+
			`Use quotes enclosed in bracket (["..."]) if there is any special character`,
		path,
	)

	return newQueryValidationError(message, fmt.Errorf("%w: %s", ErrInvalidArgument, message), "")
}
