package openapi3filter

import "github.com/getkin/kin-openapi/openapi3"

// Options used by ValidateRequest and ValidateResponse
type Options struct {
	// Set ExcludeRequestBody so ValidateRequest skips request body validation
	ExcludeRequestBody bool

	// Set ExcludeRequestQueryParams so ValidateRequest skips request query params validation
	ExcludeRequestQueryParams bool

	// Set ExcludeResponseBody so ValidateResponse skips response body validation
	ExcludeResponseBody bool

	// Set ExcludeReadOnlyValidations so ValidateRequest skips read-only validations
	ExcludeReadOnlyValidations bool

	// Set ExcludeWriteOnlyValidations so ValidateResponse skips write-only validations
	ExcludeWriteOnlyValidations bool

	// Set IncludeResponseStatus so ValidateResponse fails on response
	// status not defined in OpenAPI spec
	IncludeResponseStatus bool

	MultiError bool

	// Set RegexCompiler to override the regex implementation
	RegexCompiler openapi3.RegexCompilerFunc

	// A document with security schemes defined will not pass validation
	// unless an AuthenticationFunc is defined.
	// See NoopAuthenticationFunc
	AuthenticationFunc AuthenticationFunc

	// Indicates whether default values are set in the
	// request. If true, then they are not set
	SkipSettingDefaults bool

	customSchemaErrorFunc CustomSchemaErrorFunc
}

// CustomSchemaErrorFunc allows for custom the schema error message.
type CustomSchemaErrorFunc func(err *openapi3.SchemaError) string

// WithCustomSchemaErrorFunc sets a function to override the schema error message.
// If the passed function returns an empty string, it returns to the previous Error() implementation.
func (o *Options) WithCustomSchemaErrorFunc(f CustomSchemaErrorFunc) {
	o.customSchemaErrorFunc = f
}
