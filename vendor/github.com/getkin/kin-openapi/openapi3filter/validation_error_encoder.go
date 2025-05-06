package openapi3filter

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/routers"
)

// ValidationErrorEncoder wraps a base ErrorEncoder to handle ValidationErrors
type ValidationErrorEncoder struct {
	Encoder ErrorEncoder
}

// Encode implements the ErrorEncoder interface for encoding ValidationErrors
func (enc *ValidationErrorEncoder) Encode(ctx context.Context, err error, w http.ResponseWriter) {
	enc.Encoder(ctx, ConvertErrors(err), w)
}

// ConvertErrors converts all errors to the appropriate error format.
func ConvertErrors(err error) error {
	if e, ok := err.(*routers.RouteError); ok {
		return convertRouteError(e)
	}

	e, ok := err.(*RequestError)
	if !ok {
		return err
	}

	var cErr *ValidationError
	if e.Err == nil {
		cErr = convertBasicRequestError(e)
	} else if e.Err == ErrInvalidRequired {
		cErr = convertErrInvalidRequired(e)
	} else if e.Err == ErrInvalidEmptyValue {
		cErr = convertErrInvalidEmptyValue(e)
	} else if innerErr, ok := e.Err.(*ParseError); ok {
		cErr = convertParseError(e, innerErr)
	} else if innerErr, ok := e.Err.(*openapi3.SchemaError); ok {
		cErr = convertSchemaError(e, innerErr)
	}

	if cErr != nil {
		return cErr
	}
	return err
}

func convertRouteError(e *routers.RouteError) *ValidationError {
	status := http.StatusNotFound
	if e.Error() == routers.ErrMethodNotAllowed.Error() {
		status = http.StatusMethodNotAllowed
	}
	return &ValidationError{Status: status, Title: e.Error()}
}

func convertBasicRequestError(e *RequestError) *ValidationError {
	if strings.HasPrefix(e.Reason, prefixInvalidCT) {
		if strings.HasSuffix(e.Reason, `""`) {
			return &ValidationError{
				Status: http.StatusUnsupportedMediaType,
				Title:  "header Content-Type is required",
			}
		}
		return &ValidationError{
			Status: http.StatusUnsupportedMediaType,
			Title:  prefixUnsupportedCT + strings.TrimPrefix(e.Reason, prefixInvalidCT),
		}
	}
	return &ValidationError{
		Status: http.StatusBadRequest,
		Title:  e.Error(),
	}
}

func convertErrInvalidRequired(e *RequestError) *ValidationError {
	if e.Err == ErrInvalidRequired && e.Parameter != nil {
		return &ValidationError{
			Status: http.StatusBadRequest,
			Title:  fmt.Sprintf("parameter %q in %s is required", e.Parameter.Name, e.Parameter.In),
		}
	}
	return &ValidationError{
		Status: http.StatusBadRequest,
		Title:  e.Error(),
	}
}

func convertErrInvalidEmptyValue(e *RequestError) *ValidationError {
	if e.Err == ErrInvalidEmptyValue && e.Parameter != nil {
		return &ValidationError{
			Status: http.StatusBadRequest,
			Title:  fmt.Sprintf("parameter %q in %s is not allowed to be empty", e.Parameter.Name, e.Parameter.In),
		}
	}
	return &ValidationError{
		Status: http.StatusBadRequest,
		Title:  e.Error(),
	}
}

func convertParseError(e *RequestError, innerErr *ParseError) *ValidationError {
	// We treat path params of the wrong type like a 404 instead of a 400
	if innerErr.Kind == KindInvalidFormat && e.Parameter != nil && e.Parameter.In == "path" {
		return &ValidationError{
			Status: http.StatusNotFound,
			Title:  fmt.Sprintf("resource not found with %q value: %v", e.Parameter.Name, innerErr.Value),
		}
	} else if strings.HasPrefix(innerErr.Reason, prefixUnsupportedCT) {
		return &ValidationError{
			Status: http.StatusUnsupportedMediaType,
			Title:  innerErr.Reason,
		}
	} else if innerErr.RootCause() != nil {
		if rootErr, ok := innerErr.Cause.(*ParseError); ok &&
			rootErr.Kind == KindInvalidFormat && e.Parameter.In == "query" {
			return &ValidationError{
				Status: http.StatusBadRequest,
				Title: fmt.Sprintf("parameter %q in %s is invalid: %v is %s",
					e.Parameter.Name, e.Parameter.In, rootErr.Value, rootErr.Reason),
			}
		}
		return &ValidationError{
			Status: http.StatusBadRequest,
			Title:  innerErr.Reason,
		}
	}
	return nil
}

func convertSchemaError(e *RequestError, innerErr *openapi3.SchemaError) *ValidationError {
	cErr := &ValidationError{Title: innerErr.Reason}

	// Handle "Origin" error
	if originErr, ok := innerErr.Origin.(*openapi3.SchemaError); ok {
		cErr = convertSchemaError(e, originErr)
	}

	// Add http status code
	if e.Parameter != nil {
		cErr.Status = http.StatusBadRequest
	} else if e.RequestBody != nil {
		cErr.Status = http.StatusUnprocessableEntity
	}

	// Add error source
	if e.Parameter != nil {
		// We have a JSONPointer in the query param too so need to
		// make sure 'Parameter' check takes priority over 'Pointer'
		cErr.Source = &ValidationErrorSource{Parameter: e.Parameter.Name}
	} else if ptr := innerErr.JSONPointer(); ptr != nil {
		cErr.Source = &ValidationErrorSource{Pointer: toJSONPointer(ptr)}
	}

	// Add details on allowed values for enums
	if innerErr.SchemaField == "enum" {
		enums := make([]string, 0, len(innerErr.Schema.Enum))
		for _, enum := range innerErr.Schema.Enum {
			enums = append(enums, fmt.Sprint(enum))
		}
		cErr.Detail = fmt.Sprintf("value %v at %s must be one of: %s",
			innerErr.Value,
			toJSONPointer(innerErr.JSONPointer()),
			strings.Join(enums, ", "))
		value := fmt.Sprint(innerErr.Value)
		if e.Parameter != nil &&
			(e.Parameter.Explode == nil || *e.Parameter.Explode) &&
			(e.Parameter.Style == "" || e.Parameter.Style == "form") &&
			strings.Contains(value, ",") {
			parts := strings.Split(value, ",")
			cErr.Detail = fmt.Sprintf("%s; perhaps you intended '?%s=%s'",
				cErr.Detail,
				e.Parameter.Name,
				strings.Join(parts, "&"+e.Parameter.Name+"="))
		}
	}
	return cErr
}

func toJSONPointer(reversePath []string) string {
	return "/" + strings.Join(reversePath, "/")
}
