// Package openapi3filter validates that requests and inputs request an OpenAPI 3 specification file.
package openapi3filter

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"

	"github.com/getkin/kin-openapi/openapi3"
)

// ValidateResponse is used to validate the given input according to previous
// loaded OpenAPIv3 spec. If the input does not match the OpenAPIv3 spec, a
// non-nil error will be returned.
//
// Note: One can tune the behavior of uniqueItems: true verification
// by registering a custom function with openapi3.RegisterArrayUniqueItemsChecker
func ValidateResponse(ctx context.Context, input *ResponseValidationInput) error {
	req := input.RequestValidationInput.Request
	switch req.Method {
	case "HEAD":
		return nil
	}
	status := input.Status

	// These status codes will never be validated.
	// TODO: The list is probably missing some.
	switch status {
	case http.StatusNotModified,
		http.StatusPermanentRedirect,
		http.StatusTemporaryRedirect,
		http.StatusMovedPermanently:
		return nil
	}
	route := input.RequestValidationInput.Route
	options := input.Options
	if options == nil {
		options = &Options{}
	}

	// Find input for the current status
	responses := route.Operation.Responses
	if responses.Len() == 0 {
		return nil
	}
	responseRef := responses.Status(status) // Response
	if responseRef == nil {
		responseRef = responses.Default() // Default input
	}
	if responseRef == nil {
		// By default, status that is not documented is allowed.
		if !options.IncludeResponseStatus {
			return nil
		}
		return &ResponseError{Input: input, Reason: "status is not supported"}
	}
	response := responseRef.Value
	if response == nil {
		return &ResponseError{Input: input, Reason: "response has not been resolved"}
	}

	opts := make([]openapi3.SchemaValidationOption, 0, 3) // 3 potential options here
	if options.MultiError {
		opts = append(opts, openapi3.MultiErrors())
	}
	if options.customSchemaErrorFunc != nil {
		opts = append(opts, openapi3.SetSchemaErrorMessageCustomizer(options.customSchemaErrorFunc))
	}
	if options.ExcludeWriteOnlyValidations {
		opts = append(opts, openapi3.DisableWriteOnlyValidation())
	}

	headers := make([]string, 0, len(response.Headers))
	for k := range response.Headers {
		if k != headerCT {
			headers = append(headers, k)
		}
	}
	sort.Strings(headers)
	for _, headerName := range headers {
		headerRef := response.Headers[headerName]
		if err := validateResponseHeader(headerName, headerRef, input, opts); err != nil {
			return err
		}
	}

	if options.ExcludeResponseBody {
		// A user turned off validation of a response's body.
		return nil
	}

	content := response.Content
	if len(content) == 0 {
		// An operation does not contains a validation schema for responses with this status code.
		return nil
	}

	inputMIME := input.Header.Get(headerCT)
	contentType := content.Get(inputMIME)
	if contentType == nil {
		return &ResponseError{
			Input:  input,
			Reason: fmt.Sprintf("response %s: %q", prefixInvalidCT, inputMIME),
		}
	}

	if contentType.Schema == nil {
		// An operation does not contains a validation schema for responses with this status code.
		return nil
	}

	// Read response's body.
	body := input.Body

	// Response would contain partial or empty input body
	// after we begin reading.
	// Ensure that this doesn't happen.
	input.Body = nil

	// Ensure we close the reader
	defer body.Close()

	// Read all
	data, err := io.ReadAll(body)
	if err != nil {
		return &ResponseError{
			Input:  input,
			Reason: "failed to read response body",
			Err:    err,
		}
	}

	// Put the data back into the response.
	input.SetBodyBytes(data)

	encFn := func(name string) *openapi3.Encoding { return contentType.Encoding[name] }
	_, value, err := decodeBody(bytes.NewBuffer(data), input.Header, contentType.Schema, encFn)
	if err != nil {
		return &ResponseError{
			Input:  input,
			Reason: "failed to decode response body",
			Err:    err,
		}
	}

	// Validate data with the schema.
	if err := contentType.Schema.Value.VisitJSON(value, append(opts, openapi3.VisitAsResponse())...); err != nil {
		schemaId := getSchemaIdentifier(contentType.Schema)
		schemaId = prependSpaceIfNeeded(schemaId)
		return &ResponseError{
			Input:  input,
			Reason: fmt.Sprintf("response body doesn't match schema%s", schemaId),
			Err:    err,
		}
	}
	return nil
}

func validateResponseHeader(headerName string, headerRef *openapi3.HeaderRef, input *ResponseValidationInput, opts []openapi3.SchemaValidationOption) error {
	var err error
	var decodedValue any
	var found bool
	var sm *openapi3.SerializationMethod
	dec := &headerParamDecoder{header: input.Header}

	if sm, err = headerRef.Value.SerializationMethod(); err != nil {
		return &ResponseError{
			Input:  input,
			Reason: fmt.Sprintf("unable to get header %q serialization method", headerName),
			Err:    err,
		}
	}

	if decodedValue, found, err = decodeValue(dec, headerName, sm, headerRef.Value.Schema, headerRef.Value.Required); err != nil {
		return &ResponseError{
			Input:  input,
			Reason: fmt.Sprintf("unable to decode header %q value", headerName),
			Err:    err,
		}
	}

	if found {
		if err = headerRef.Value.Schema.Value.VisitJSON(decodedValue, opts...); err != nil {
			return &ResponseError{
				Input:  input,
				Reason: fmt.Sprintf("response header %q doesn't match schema", headerName),
				Err:    err,
			}
		}
	} else if headerRef.Value.Required {
		return &ResponseError{
			Input:  input,
			Reason: fmt.Sprintf("response header %q missing", headerName),
		}
	}
	return nil
}

// getSchemaIdentifier gets something by which a schema could be identified.
// A schema by itself doesn't have a true identity field. This function makes
// a best effort to get a value that can fill that void.
func getSchemaIdentifier(schema *openapi3.SchemaRef) string {
	var id string

	if schema != nil {
		id = strings.TrimSpace(schema.Ref)
	}
	if id == "" && schema.Value != nil {
		id = strings.TrimSpace(schema.Value.Title)
	}

	return id
}

func prependSpaceIfNeeded(value string) string {
	if len(value) > 0 {
		value = " " + value
	}
	return value
}
