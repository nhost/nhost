// Context wrappers are the 4th category of typed validation errors,
// alongside the Base / Cluster / Leaf model documented at the top of
// validation_error.go.
//
// A context wrapper carries scope (which section, path, operation,
// component, parameter, OAuth flow, ...) around an inner error chain.
// It does NOT itself report a validation failure — the actual error
// lives in Cause and is reachable via errors.Unwrap / errors.As.
//
// Use a context wrapper to extract "where the error happened" without
// parsing the rendered message. Combine with errors.As against the
// inner cluster or leaf to also extract "what category" and "exactly
// which case." A canonical error chain looks like:
//
//	ComponentValidationError{Section, Name}      // context wrapper: WHERE
//	  -> RequiredFieldError{Field}               // cluster: WHAT CATEGORY
//	    -> SomeFieldRequired{Message}            // leaf: EXACTLY WHICH CASE
//
// Two scopes of context wrapper live in this file:
//
//   - Document-wide wrappers — SectionValidationError,
//     PathValidationError, OperationValidationError. Cover entire
//     top-level scopes of the document.
//   - Narrow-scope wrappers — ComponentValidationError,
//     ExternalDocsURLValidationError, HeaderFieldValidationError,
//     MediaTypeExampleValidationError, WebhookValidationError,
//     ParameterFieldValidationError, ParameterExampleValidationError,
//     SecuritySchemeFlowValidationError, OAuthFlowValidationError,
//     OAuthFlowFieldValidationError, SchemaCombinatorElementValidationError,
//     TagValidationError. Cover a specific validation surface inside a
//     section.
//
// Both scopes follow the same shape:
//
//   - One or more discriminator fields naming the scope (Section,
//     Path, ParameterName + Field, etc.).
//   - A Cause error that holds the wrapped inner error.
//   - Unwrap() returns Cause so errors.As walks transparently to the
//     inner cluster or leaf.
//
// Error() formats vary per wrapper: each preserves the original
// fmt.Errorf-with-%w message format byte-for-byte for backward
// compatibility, so existing string-matching consumers see identical
// output. There is no canonical "<context>: <cause>" format across
// wrappers — read each type's Error() if the exact string matters.

package openapi3

import "fmt"

// SectionValidationError wraps an error originating inside one of the
// top-level OpenAPI document sections (info, paths, components,
// security, servers, tags, externalDocs, webhooks, jsonSchemaDialect).
// Section is the OpenAPI field name as it appears in the document
// root.
//
// Use errors.As(err, &sve) to extract the section context from a
// validation error chain without parsing the rendered message.
type SectionValidationError struct {
	Section string
	Cause   error
}

func (e *SectionValidationError) Error() string {
	return fmt.Sprintf("invalid %s: %v", e.Section, e.Cause)
}

func (e *SectionValidationError) Unwrap() error { return e.Cause }

// PathValidationError wraps an error originating inside a specific path.
// Path is the path template as it appears in the document (e.g.
// "/users/{id}").
//
// Use errors.As(err, &pve) to extract the path from a validation
// error chain without parsing the rendered message.
type PathValidationError struct {
	Path  string
	Cause error
}

func (e *PathValidationError) Error() string {
	return fmt.Sprintf("invalid path %s: %v", e.Path, e.Cause)
}

func (e *PathValidationError) Unwrap() error { return e.Cause }

// OperationValidationError wraps an error originating inside a specific
// HTTP-method operation under a path. Method is the uppercase method
// (GET, POST, etc.).
//
// Use errors.As(err, &ove) to extract the method from a validation
// error chain without parsing the rendered message.
type OperationValidationError struct {
	Method string
	Cause  error
}

func (e *OperationValidationError) Error() string {
	return fmt.Sprintf("invalid operation %s: %v", e.Method, e.Cause)
}

func (e *OperationValidationError) Unwrap() error { return e.Cause }

// Below: narrow-scope context wrappers covering specific validation
// surfaces inside a section. See the file-level header above for the
// full inventory and how these relate to the document-wide wrappers
// above.

// ComponentValidationError wraps validation errors inside the
// Components container, carrying which sub-section (Schemas,
// Parameters, etc.) and which component name failed.
type ComponentValidationError struct {
	// Section is the lowercase singular form of the component bucket
	// ("schema", "parameter", "header", "request body", "response",
	// "security scheme", "example", "link", "callback").
	Section string
	// Name is the component map key.
	Name  string
	Cause error
}

func (e *ComponentValidationError) Error() string {
	return fmt.Sprintf("%s %q: %v", e.Section, e.Name, e.Cause)
}

func (e *ComponentValidationError) Unwrap() error { return e.Cause }

// ExternalDocsURLValidationError wraps the URL parse failure on an
// ExternalDocs object.
type ExternalDocsURLValidationError struct {
	Cause error
}

func (e *ExternalDocsURLValidationError) Error() string {
	return fmt.Sprintf("url is incorrect: %v", e.Cause)
}

func (e *ExternalDocsURLValidationError) Unwrap() error { return e.Cause }

// HeaderFieldValidationError wraps validation errors on a Header's
// `schema` or `content` sub-objects. Field discriminates the two.
type HeaderFieldValidationError struct {
	// Field is "schema" or "content".
	Field string
	Cause error
}

func (e *HeaderFieldValidationError) Error() string {
	return fmt.Sprintf("header %s is invalid: %v", e.Field, e.Cause)
}

func (e *HeaderFieldValidationError) Unwrap() error { return e.Cause }

// MediaTypeExampleValidationError wraps validation errors on a named
// example inside a MediaType.examples map.
type MediaTypeExampleValidationError struct {
	// ExampleName is the example map key.
	ExampleName string
	Cause       error
}

func (e *MediaTypeExampleValidationError) Error() string {
	return fmt.Sprintf("example %s: %v", e.ExampleName, e.Cause)
}

func (e *MediaTypeExampleValidationError) Unwrap() error { return e.Cause }

// WebhookValidationError wraps validation errors on a named webhook
// at the document root (OpenAPI 3.1+).
type WebhookValidationError struct {
	// Name is the webhook map key.
	Name  string
	Cause error
}

func (e *WebhookValidationError) Error() string {
	return fmt.Sprintf("webhook %q: %v", e.Name, e.Cause)
}

func (e *WebhookValidationError) Unwrap() error { return e.Cause }

// ParameterFieldValidationError wraps validation errors on a
// parameter's `schema` or `content` sub-objects. Field discriminates.
type ParameterFieldValidationError struct {
	// ParameterName is the parameter's `name:` value.
	ParameterName string
	// Field is "schema" or "content".
	Field string
	Cause error
}

func (e *ParameterFieldValidationError) Error() string {
	return fmt.Sprintf("parameter %q %s is invalid: %v", e.ParameterName, e.Field, e.Cause)
}

func (e *ParameterFieldValidationError) Unwrap() error { return e.Cause }

// ParameterExampleValidationError wraps validation errors on a named
// example inside a parameter's examples map.
type ParameterExampleValidationError struct {
	// ExampleName is the example map key.
	ExampleName string
	Cause       error
}

func (e *ParameterExampleValidationError) Error() string {
	return fmt.Sprintf("%s: %v", e.ExampleName, e.Cause)
}

func (e *ParameterExampleValidationError) Unwrap() error { return e.Cause }

// SecuritySchemeFlowValidationError wraps validation errors on the
// outer flows object of an oauth2 security scheme.
type SecuritySchemeFlowValidationError struct {
	Cause error
}

func (e *SecuritySchemeFlowValidationError) Error() string {
	return fmt.Sprintf("security scheme 'flow' is invalid: %v", e.Cause)
}

func (e *SecuritySchemeFlowValidationError) Unwrap() error { return e.Cause }

// OAuthFlowValidationError wraps validation errors on a specific
// OAuth flow inside OAuthFlows.
type OAuthFlowValidationError struct {
	// FlowKind is one of "implicit", "password", "clientCredentials",
	// "authorizationCode".
	FlowKind string
	Cause    error
}

func (e *OAuthFlowValidationError) Error() string {
	return fmt.Sprintf("the OAuth flow %q is invalid: %v", e.FlowKind, e.Cause)
}

func (e *OAuthFlowValidationError) Unwrap() error { return e.Cause }

// OAuthFlowFieldValidationError wraps validation errors on a specific
// field inside an OAuthFlow object. Field discriminates which URL
// field failed.
type OAuthFlowFieldValidationError struct {
	// Field is the offending field name ("refreshUrl" is the only
	// site today; future URL fields can reuse the same wrapper).
	Field string
	Cause error
}

func (e *OAuthFlowFieldValidationError) Error() string {
	return fmt.Sprintf("field %q is invalid: %v", e.Field, e.Cause)
}

func (e *OAuthFlowFieldValidationError) Unwrap() error { return e.Cause }

// SchemaCombinatorElementValidationError wraps a validation error
// originating in one of the sub-schemas listed under a schema's oneOf,
// anyOf, or allOf keyword. Combinator names which keyword the offending
// element belongs to ("oneOf", "anyOf", "allOf"). The wrapper adds the
// combinator scope; the actual failure lives in Cause.
type SchemaCombinatorElementValidationError struct {
	// Combinator is the keyword whose element failed ("oneOf", "anyOf",
	// "allOf").
	Combinator string
	Cause      error
}

func (e *SchemaCombinatorElementValidationError) Error() string {
	// Collapse a run of same-combinator wrappers so deeply nested
	// allOf/anyOf/oneOf does not stutter "invalid allOf element: " once per
	// nesting level. The typed chain is untouched (Unwrap and errors.As still
	// see every level); only the rendered message drops the repeats. A run of
	// a different combinator is preserved, so an allOf inside a oneOf still
	// shows both scopes.
	cause := e.Cause
	for {
		inner, ok := cause.(*SchemaCombinatorElementValidationError)
		if !ok || inner.Combinator != e.Combinator {
			break
		}
		cause = inner.Cause
	}
	return fmt.Sprintf("invalid %s element: %v", e.Combinator, cause)
}

func (e *SchemaCombinatorElementValidationError) Unwrap() error { return e.Cause }

// TagValidationError wraps a validation error originating inside a single
// tag in the document-root Tags list. Name is the tag's `name:` value, so
// callers can tell which tag failed without parsing the rendered message.
type TagValidationError struct {
	// Name is the tag's `name:` value.
	Name  string
	Cause error
}

func (e *TagValidationError) Error() string {
	return fmt.Sprintf("tag %q: %v", e.Name, e.Cause)
}

func (e *TagValidationError) Unwrap() error { return e.Cause }
