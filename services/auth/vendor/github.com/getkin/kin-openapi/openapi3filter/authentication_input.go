package openapi3filter

import (
	"fmt"

	"github.com/getkin/kin-openapi/openapi3"
)

type AuthenticationInput struct {
	RequestValidationInput *RequestValidationInput
	SecuritySchemeName     string
	SecurityScheme         *openapi3.SecurityScheme
	Scopes                 []string
}

func (input *AuthenticationInput) NewError(err error) error {
	if err == nil {
		if len(input.Scopes) == 0 {
			err = fmt.Errorf("security requirement %q failed", input.SecuritySchemeName)
		} else {
			err = fmt.Errorf("security requirement %q (scopes: %+v) failed", input.SecuritySchemeName, input.Scopes)
		}
	}
	return &RequestError{
		Input:  input.RequestValidationInput,
		Reason: "authorization failed",
		Err:    err,
	}
}
