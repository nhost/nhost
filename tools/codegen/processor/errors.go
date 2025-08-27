package processor

import "errors"

var (
	ErrRequiredOptionMissing = errors.New("required option missing")
	ErrUnknownType           = errors.New("unknown type")
	ErrUnsupportedFeature    = errors.New("unsupported feature")
)
