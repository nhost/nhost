package openapi3filter

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"

	"github.com/getkin/kin-openapi/openapi3"
)

// ErrAuthenticationServiceMissing is returned when no authentication service
// is defined for the request validator
var ErrAuthenticationServiceMissing = errors.New("missing AuthenticationFunc")

// ErrInvalidRequired is returned when a required value of a parameter or request body is not defined.
var ErrInvalidRequired = errors.New("value is required but missing")

// ErrInvalidEmptyValue is returned when a value of a parameter or request body is empty while it's not allowed.
var ErrInvalidEmptyValue = errors.New("empty value is not allowed")

// ValidateRequest is used to validate the given input according to previous
// loaded OpenAPIv3 spec. If the input does not match the OpenAPIv3 spec, a
// non-nil error will be returned.
//
// Note: One can tune the behavior of uniqueItems: true verification
// by registering a custom function with openapi3.RegisterArrayUniqueItemsChecker
func ValidateRequest(ctx context.Context, input *RequestValidationInput) error {
	var me openapi3.MultiError

	options := input.Options
	if options == nil {
		options = &Options{}
	}
	route := input.Route
	operation := route.Operation
	operationParameters := operation.Parameters
	pathItemParameters := route.PathItem.Parameters

	// Security
	security := operation.Security
	// If there aren't any security requirements for the operation
	if security == nil {
		// Use the global security requirements.
		security = &route.Spec.Security
	}
	if security != nil {
		if err := ValidateSecurityRequirements(ctx, input, *security); err != nil {
			if !options.MultiError {
				return err
			}
			me = append(me, err)
		}
	}

	// For each parameter of the PathItem
	for _, parameterRef := range pathItemParameters {
		parameter := parameterRef.Value
		if operationParameters != nil {
			if override := operationParameters.GetByInAndName(parameter.In, parameter.Name); override != nil {
				continue
			}
		}

		if err := ValidateParameter(ctx, input, parameter); err != nil {
			if !options.MultiError {
				return err
			}
			me = append(me, err)
		}
	}

	// For each parameter of the Operation
	for _, parameter := range operationParameters {
		if options.ExcludeRequestQueryParams && parameter.Value.In == openapi3.ParameterInQuery {
			continue
		}
		if err := ValidateParameter(ctx, input, parameter.Value); err != nil {
			if !options.MultiError {
				return err
			}
			me = append(me, err)
		}
	}

	// RequestBody
	requestBody := operation.RequestBody
	if requestBody != nil && !options.ExcludeRequestBody {
		if err := ValidateRequestBody(ctx, input, requestBody.Value); err != nil {
			if !options.MultiError {
				return err
			}
			me = append(me, err)
		}
	}

	if len(me) > 0 {
		return me
	}
	return nil
}

// appendToQueryValues adds to query parameters each value in the provided slice
func appendToQueryValues[T any](q url.Values, parameterName string, v []T) {
	for _, i := range v {
		q.Add(parameterName, fmt.Sprintf("%v", i))
	}
}

func joinValues(values []any, sep string) string {
	strValues := make([]string, 0, len(values))
	for _, v := range values {
		strValues = append(strValues, fmt.Sprintf("%v", v))
	}
	return strings.Join(strValues, sep)
}

// populateDefaultQueryParameters populates default values inside query parameters, while ensuring types are respected
func populateDefaultQueryParameters(q url.Values, parameterName string, value any, explode bool) {
	switch t := value.(type) {
	case []any:
		if explode {
			appendToQueryValues(q, parameterName, t)
		} else {
			q.Add(parameterName, joinValues(t, ","))
		}
	default:
		q.Add(parameterName, fmt.Sprintf("%v", value))
	}
}

// ValidateParameter validates a parameter's value by JSON schema.
// The function returns RequestError with a ParseError cause when unable to parse a value.
// The function returns RequestError with ErrInvalidRequired cause when a value of a required parameter is not defined.
// The function returns RequestError with ErrInvalidEmptyValue cause when a value of a required parameter is not defined.
// The function returns RequestError with a openapi3.SchemaError cause when a value is invalid by JSON schema.
func ValidateParameter(ctx context.Context, input *RequestValidationInput, parameter *openapi3.Parameter) error {
	if parameter.Schema == nil && parameter.Content == nil {
		// We have no schema for the parameter. Assume that everything passes
		// a schema-less check, but this could also be an error. The OpenAPI
		// validation allows this to happen.
		return nil
	}

	options := input.Options
	if options == nil {
		options = &Options{}
	}

	var value any
	var err error
	var found bool
	var schema *openapi3.Schema

	// Validation will ensure that we either have content or schema.
	if parameter.Content != nil {
		if value, schema, found, err = decodeContentParameter(parameter, input); err != nil {
			return &RequestError{Input: input, Parameter: parameter, Err: err}
		}
	} else {
		if value, found, err = decodeStyledParameter(parameter, input); err != nil {
			return &RequestError{Input: input, Parameter: parameter, Err: err}
		}
		schema = parameter.Schema.Value
	}

	// Set default value if needed
	if !options.SkipSettingDefaults && value == nil && schema != nil {
		value = schema.Default
		for _, subSchema := range schema.AllOf {
			if subSchema.Value.Default != nil {
				value = subSchema.Value.Default
				break // This is not a validation of the schema itself, so use the first default value.
			}
		}

		if value != nil {
			req := input.Request
			switch parameter.In {
			case openapi3.ParameterInPath:
				// Path parameters are required.
				// Next check `parameter.Required && !found` will catch this.
			case openapi3.ParameterInQuery:
				q := req.URL.Query()
				explode := parameter.Explode != nil && *parameter.Explode
				populateDefaultQueryParameters(q, parameter.Name, value, explode)
				req.URL.RawQuery = q.Encode()
			case openapi3.ParameterInHeader:
				req.Header.Add(parameter.Name, fmt.Sprintf("%v", value))
			case openapi3.ParameterInCookie:
				req.AddCookie(&http.Cookie{
					Name:  parameter.Name,
					Value: fmt.Sprintf("%v", value),
				})
			}
		}
	}

	// Validate a parameter's value and presence.
	if parameter.Required && !found {
		return &RequestError{Input: input, Parameter: parameter, Reason: ErrInvalidRequired.Error(), Err: ErrInvalidRequired}
	}

	if isNilValue(value) {
		if !parameter.AllowEmptyValue && found {
			return &RequestError{Input: input, Parameter: parameter, Reason: ErrInvalidEmptyValue.Error(), Err: ErrInvalidEmptyValue}
		}
		return nil
	}
	if schema == nil {
		// A parameter's schema is not defined so skip validation of a parameter's value.
		return nil
	}

	var opts []openapi3.SchemaValidationOption
	if options.MultiError {
		opts = make([]openapi3.SchemaValidationOption, 0, 1)
		opts = append(opts, openapi3.MultiErrors())
	}
	if options.customSchemaErrorFunc != nil {
		opts = append(opts, openapi3.SetSchemaErrorMessageCustomizer(options.customSchemaErrorFunc))
	}
	if err = schema.VisitJSON(value, opts...); err != nil {
		return &RequestError{Input: input, Parameter: parameter, Err: err}
	}
	return nil
}

const prefixInvalidCT = "header Content-Type has unexpected value"

// ValidateRequestBody validates data of a request's body.
//
// The function returns RequestError with ErrInvalidRequired cause when a value is required but not defined.
// The function returns RequestError with a openapi3.SchemaError cause when a value is invalid by JSON schema.
func ValidateRequestBody(ctx context.Context, input *RequestValidationInput, requestBody *openapi3.RequestBody) error {
	var (
		req  = input.Request
		data []byte
	)

	options := input.Options
	if options == nil {
		options = &Options{}
	}

	if req.Body != http.NoBody && req.Body != nil {
		defer req.Body.Close()
		var err error
		if data, err = io.ReadAll(req.Body); err != nil {
			return &RequestError{
				Input:       input,
				RequestBody: requestBody,
				Reason:      "reading failed",
				Err:         err,
			}
		}
		// Put the data back into the input
		req.Body = nil
		if req.GetBody != nil {
			if req.Body, err = req.GetBody(); err != nil {
				req.Body = nil
			}
		}
		if req.Body == nil {
			req.ContentLength = int64(len(data))
			req.GetBody = func() (io.ReadCloser, error) {
				return io.NopCloser(bytes.NewReader(data)), nil
			}
			req.Body, _ = req.GetBody() // no error return
		}
	}

	if len(data) == 0 {
		if requestBody.Required {
			return &RequestError{Input: input, RequestBody: requestBody, Err: ErrInvalidRequired}
		}
		return nil
	}

	content := requestBody.Content
	if len(content) == 0 {
		// A request's body does not have declared content, so skip validation.
		return nil
	}

	inputMIME := req.Header.Get(headerCT)
	contentType := requestBody.Content.Get(inputMIME)
	if contentType == nil {
		return &RequestError{
			Input:       input,
			RequestBody: requestBody,
			Reason:      fmt.Sprintf("%s %q", prefixInvalidCT, inputMIME),
		}
	}

	if contentType.Schema == nil {
		// A JSON schema that describes the received data is not declared, so skip validation.
		return nil
	}

	encFn := func(name string) *openapi3.Encoding { return contentType.Encoding[name] }
	mediaType, value, err := decodeBody(bytes.NewReader(data), req.Header, contentType.Schema, encFn)
	if err != nil {
		return &RequestError{
			Input:       input,
			RequestBody: requestBody,
			Reason:      "failed to decode request body",
			Err:         err,
		}
	}

	defaultsSet := false
	opts := make([]openapi3.SchemaValidationOption, 0, 4) // 4 potential opts here
	opts = append(opts, openapi3.VisitAsRequest())
	if !options.SkipSettingDefaults {
		opts = append(opts, openapi3.DefaultsSet(func() { defaultsSet = true }))
	}
	if options.MultiError {
		opts = append(opts, openapi3.MultiErrors())
	}
	if options.customSchemaErrorFunc != nil {
		opts = append(opts, openapi3.SetSchemaErrorMessageCustomizer(options.customSchemaErrorFunc))
	}
	if options.ExcludeReadOnlyValidations {
		opts = append(opts, openapi3.DisableReadOnlyValidation())
	}
	if options.RegexCompiler != nil {
		opts = append(opts, openapi3.SetSchemaRegexCompiler(options.RegexCompiler))
	}

	// Validate JSON with the schema
	if err := contentType.Schema.Value.VisitJSON(value, opts...); err != nil {
		schemaId := getSchemaIdentifier(contentType.Schema)
		schemaId = prependSpaceIfNeeded(schemaId)
		return &RequestError{
			Input:       input,
			RequestBody: requestBody,
			Reason:      fmt.Sprintf("doesn't match schema%s", schemaId),
			Err:         err,
		}
	}

	if defaultsSet {
		var err error
		if data, err = encodeBody(value, mediaType); err != nil {
			return &RequestError{
				Input:       input,
				RequestBody: requestBody,
				Reason:      "rewriting failed",
				Err:         err,
			}
		}
		// Put the data back into the input
		if req.Body != nil {
			req.Body.Close()
		}
		req.ContentLength = int64(len(data))
		req.GetBody = func() (io.ReadCloser, error) {
			return io.NopCloser(bytes.NewReader(data)), nil
		}
		req.Body, _ = req.GetBody() // no error return
	}

	return nil
}

// ValidateSecurityRequirements goes through multiple OpenAPI 3 security
// requirements in order and returns nil on the first valid requirement.
// If no requirement is met, errors are returned in order.
func ValidateSecurityRequirements(ctx context.Context, input *RequestValidationInput, srs openapi3.SecurityRequirements) error {
	if len(srs) == 0 {
		return nil
	}
	var errs []error
	for _, sr := range srs {
		if err := validateSecurityRequirement(ctx, input, sr); err != nil {
			if len(errs) == 0 {
				errs = make([]error, 0, len(srs))
			}
			errs = append(errs, err)
			continue
		}
		return nil
	}
	return &SecurityRequirementsError{
		SecurityRequirements: srs,
		Errors:               errs,
	}
}

// validateSecurityRequirement validates a single OpenAPI 3 security requirement
func validateSecurityRequirement(ctx context.Context, input *RequestValidationInput, securityRequirement openapi3.SecurityRequirement) error {
	names := make([]string, 0, len(securityRequirement))
	for name := range securityRequirement {
		names = append(names, name)
	}
	sort.Strings(names)

	// Get authentication function
	options := input.Options
	if options == nil {
		options = &Options{}
	}
	f := options.AuthenticationFunc
	if f == nil {
		return ErrAuthenticationServiceMissing
	}

	var securitySchemes openapi3.SecuritySchemes
	if components := input.Route.Spec.Components; components != nil {
		securitySchemes = components.SecuritySchemes
	}

	// For each scheme for the requirement
	for _, name := range names {
		var securityScheme *openapi3.SecurityScheme
		if securitySchemes != nil {
			if ref := securitySchemes[name]; ref != nil {
				securityScheme = ref.Value
			}
		}
		if securityScheme == nil {
			return &RequestError{
				Input: input,
				Err:   fmt.Errorf("security scheme %q is not declared", name),
			}
		}
		scopes := securityRequirement[name]
		if err := f(ctx, &AuthenticationInput{
			RequestValidationInput: input,
			SecuritySchemeName:     name,
			SecurityScheme:         securityScheme,
			Scopes:                 scopes,
		}); err != nil {
			return err
		}
	}
	return nil
}
