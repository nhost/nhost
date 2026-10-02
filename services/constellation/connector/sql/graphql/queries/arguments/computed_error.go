package arguments

// ComputedOmissionError is the fixed Hasura error for omitting a non-default
// computed-function argument from an explicitly supplied args object. It is
// safe to surface without echoing argument names or client values.
type ComputedOmissionError struct{ argumentPath string }

// NewComputedOmissionError returns the only client-visible unsupported
// computed-argument error; arbitrary errors cannot be constructed via a
// message parameter.
func NewComputedOmissionError(argumentPath string) *ComputedOmissionError {
	return &ComputedOmissionError{argumentPath: argumentPath}
}

func (e *ComputedOmissionError) Error() string { return "Non default arguments cannot be omitted" }

// RemapArgumentPath restores client field names after connector customization
// or remote-relationship execution, without altering the safe error message.
func (e *ComputedOmissionError) RemapArgumentPath(remap func(string) string) {
	if e == nil || e.argumentPath == "" || remap == nil {
		return
	}

	if path := remap(e.argumentPath); path != "" {
		e.argumentPath = path
	}
}

// AsMap is the Hasura-compatible error envelope for this unsupported call.
func (e *ComputedOmissionError) AsMap() map[string]any {
	return map[string]any{
		"message": e.Error(),
		"extensions": map[string]any{
			"code": "not-supported",
			"path": "$.selectionSet." + e.argumentPath + ".args.args",
		},
	}
}
