package oapi

import "fmt"

type AuthenticatorError struct {
	Scheme  string
	Code    string
	Message string
}

func (e *AuthenticatorError) Error() string {
	return fmt.Sprintf("security error [%s]: %s", e.Code, e.Message)
}
