package nhmiddleware

import "errors"

var (
	ErrUnexpectSigningMethod      = errors.New("unexpected signing method")
	ErrMissingAuthorizationHeader = errors.New("missing authorization header")
	ErrNotAuthorized              = errors.New("not authorized")
	ErrWrongAdminSecret           = errors.New("you are not authorized")
)
