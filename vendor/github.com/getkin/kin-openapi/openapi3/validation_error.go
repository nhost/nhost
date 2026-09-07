package openapi3

import "fmt"

// ValidationError is the embedded base for every typed validation error
// emitted by the document validation walker (T.Validate, Info.Validate,
// Paths.Validate, etc.). Four categories of typed error are exposed;
// pick whichever the caller needs:
//
//  1. Base — *ValidationError. Catchall for "this is a validation
//     issue, here is the message". Reachable from any leaf via the As
//     method that each leaf implements.
//  2. Cluster — types like *RequiredFieldError or
//     *FieldVersionMismatchError. Group families of related failures
//     and expose the family-level metadata (Field, MinVersion, ...).
//     Wrap the underlying leaf via Unwrap, so errors.As can still walk
//     to the leaf. Some clusters are single-site (e.g. *SchemaTypeError)
//     and carry only their own fields with no separate leaf.
//  3. Leaf — one type per call site (e.g. *InfoVersionRequired,
//     *LicenseIdentifierFieldFor31Plus). Lets callers match an exact
//     failure point without string comparison.
//  4. Context wrapper — types like *SectionValidationError,
//     *PathValidationError, *ParameterFieldValidationError. Add scope
//     ("which section", "which path", "which parameter") around an
//     inner error chain but do NOT themselves report a failure
//     condition — the actual error lives in Cause. Defined in
//     validation_error_context.go; see that file's header for the
//     full inventory and conventions.
//
// All four are reachable from the same returned error through
// standard Go error wrapping (errors.As, errors.Is, errors.Unwrap),
// so a caller that only needs "is it a validation error?" stops at
// the base and a caller that wants "is it specifically license.identifier
// being used in 3.0?" matches the leaf. A caller that wants "which
// section did this happen in?" matches the context wrapper and walks
// further for the cluster/leaf.
//
// A canonical error chain therefore looks like:
//
//	ComponentValidationError{Section: "schema", Name: "Foo"}
//	  -> RequiredFieldError{Field: "type"}
//	    -> SchemaTypeRequired{Message: "..."}
//
// Context wrapper carries WHERE, cluster carries WHAT category, leaf
// carries EXACTLY WHICH case.
//
// Backward compatibility: every site that today returns errors.New(msg)
// migrates to a leaf type that embeds ValidationError with Message set
// to the original string. (*ValidationError).Error() returns Message
// unchanged, so existing string-matching consumers see identical output.
type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string { return e.Message }

// asValidationError is a small helper used by every leaf type's As
// method to expose the embedded *ValidationError to errors.As. Defined
// once here so the leaf-side boilerplate stays a single line.
func asValidationError(target any, ve *ValidationError) bool {
	t, ok := target.(**ValidationError)
	if !ok {
		return false
	}
	*t = ve
	return true
}

// ---------------------------------------------------------------------
// Cluster types — group families of related failures.
// ---------------------------------------------------------------------

// RequiredFieldError clusters "X must be a non-empty value" failures
// across the spec (info.title, info.version, license.name, the openapi
// version string, server.url). Carries the field path, wraps the
// per-site leaf so callers can match either:
//
//	var rfe *RequiredFieldError
//	if errors.As(err, &rfe) { /* knows the field */ }
//
//	var ivr *InfoVersionRequired
//	if errors.As(err, &ivr) { /* knows it's exactly info.version */ }
type RequiredFieldError struct {
	// Field is the JSON-pointer-style path of the required field
	// (e.g. "info.version", "license.name", "openapi", "server.url").
	Field string
	// Cause is the underlying leaf error. Walked by errors.Unwrap.
	Cause error
	// Origin is the source location of the offending element when the
	// document was loaded with Loader.IncludeOrigin = true. Nil for
	// document-root fields (Loader doesn't track Origin on *T) and on
	// loads where origin tracking was off.
	Origin *Origin
}

func (e *RequiredFieldError) Error() string { return e.Cause.Error() }
func (e *RequiredFieldError) Unwrap() error { return e.Cause }

// SchemaValueError clusters failures of "this schema's <kind> value
// doesn't satisfy the schema's own constraints" — example, default,
// examples[i], etc. checked against the schema during document
// validation. Wraps the underlying error from VisitJSON (a
// *SchemaError or a MultiError of them) so callers can match either:
//
//	var sve *SchemaValueError
//	if errors.As(err, &sve) { /* knows ValueKind = "example" */ }
//
//	var se *SchemaError
//	if errors.As(err, &se) { /* full schema-validation detail */ }
//
// Cause is typed as error (not *SchemaError) because VisitJSON can
// return either a single SchemaError or a MultiError aggregating
// several. errors.As walks both shapes transparently.
type SchemaValueError struct {
	// ValueKind identifies the schema sub-field whose value failed
	// (e.g. "example", "default").
	ValueKind string
	// Cause is the underlying error from schema.VisitJSON — either a
	// *SchemaError or a MultiError of them. Walked by errors.Unwrap.
	Cause error
	// Origin is the source location of the offending element when the
	// document was loaded with Loader.IncludeOrigin = true. Nil when
	// origin tracking is off.
	Origin *Origin
}

func (e *SchemaValueError) Error() string {
	return fmt.Sprintf("invalid %s: %s", e.ValueKind, e.Cause.Error())
}

func (e *SchemaValueError) Unwrap() error { return e.Cause }

// PathParametersError clusters "operation declares fewer/more path
// parameters than appear in the path template" failures. Carries the
// path template, method, and the list of missing parameter names so
// callers can render or filter without parsing the message.
type PathParametersError struct {
	// Path is the path template (e.g. "/api/{domain}/{project}/...").
	Path string
	// Method is the HTTP method (e.g. "POST").
	Method string
	// Missing names path-template variables (or operation parameters)
	// that don't have a corresponding declaration on the other side.
	Missing []string
	// Origin is the source location of the path item when the document
	// was loaded with Loader.IncludeOrigin = true.
	Origin *Origin
}

func (e *PathParametersError) Error() string {
	return fmt.Sprintf("operation %s %s must define exactly all path parameters (missing: %v)",
		e.Method, e.Path, e.Missing)
}

// FieldVersionMismatchError clusters "field X is for OpenAPI >=Y"
// failures (3.1+ keywords used in 3.0 documents). Carries the field
// name and minimum version, wraps the per-site leaf.
type FieldVersionMismatchError struct {
	// Field is the field name flagged (e.g. "summary", "identifier",
	// "$defs", "prefixItems", "contains", ...).
	Field string
	// MinVersion is the minimum OpenAPI version that allows the field
	// (e.g. "3.1").
	MinVersion string
	// Cause is the underlying leaf error. Walked by errors.Unwrap.
	Cause error
	// Origin is the source location of the offending element when the
	// document was loaded with Loader.IncludeOrigin = true. Nil for
	// document-root fields (Loader doesn't track Origin on *T) and on
	// loads where origin tracking was off.
	Origin *Origin
}

func (e *FieldVersionMismatchError) Error() string { return e.Cause.Error() }
func (e *FieldVersionMismatchError) Unwrap() error { return e.Cause }

// ServerURLTemplateError clusters server URL template failures —
// mismatched braces and undeclared variables (template variables not
// matched by Server.Variables, or vice versa).
type ServerURLTemplateError struct {
	// URL is the server URL whose template failed validation.
	URL string
	// Cause is the underlying leaf error. Walked by errors.Unwrap.
	Cause error
	// Origin is the source location of the offending element when the
	// document was loaded with Loader.IncludeOrigin = true.
	Origin *Origin
}

func (e *ServerURLTemplateError) Error() string { return e.Cause.Error() }
func (e *ServerURLTemplateError) Unwrap() error { return e.Cause }

// EitherFieldRequiredError clusters "at least one of these fields must
// be set" failures (example.value vs externalValue, link.operationId
// vs operationRef).
type EitherFieldRequiredError struct {
	// Fields is the set of field names, at least one of which must be
	// set (e.g. ["value", "externalValue"]).
	Fields []string
	// Cause is the underlying leaf error. Walked by errors.Unwrap.
	Cause error
	// Origin is the source location of the offending element when the
	// document was loaded with Loader.IncludeOrigin = true.
	Origin *Origin
}

func (e *EitherFieldRequiredError) Error() string { return e.Cause.Error() }
func (e *EitherFieldRequiredError) Unwrap() error { return e.Cause }

// SchemaBothFormsExclusive clusters "this union-typed schema field is
// set to both its boolean and schema forms simultaneously" failures —
// additionalProperties, unevaluatedItems, unevaluatedProperties.
type SchemaBothFormsExclusive struct {
	// Field is the name of the union-typed schema property
	// (e.g. "additionalProperties", "unevaluatedItems").
	Field string
	// Cause is the underlying leaf error. Walked by errors.Unwrap.
	Cause error
	// Origin is the source location of the offending element when the
	// document was loaded with Loader.IncludeOrigin = true.
	Origin *Origin
}

func (e *SchemaBothFormsExclusive) Error() string { return e.Cause.Error() }
func (e *SchemaBothFormsExclusive) Unwrap() error { return e.Cause }

// ExactlyOneFieldError clusters "exactly one of these fields must be
// set" failures — e.g. a parameter or header where neither content
// nor schema is set, or both are.
type ExactlyOneFieldError struct {
	// Fields is the set of fields, exactly one of which must be set
	// (e.g. ["content", "schema"]).
	Fields []string
	// Cause is the underlying leaf error. Walked by errors.Unwrap.
	Cause error
	// Origin is the source location of the offending element when the
	// document was loaded with Loader.IncludeOrigin = true.
	Origin *Origin
}

func (e *ExactlyOneFieldError) Error() string { return e.Cause.Error() }
func (e *ExactlyOneFieldError) Unwrap() error { return e.Cause }

// SingleEntryContentError clusters "the content map must contain at
// most one entry" failures (parameter.content, header.content).
type SingleEntryContentError struct {
	// Subject is the kind of object whose Content map is too large
	// ("parameter", "header").
	Subject string
	// Cause is the underlying leaf error. Walked by errors.Unwrap.
	Cause error
	// Origin is the source location of the offending element when the
	// document was loaded with Loader.IncludeOrigin = true.
	Origin *Origin
}

func (e *SingleEntryContentError) Error() string { return e.Cause.Error() }
func (e *SingleEntryContentError) Unwrap() error { return e.Cause }

// WebhookNilError clusters "the value at webhook key X is nil"
// failures from T.Validate's webhook walk. Carries the offending
// key name.
type WebhookNilError struct {
	// Name is the webhook key whose value was nil.
	Name string
	// Cause is the underlying leaf error. Walked by errors.Unwrap.
	Cause error
}

func (e *WebhookNilError) Error() string { return e.Cause.Error() }
func (e *WebhookNilError) Unwrap() error { return e.Cause }

// MutuallyExclusiveFieldsError clusters "fields X and Y are both set,
// only one is allowed" failures (example.value vs externalValue,
// mediaType.example vs examples, license.url vs identifier,
// link.operationId vs operationRef). Carries both field names and
// wraps the per-site leaf.
type MutuallyExclusiveFieldsError struct {
	// Field1 and Field2 name the two fields the spec forbids setting
	// together (e.g. "value", "externalValue").
	Field1 string
	Field2 string
	// Cause is the underlying leaf error. Walked by errors.Unwrap.
	Cause error
	// Origin is the source location of the offending element when the
	// document was loaded with Loader.IncludeOrigin = true.
	Origin *Origin
}

func (e *MutuallyExclusiveFieldsError) Error() string { return e.Cause.Error() }
func (e *MutuallyExclusiveFieldsError) Unwrap() error { return e.Cause }

// ForbiddenFieldError clusters "field X must not be set in this
// context" failures (header.name and header.in inside a Headers map,
// OAuth flow URLs that don't apply to the chosen flow type).
type ForbiddenFieldError struct {
	// Field is the name of the forbidden field (e.g. "name", "in",
	// "authorizationUrl", "tokenUrl").
	Field string
	// Cause is the underlying leaf error. Walked by errors.Unwrap.
	Cause error
	// Origin is the source location of the offending element when the
	// document was loaded with Loader.IncludeOrigin = true.
	Origin *Origin
}

func (e *ForbiddenFieldError) Error() string { return e.Cause.Error() }
func (e *ForbiddenFieldError) Unwrap() error { return e.Cause }

// PathParameterRequiredError clusters "path parameter X must be required"
// failures: per the OpenAPI spec, every parameter with `in: path` must be
// declared with `required: true`. Carries the parameter name so callers
// can render or filter by it.
type PathParameterRequiredError struct {
	// Param is the path-parameter name (e.g. "groupId").
	Param string
	// Origin is the source location of the offending parameter when the
	// document was loaded with Loader.IncludeOrigin = true.
	Origin *Origin
}

func (e *PathParameterRequiredError) Error() string {
	return fmt.Sprintf("path parameter %q must be required", e.Param)
}

// DuplicateOperationIDError clusters "two operations share an operationId"
// failures. operationIds must be unique across all paths in a document.
// Endpoints are rendered as "<METHOD> <path>" (e.g. "POST /things").
type DuplicateOperationIDError struct {
	// OperationID is the duplicated operationId value.
	OperationID string
	// Endpoint1 / Endpoint2 are the two offending endpoints, in
	// deterministic order (lexicographically) for stable error messages.
	Endpoint1 string
	Endpoint2 string
	// Origin is the source location of the second (offending) operation
	// when the document was loaded with Loader.IncludeOrigin = true. The
	// pre-existing Endpoint1 is implicitly fine; the duplicate landed at
	// Endpoint2's site, which is the natural "go fix this" pointer.
	Origin *Origin
}

func (e *DuplicateOperationIDError) Error() string {
	return fmt.Sprintf("operations %q and %q have the same operation id %q",
		e.Endpoint1, e.Endpoint2, e.OperationID)
}

// ExtraSiblingFieldsError clusters "unexpected sibling fields" failures.
// Most commonly this fires when fields appear alongside a $ref that the
// OpenAPI spec doesn't allow there, or as unknown keys on objects whose
// only permitted extras are `x-` extensions. Carries the offending field
// names so callers can render or filter.
type ExtraSiblingFieldsError struct {
	// Fields is the list of unexpected sibling field names.
	Fields []string
	// Origin is the source location of the parent object that carries
	// the extra siblings when the document was loaded with
	// Loader.IncludeOrigin = true.
	Origin *Origin
}

func (e *ExtraSiblingFieldsError) Error() string {
	return fmt.Sprintf("extra sibling fields: %+v", e.Fields)
}

// SchemaTypeError clusters "unsupported 'type' value" failures on a
// Schema. Carries the bad type value so callers can surface it in
// user-facing output and filter findings by it.
type SchemaTypeError struct {
	// Type is the rejected type value (e.g. "bool", "int", "http").
	Type string
	// Origin is the source location of the offending schema when the
	// document was loaded with Loader.IncludeOrigin = true.
	Origin *Origin
}

func (e *SchemaTypeError) Error() string {
	return fmt.Sprintf("unsupported 'type' value %q", e.Type)
}

// InvalidParameterInError clusters "parameter can't have 'in' value X"
// failures. The OpenAPI 3.x spec accepts only `path`, `query`, `header`,
// or `cookie`; this fires when a parameter declares anything else
// (commonly `body`, a Swagger 2.0 leftover).
type InvalidParameterInError struct {
	// Value is the rejected `in:` value (e.g. "body", "formData").
	Value string
	// Origin is the source location of the offending parameter when the
	// document was loaded with Loader.IncludeOrigin = true.
	Origin *Origin
}

func (e *InvalidParameterInError) Error() string {
	return fmt.Sprintf("parameter can't have 'in' value %q", e.Value)
}

// SchemaPatternRegexError clusters "schema pattern failed to compile"
// failures. Kin's regex engine is Go's RE2, which rejects Perl features
// like `(?!...)` lookahead; specs that leak Perl regex patterns (common
// in AWS-style auto-generated schemas) trip this. Carries the offending
// pattern as a structured field for typed dispatch, while preserving
// the underlying SchemaError's rendered message byte-for-byte (Error()
// delegates to Cause.Error()) so existing string-based consumers and
// golden fixtures are unaffected.
type SchemaPatternRegexError struct {
	// Pattern is the schema's `pattern:` value that failed to compile.
	Pattern string
	// Cause is the underlying error (a *SchemaError wrapping the
	// regexp package's syntax error). Unwrap returns this so callers
	// walking the error chain see the SchemaError.
	Cause error
	// Origin is the source location of the offending schema when the
	// document was loaded with Loader.IncludeOrigin = true.
	Origin *Origin
}

func (e *SchemaPatternRegexError) Error() string { return e.Cause.Error() }

func (e *SchemaPatternRegexError) Unwrap() error { return e.Cause }

// InvalidSecuritySchemeTypeError clusters "security scheme 'type' can't
// be X" failures. The OpenAPI 3.x spec accepts only `apiKey`, `http`,
// `oauth2`, `openIdConnect`, and `mutualTLS` (3.1+); this fires when a
// security scheme declares anything else.
type InvalidSecuritySchemeTypeError struct {
	// Type is the rejected type value (e.g. "cookie", "saml").
	Type string
	// Origin is the source location of the offending security scheme
	// when the document was loaded with Loader.IncludeOrigin = true.
	Origin *Origin
}

func (e *InvalidSecuritySchemeTypeError) Error() string {
	return fmt.Sprintf("security scheme 'type' can't be %q", e.Type)
}

// InvalidHTTPSchemeError clusters "security scheme of type 'http' has
// invalid 'scheme' value X" failures. The OpenAPI/HTTP-auth registry
// accepts only `bearer`, `basic`, `negotiate`, `digest`; this fires
// when an http scheme declares anything else.
type InvalidHTTPSchemeError struct {
	// Scheme is the rejected scheme value (e.g. "mutual", "oauth").
	Scheme string
	// Origin is the source location of the offending security scheme
	// when the document was loaded with Loader.IncludeOrigin = true.
	Origin *Origin
}

func (e *InvalidHTTPSchemeError) Error() string {
	return fmt.Sprintf("security scheme of type 'http' has invalid 'scheme' value %q", e.Scheme)
}

// UnresolvedRefError clusters "found unresolved ref: X" failures fired
// by the loader when a $ref cannot be resolved against the loaded
// document. Carries the offending ref string so callers can surface
// it in user-facing output and filter findings by it.
type UnresolvedRefError struct {
	// Ref is the unresolved $ref value (e.g. "#/components/schemas/X"
	// or "external.yaml#/...").
	Ref string
	// Origin is the source location of the ref-bearing object when the
	// document was loaded with Loader.IncludeOrigin = true.
	Origin *Origin
}

func (e *UnresolvedRefError) Error() string {
	return fmt.Sprintf("found unresolved ref: %q", e.Ref)
}

// APIKeyInInvalidError clusters "apiKey should have 'in'. It can be
// 'query', 'header' or 'cookie', not X" failures. Fires when an
// apiKey security scheme either omits `in:` or sets it to a value
// outside {query, header, cookie}. Carries the rejected value so
// callers can render or filter; empty string means the field was
// missing entirely.
type APIKeyInInvalidError struct {
	// Value is the rejected `in:` value (empty when the field was
	// omitted, otherwise the bad value e.g. "body").
	Value string
	// Origin is the source location of the offending security scheme
	// when the document was loaded with Loader.IncludeOrigin = true.
	Origin *Origin
}

func (e *APIKeyInInvalidError) Error() string {
	return fmt.Sprintf("security scheme of type 'apiKey' should have 'in'. It can be 'query', 'header' or 'cookie', not %q", e.Value)
}

// PathMustStartWithSlashError clusters "path X does not start with a
// forward slash" failures. Path keys in the paths object must begin
// with `/`.
type PathMustStartWithSlashError struct {
	// Path is the offending path key (e.g. "users/{id}").
	Path string
	// Origin is the source location of the paths object when the
	// document was loaded with Loader.IncludeOrigin = true.
	Origin *Origin
}

func (e *PathMustStartWithSlashError) Error() string {
	return fmt.Sprintf("path %q does not start with a forward slash (/)", e.Path)
}

// ConflictingPathsError clusters "conflicting paths X and Y" failures.
// Fires when two path keys normalize to the same template (e.g.
// "/users/{a}" and "/users/{b}" both normalize to "/users/{}").
type ConflictingPathsError struct {
	// Path1 / Path2 are the two conflicting path keys, in document
	// order.
	Path1 string
	Path2 string
	// Origin is the source location of the paths object when the
	// document was loaded with Loader.IncludeOrigin = true.
	Origin *Origin
}

func (e *ConflictingPathsError) Error() string {
	return fmt.Sprintf("conflicting paths %q and %q", e.Path1, e.Path2)
}

// DuplicateParameterError clusters "more than one X parameter has
// name Y" failures. Fires when two parameters on an operation (or
// path item) share the same In + Name combination.
type DuplicateParameterError struct {
	// In is the parameter location (e.g. "query", "path", "header").
	In string
	// Name is the duplicated parameter name.
	Name string
	// Origin is the source location of the offending parameter when
	// the document was loaded with Loader.IncludeOrigin = true.
	Origin *Origin
}

func (e *DuplicateParameterError) Error() string {
	return fmt.Sprintf("more than one %q parameter has name %q", e.In, e.Name)
}

// DuplicateRequiredFieldError clusters "duplicate field in required" failures.
// The elements of a schema's `required` array MUST be unique (JSON Schema
// 2020-12 §6.5.3 for OpenAPI 3.1, draft-04 for OpenAPI 3.0).
type DuplicateRequiredFieldError struct {
	// Field is the field name listed more than once in `required`.
	Field string
	// Origin is the source location of the offending schema when the
	// document was loaded with Loader.IncludeOrigin = true.
	Origin *Origin
}

func (e *DuplicateRequiredFieldError) Error() string {
	return fmt.Sprintf("duplicate field %q in required", e.Field)
}

// DuplicateTagError clusters "more than one tag has name X" failures. Each tag
// name in the document-root `tags` list MUST be unique (OpenAPI Object).
type DuplicateTagError struct {
	// Name is the tag name that appears more than once.
	Name string
	// Origin is the source location of the offending tag when the document
	// was loaded with Loader.IncludeOrigin = true.
	Origin *Origin
}

func (e *DuplicateTagError) Error() string {
	return fmt.Sprintf("more than one tag has name %q", e.Name)
}

// InvalidSerializationMethodError clusters "serialization method with
// style=X and explode=Y is not supported by Z" failures. Fires for
// invalid (style, explode) combinations on encodings, parameters,
// and headers. The Subject discriminates which surface is reporting:
// "media type" for encoding, the parameter location ("path",
// "query", etc.) for parameters and "header" for headers.
type InvalidSerializationMethodError struct {
	// Subject discriminates the calling surface ("media type",
	// "path"/"query"/"header"/"cookie" for parameters, or "header"
	// for the header.go site).
	Subject string
	// Style is the offending `style:` value.
	Style string
	// Explode is the offending `explode:` value.
	Explode bool
	// Origin is the source location of the offending object when the
	// document was loaded with Loader.IncludeOrigin = true.
	Origin *Origin
}

func (e *InvalidSerializationMethodError) Error() string {
	if e.Subject == "media type" {
		return fmt.Sprintf("serialization method with style=%q and explode=%v is not supported by media type", e.Style, e.Explode)
	}
	return fmt.Sprintf("serialization method with style=%q and explode=%v is not supported by a %s parameter", e.Style, e.Explode, e.Subject)
}

// ---------------------------------------------------------------------
// Leaf types — one per call site. Each embeds ValidationError for
// Error() and As-to-base, and is wrapped in its cluster type when
// returned from a validator.
//
// Naming convention: <Subject><Action> for required fields,
// <Subject>FieldFor31Plus for 3.1-only fields used in 3.0 docs.
// Subjects use Go-identifier-friendly transliterations of OAS field
// paths ("$defs" -> "Defs", "$dynamicAnchor" -> "DynamicAnchor").
// ---------------------------------------------------------------------

// RequiredFieldError leaves.

type InfoVersionRequired struct{ ValidationError }

func (e *InfoVersionRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type InfoTitleRequired struct{ ValidationError }

func (e *InfoTitleRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type LicenseNameRequired struct{ ValidationError }

func (e *LicenseNameRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type OpenAPIVersionRequired struct{ ValidationError }

func (e *OpenAPIVersionRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type ServerURLRequired struct{ ValidationError }

func (e *ServerURLRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

// ServerURLTemplateError leaves.

type ServerURLMismatchedBraces struct{ ValidationError }

func (e *ServerURLMismatchedBraces) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type ServerURLUndeclaredVariables struct{ ValidationError }

func (e *ServerURLUndeclaredVariables) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type SchemaItemsRequired struct{ ValidationError }

func (e *SchemaItemsRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

// EitherFieldRequiredError leaves.

type ExampleValueOrExternalValueRequired struct{ ValidationError }

func (e *ExampleValueOrExternalValueRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type LinkOperationIDOrRefRequired struct{ ValidationError }

func (e *LinkOperationIDOrRefRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type InfoRequired struct{ ValidationError }

func (e *InfoRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type PathsRequired struct{ ValidationError }

func (e *PathsRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type JSONSchemaDialectAbsoluteURIRequired struct{ ValidationError }

func (e *JSONSchemaDialectAbsoluteURIRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

// SchemaBothFormsExclusive leaves.

type SchemaAdditionalPropertiesBothForms struct{ ValidationError }

func (e *SchemaAdditionalPropertiesBothForms) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type SchemaUnevaluatedItemsBothForms struct{ ValidationError }

func (e *SchemaUnevaluatedItemsBothForms) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type SchemaUnevaluatedPropertiesBothForms struct{ ValidationError }

func (e *SchemaUnevaluatedPropertiesBothForms) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

// ExactlyOneFieldError leaves.

type ParameterContentSchemaExactlyOne struct{ ValidationError }

func (e *ParameterContentSchemaExactlyOne) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type HeaderContentSchemaExactlyOne struct{ ValidationError }

func (e *HeaderContentSchemaExactlyOne) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

// SingleEntryContentError leaves.

type ParameterContentSingleEntry struct{ ValidationError }

func (e *ParameterContentSingleEntry) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type HeaderContentSingleEntry struct{ ValidationError }

func (e *HeaderContentSingleEntry) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

// WebhookNilError leaf.

type WebhookNil struct{ ValidationError }

func (e *WebhookNil) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

// SecurityScheme leaves wrapped in RequiredFieldError / ForbiddenFieldError.

type OpenIDConnectURLRequired struct{ ValidationError }

func (e *OpenIDConnectURLRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type SecuritySchemeFlowsRequired struct{ ValidationError }

func (e *SecuritySchemeFlowsRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type SecuritySchemeInForbidden struct{ ValidationError }

func (e *SecuritySchemeInForbidden) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type SecuritySchemeNameForbidden struct{ ValidationError }

func (e *SecuritySchemeNameForbidden) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type SecuritySchemeBearerFormatForbidden struct{ ValidationError }

func (e *SecuritySchemeBearerFormatForbidden) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type SecuritySchemeFlowsForbidden struct{ ValidationError }

func (e *SecuritySchemeFlowsForbidden) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type ParameterExampleAndExamplesExclusive struct{ ValidationError }

func (e *ParameterExampleAndExamplesExclusive) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type ServerVariableDefaultRequired struct{ ValidationError }

func (e *ServerVariableDefaultRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type ExternalDocsURLRequired struct{ ValidationError }

func (e *ExternalDocsURLRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type OperationResponsesRequired struct{ ValidationError }

func (e *OperationResponsesRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type RequestBodyContentRequired struct{ ValidationError }

func (e *RequestBodyContentRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type ResponseDescriptionRequired struct{ ValidationError }

func (e *ResponseDescriptionRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type OAuthFlowScopesRequired struct{ ValidationError }

func (e *OAuthFlowScopesRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type OAuthFlowAuthorizationURLRequired struct{ ValidationError }

func (e *OAuthFlowAuthorizationURLRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type OAuthFlowTokenURLRequired struct{ ValidationError }

func (e *OAuthFlowTokenURLRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type ParameterNameRequired struct{ ValidationError }

func (e *ParameterNameRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type ResponsesNonEmptyRequired struct{ ValidationError }

func (e *ResponsesNonEmptyRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type APIKeySecuritySchemeNameRequired struct{ ValidationError }

func (e *APIKeySecuritySchemeNameRequired) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

// MutuallyExclusiveFieldsError leaves.

type ExampleValueExternalValueExclusive struct{ ValidationError }

func (e *ExampleValueExternalValueExclusive) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type MediaTypeExampleExamplesExclusive struct{ ValidationError }

func (e *MediaTypeExampleExamplesExclusive) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type LicenseURLIdentifierExclusive struct{ ValidationError }

func (e *LicenseURLIdentifierExclusive) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type LinkOperationIDRefExclusive struct{ ValidationError }

func (e *LinkOperationIDRefExclusive) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type SchemaReadOnlyWriteOnlyExclusive struct{ ValidationError }

func (e *SchemaReadOnlyWriteOnlyExclusive) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

// ForbiddenFieldError leaves.

type HeaderNameForbidden struct{ ValidationError }

func (e *HeaderNameForbidden) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type HeaderInForbidden struct{ ValidationError }

func (e *HeaderInForbidden) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type OAuthFlowAuthorizationURLForbidden struct{ ValidationError }

func (e *OAuthFlowAuthorizationURLForbidden) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type OAuthFlowTokenURLForbidden struct{ ValidationError }

func (e *OAuthFlowTokenURLForbidden) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

// FieldVersionMismatchError leaves — non-schema fields.

type InfoSummaryFieldFor31Plus struct{ ValidationError }

func (e *InfoSummaryFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type LicenseIdentifierFieldFor31Plus struct{ ValidationError }

func (e *LicenseIdentifierFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type WebhooksFieldFor31Plus struct{ ValidationError }

func (e *WebhooksFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type JSONSchemaDialectFieldFor31Plus struct{ ValidationError }

func (e *JSONSchemaDialectFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

// FieldVersionMismatchError leaves — schema fields (rejected by
// schema.go's reject() helper when a 3.0 doc uses 3.1 keywords).

type ConstFieldFor31Plus struct{ ValidationError }

func (e *ConstFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type ExamplesFieldFor31Plus struct{ ValidationError }

func (e *ExamplesFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type PrefixItemsFieldFor31Plus struct{ ValidationError }

func (e *PrefixItemsFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type ContainsFieldFor31Plus struct{ ValidationError }

func (e *ContainsFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type MinContainsFieldFor31Plus struct{ ValidationError }

func (e *MinContainsFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type MaxContainsFieldFor31Plus struct{ ValidationError }

func (e *MaxContainsFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type PatternPropertiesFieldFor31Plus struct{ ValidationError }

func (e *PatternPropertiesFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type DependentSchemasFieldFor31Plus struct{ ValidationError }

func (e *DependentSchemasFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type PropertyNamesFieldFor31Plus struct{ ValidationError }

func (e *PropertyNamesFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type UnevaluatedItemsFieldFor31Plus struct{ ValidationError }

func (e *UnevaluatedItemsFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type UnevaluatedPropertiesFieldFor31Plus struct{ ValidationError }

func (e *UnevaluatedPropertiesFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type IfFieldFor31Plus struct{ ValidationError }

func (e *IfFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type ThenFieldFor31Plus struct{ ValidationError }

func (e *ThenFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type ElseFieldFor31Plus struct{ ValidationError }

func (e *ElseFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type DependentRequiredFieldFor31Plus struct{ ValidationError }

func (e *DependentRequiredFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type ContentEncodingFieldFor31Plus struct{ ValidationError }

func (e *ContentEncodingFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type ContentMediaTypeFieldFor31Plus struct{ ValidationError }

func (e *ContentMediaTypeFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type ContentSchemaFieldFor31Plus struct{ ValidationError }

func (e *ContentSchemaFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type DefsFieldFor31Plus struct{ ValidationError }

func (e *DefsFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type SchemaFieldFor31Plus struct{ ValidationError }

func (e *SchemaFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type CommentFieldFor31Plus struct{ ValidationError }

func (e *CommentFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type IDFieldFor31Plus struct{ ValidationError }

func (e *IDFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type AnchorFieldFor31Plus struct{ ValidationError }

func (e *AnchorFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type DynamicAnchorFieldFor31Plus struct{ ValidationError }

func (e *DynamicAnchorFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

type DynamicRefFieldFor31Plus struct{ ValidationError }

func (e *DynamicRefFieldFor31Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

// ---------------------------------------------------------------------
// Constructors — the validator-side entry points. Build the leaf, wrap
// in the cluster, return the cluster (which exposes the leaf via
// Unwrap and the base via the leaf's As method).
// ---------------------------------------------------------------------

func newRequiredField(field string, leaf error, origin *Origin) error {
	return &RequiredFieldError{Field: field, Cause: leaf, Origin: origin}
}

func newInfoVersionRequired(origin *Origin) error {
	return newRequiredField("info.version",
		&InfoVersionRequired{ValidationError{Message: "value of version must be a non-empty string"}}, origin)
}

func newInfoTitleRequired(origin *Origin) error {
	return newRequiredField("info.title",
		&InfoTitleRequired{ValidationError{Message: "value of title must be a non-empty string"}}, origin)
}

func newLicenseNameRequired(origin *Origin) error {
	return newRequiredField("license.name",
		&LicenseNameRequired{ValidationError{Message: "value of license name must be a non-empty string"}}, origin)
}

func newOpenAPIVersionRequired(origin *Origin) error {
	return newRequiredField("openapi",
		&OpenAPIVersionRequired{ValidationError{Message: "value of openapi must be a non-empty string"}}, origin)
}

func newServerURLRequired(origin *Origin) error {
	return newRequiredField("server.url",
		&ServerURLRequired{ValidationError{Message: "value of url must be a non-empty string"}}, origin)
}

// newServerURLTemplateError wraps leaf in a *ServerURLTemplateError
// carrying the offending Server.URL.
func newServerURLTemplateError(serverURL string, leaf error, origin *Origin) error {
	return &ServerURLTemplateError{URL: serverURL, Cause: leaf, Origin: origin}
}

func newServerURLMismatchedBraces(serverURL string, origin *Origin) error {
	const msg = "server URL has mismatched { and }"
	return newServerURLTemplateError(serverURL,
		&ServerURLMismatchedBraces{ValidationError{Message: msg}}, origin)
}

func newServerURLUndeclaredVariables(serverURL string, origin *Origin) error {
	const msg = "server has undeclared variables"
	return newServerURLTemplateError(serverURL,
		&ServerURLUndeclaredVariables{ValidationError{Message: msg}}, origin)
}

func newSchemaItemsRequired(origin *Origin) error {
	const msg = "when schema type is 'array', schema 'items' must be non-null"
	return newRequiredField("schema.items",
		&SchemaItemsRequired{ValidationError{Message: msg}}, origin)
}

// newEitherFieldRequired wraps leaf in an *EitherFieldRequiredError
// carrying the set of field names, at least one of which must be set.
func newEitherFieldRequired(fields []string, leaf error, origin *Origin) error {
	return &EitherFieldRequiredError{Fields: fields, Cause: leaf, Origin: origin}
}

func newExampleValueOrExternalValueRequired(origin *Origin) error {
	const msg = "no value or externalValue field"
	return newEitherFieldRequired([]string{"value", "externalValue"},
		&ExampleValueOrExternalValueRequired{ValidationError{Message: msg}}, origin)
}

func newLinkOperationIDOrRefRequired(origin *Origin) error {
	const msg = "missing operationId or operationRef on link"
	return newEitherFieldRequired([]string{"operationId", "operationRef"},
		&LinkOperationIDOrRefRequired{ValidationError{Message: msg}}, origin)
}

func newInfoRequired(origin *Origin) error {
	return newRequiredField("info",
		&InfoRequired{ValidationError{Message: "must be an object"}}, origin)
}

func newPathsRequired(origin *Origin) error {
	return newRequiredField("paths",
		&PathsRequired{ValidationError{Message: "must be an object"}}, origin)
}

func newJSONSchemaDialectAbsoluteURIRequired(origin *Origin) error {
	return newRequiredField("jsonSchemaDialect",
		&JSONSchemaDialectAbsoluteURIRequired{ValidationError{Message: "must be an absolute URI with a scheme"}}, origin)
}

// newSchemaBothForms wraps leaf in a *SchemaBothFormsExclusive carrying
// the name of the union-typed schema property.
func newSchemaBothForms(field string, leaf error, origin *Origin) error {
	return &SchemaBothFormsExclusive{Field: field, Cause: leaf, Origin: origin}
}

func newSchemaAdditionalPropertiesBothForms(origin *Origin) error {
	const msg = "additionalProperties are set to both boolean and schema"
	return newSchemaBothForms("additionalProperties",
		&SchemaAdditionalPropertiesBothForms{ValidationError{Message: msg}}, origin)
}

func newSchemaUnevaluatedItemsBothForms(origin *Origin) error {
	const msg = "unevaluatedItems is set to both boolean and schema"
	return newSchemaBothForms("unevaluatedItems",
		&SchemaUnevaluatedItemsBothForms{ValidationError{Message: msg}}, origin)
}

func newSchemaUnevaluatedPropertiesBothForms(origin *Origin) error {
	const msg = "unevaluatedProperties is set to both boolean and schema"
	return newSchemaBothForms("unevaluatedProperties",
		&SchemaUnevaluatedPropertiesBothForms{ValidationError{Message: msg}}, origin)
}

// newExactlyOneField wraps leaf in an *ExactlyOneFieldError carrying
// the set of fields, exactly one of which must be set.
func newExactlyOneField(fields []string, leaf error, origin *Origin) error {
	return &ExactlyOneFieldError{Fields: fields, Cause: leaf, Origin: origin}
}

func newParameterContentSchemaExactlyOne(origin *Origin) error {
	const msg = "parameter must contain exactly one of content and schema"
	return newExactlyOneField([]string{"content", "schema"},
		&ParameterContentSchemaExactlyOne{ValidationError{Message: msg}}, origin)
}

// newHeaderContentSchemaExactlyOne formats the same way the existing
// header.go site does, including the historical "%v" dump of the
// Header struct, so the Error() string remains byte-identical.
func newHeaderContentSchemaExactlyOne(header any, origin *Origin) error {
	msg := fmt.Sprintf("parameter must contain exactly one of content and schema: %v", header)
	return newExactlyOneField([]string{"content", "schema"},
		&HeaderContentSchemaExactlyOne{ValidationError{Message: msg}}, origin)
}

// newSingleEntryContent wraps leaf in a *SingleEntryContentError
// carrying the Subject ("parameter" or "header") whose Content map
// has more than one entry.
func newSingleEntryContent(subject string, leaf error, origin *Origin) error {
	return &SingleEntryContentError{Subject: subject, Cause: leaf, Origin: origin}
}

func newParameterContentSingleEntry(origin *Origin) error {
	const msg = "parameter content must only contain one entry"
	return newSingleEntryContent("parameter",
		&ParameterContentSingleEntry{ValidationError{Message: msg}}, origin)
}

func newHeaderContentSingleEntry(origin *Origin) error {
	const msg = "parameter content must only contain one entry"
	return newSingleEntryContent("header",
		&HeaderContentSingleEntry{ValidationError{Message: msg}}, origin)
}

func newWebhookNil(name string) error {
	msg := fmt.Sprintf("webhook %q is nil", name)
	return &WebhookNilError{
		Name:  name,
		Cause: &WebhookNil{ValidationError{Message: msg}},
	}
}

func newExternalDocsURLRequired(origin *Origin) error {
	return newRequiredField("externalDocs.url",
		&ExternalDocsURLRequired{ValidationError{Message: "url is required"}}, origin)
}

func newOperationResponsesRequired(origin *Origin) error {
	return newRequiredField("operation.responses",
		&OperationResponsesRequired{ValidationError{Message: "value of responses must be an object"}}, origin)
}

func newRequestBodyContentRequired(origin *Origin) error {
	return newRequiredField("requestBody.content",
		&RequestBodyContentRequired{ValidationError{Message: "content of the request body is required"}}, origin)
}

func newResponseDescriptionRequired(origin *Origin) error {
	return newRequiredField("response.description",
		&ResponseDescriptionRequired{ValidationError{Message: "a short description of the response is required"}}, origin)
}

func newOAuthFlowScopesRequired(origin *Origin) error {
	return newRequiredField("oAuthFlow.scopes",
		&OAuthFlowScopesRequired{ValidationError{Message: "field 'scopes' is missing"}}, origin)
}

func newOAuthFlowAuthorizationURLRequired(origin *Origin) error {
	return newRequiredField("oAuthFlow.authorizationUrl",
		&OAuthFlowAuthorizationURLRequired{ValidationError{Message: "field 'authorizationUrl' is empty or missing"}}, origin)
}

func newOAuthFlowTokenURLRequired(origin *Origin) error {
	return newRequiredField("oAuthFlow.tokenUrl",
		&OAuthFlowTokenURLRequired{ValidationError{Message: "field 'tokenUrl' is empty or missing"}}, origin)
}

// newMutuallyExclusiveFields wraps leaf in a *MutuallyExclusiveFieldsError
// carrying the two field names the spec forbids setting together.
func newMutuallyExclusiveFields(field1, field2 string, leaf error, origin *Origin) error {
	return &MutuallyExclusiveFieldsError{
		Field1: field1,
		Field2: field2,
		Cause:  leaf,
		Origin: origin,
	}
}

func newExampleValueExternalValueExclusive(origin *Origin) error {
	const msg = "value and externalValue are mutually exclusive"
	return newMutuallyExclusiveFields("value", "externalValue",
		&ExampleValueExternalValueExclusive{ValidationError{Message: msg}}, origin)
}

func newMediaTypeExampleExamplesExclusive(origin *Origin) error {
	const msg = "example and examples are mutually exclusive"
	return newMutuallyExclusiveFields("example", "examples",
		&MediaTypeExampleExamplesExclusive{ValidationError{Message: msg}}, origin)
}

func newLicenseURLIdentifierExclusive(origin *Origin) error {
	const msg = "license must not specify both 'url' and 'identifier'"
	return newMutuallyExclusiveFields("url", "identifier",
		&LicenseURLIdentifierExclusive{ValidationError{Message: msg}}, origin)
}

func newLinkOperationIDRefExclusive(operationID, operationRef string, origin *Origin) error {
	msg := fmt.Sprintf("operationId %q and operationRef %q are mutually exclusive", operationID, operationRef)
	return newMutuallyExclusiveFields("operationId", "operationRef",
		&LinkOperationIDRefExclusive{ValidationError{Message: msg}}, origin)
}

func newSchemaReadOnlyWriteOnlyExclusive(origin *Origin) error {
	const msg = "a property MUST NOT be marked as both readOnly and writeOnly being true"
	return newMutuallyExclusiveFields("readOnly", "writeOnly",
		&SchemaReadOnlyWriteOnlyExclusive{ValidationError{Message: msg}}, origin)
}

// newForbiddenField wraps leaf in a *ForbiddenFieldError carrying the
// name of the field that the spec forbids in the current context.
func newForbiddenField(field string, leaf error, origin *Origin) error {
	return &ForbiddenFieldError{Field: field, Cause: leaf, Origin: origin}
}

func newHeaderNameForbidden(origin *Origin) error {
	const msg = "header 'name' MUST NOT be specified, it is given in the corresponding headers map"
	return newForbiddenField("name",
		&HeaderNameForbidden{ValidationError{Message: msg}}, origin)
}

func newHeaderInForbidden(origin *Origin) error {
	const msg = "header 'in' MUST NOT be specified, it is implicitly in header"
	return newForbiddenField("in",
		&HeaderInForbidden{ValidationError{Message: msg}}, origin)
}

func newOAuthFlowAuthorizationURLForbidden(origin *Origin) error {
	const msg = "field 'authorizationUrl' should not be set"
	return newForbiddenField("authorizationUrl",
		&OAuthFlowAuthorizationURLForbidden{ValidationError{Message: msg}}, origin)
}

func newOAuthFlowTokenURLForbidden(origin *Origin) error {
	const msg = "field 'tokenUrl' should not be set"
	return newForbiddenField("tokenUrl",
		&OAuthFlowTokenURLForbidden{ValidationError{Message: msg}}, origin)
}

func newParameterNameRequired(origin *Origin) error {
	return newRequiredField("parameter.name",
		&ParameterNameRequired{ValidationError{Message: "parameter name can't be blank"}}, origin)
}

func newResponsesNonEmptyRequired(origin *Origin) error {
	const msg = "the responses object MUST contain at least one response code"
	return newRequiredField("responses",
		&ResponsesNonEmptyRequired{ValidationError{Message: msg}}, origin)
}

func newAPIKeySecuritySchemeNameRequired(origin *Origin) error {
	const msg = "security scheme of type 'apiKey' should have 'name'"
	return newRequiredField("securityScheme.name",
		&APIKeySecuritySchemeNameRequired{ValidationError{Message: msg}}, origin)
}

// ExampleViolatesSchema and DefaultViolatesSchema mark which schema value kind
// failed. They embed SchemaValueError, and their As exposes it, so errors.As
// with a *SchemaValueError target keeps matching.
type ExampleViolatesSchema struct{ SchemaValueError }

func (e *ExampleViolatesSchema) As(target any) bool {
	return asSchemaValueError(target, &e.SchemaValueError)
}

type DefaultViolatesSchema struct{ SchemaValueError }

func (e *DefaultViolatesSchema) As(target any) bool {
	return asSchemaValueError(target, &e.SchemaValueError)
}

func asSchemaValueError(target any, sve *SchemaValueError) bool {
	t, ok := target.(**SchemaValueError)
	if !ok {
		return false
	}
	*t = sve
	return true
}

// newSchemaValueError wraps the result of schema.VisitJSON in a
// *SchemaValueError cluster, identifying which schema sub-field
// (example, default, ...) carried the offending value. cause is
// either a *SchemaError or a MultiError of them.
func newSchemaValueError(valueKind string, cause error, origin *Origin) error {
	sve := SchemaValueError{ValueKind: valueKind, Cause: cause, Origin: origin}
	switch valueKind {
	case "example":
		return &ExampleViolatesSchema{sve}
	case "default":
		return &DefaultViolatesSchema{sve}
	}
	return &sve
}

// exampleValueOrigin returns an Origin pinned to the example's `value:`
// field, used when wrapping a plural Examples entry's validation failure.
// Falls back to the example's struct origin, then the parent fallback
// origin (parameter or media type), so consumers always have something
// useful to deep-link to.
func exampleValueOrigin(ex *Example, fallback *Origin) *Origin {
	if ex == nil || ex.Origin == nil {
		return fallback
	}
	if loc, ok := ex.Origin.Fields["value"]; ok {
		return &Origin{Key: &loc}
	}
	return ex.Origin
}

// newFieldVersionMismatch wraps leaf in a FieldVersionMismatchError for the
// given field at minimum version. Used by per-call-site constructors
// (newInfoSummaryFieldFor31Plus, etc.) and by dispatch helpers.
func newFieldVersionMismatch(field, minVersion string, leaf error, origin *Origin) error {
	return &FieldVersionMismatchError{
		Field:      field,
		MinVersion: minVersion,
		Cause:      leaf,
		Origin:     origin,
	}
}

// Per-call-site constructors for the four non-schema FieldFor31Plus sites
// (info.summary, license.identifier, doc.webhooks, doc.jsonSchemaDialect).
// The schema fields go through fieldFor31PlusLeaves below because they're
// dispatched from a runtime-parameterised closure in schema.go's reject.

func newInfoSummaryFieldFor31Plus(origin *Origin) error {
	const msg = "field summary is for OpenAPI >=3.1"
	return newFieldVersionMismatch("summary",
		"3.1", &InfoSummaryFieldFor31Plus{ValidationError{Message: msg}}, origin)
}

func newLicenseIdentifierFieldFor31Plus(origin *Origin) error {
	const msg = "field identifier is for OpenAPI >=3.1"
	return newFieldVersionMismatch("identifier",
		"3.1", &LicenseIdentifierFieldFor31Plus{ValidationError{Message: msg}}, origin)
}

func newWebhooksFieldFor31Plus(origin *Origin) error {
	const msg = "field webhooks is for OpenAPI >=3.1"
	return newFieldVersionMismatch("webhooks",
		"3.1", &WebhooksFieldFor31Plus{ValidationError{Message: msg}}, origin)
}

func newJSONSchemaDialectFieldFor31Plus(origin *Origin) error {
	const msg = "field jsonschemadialect is for OpenAPI >=3.1"
	return newFieldVersionMismatch("jsonschemadialect",
		"3.1", &JSONSchemaDialectFieldFor31Plus{ValidationError{Message: msg}}, origin)
}

// fieldFor31PlusLeaves maps field names (as passed to errFieldFor31Plus)
// to their typed leaf constructors. Only schema-keyword fields are in
// the table — those are dispatched at runtime from schema.go's reject
// closure. The four non-schema fields (summary, identifier, webhooks,
// jsonschemadialect) have direct constructors above. Any field not in
// the map falls back to a bare *ValidationError, so callers still get
// the cluster + base layers — only the per-leaf type is missing.
var fieldFor31PlusLeaves = map[string]func(msg string) error{
	"const":                 func(m string) error { return &ConstFieldFor31Plus{ValidationError{Message: m}} },
	"examples":              func(m string) error { return &ExamplesFieldFor31Plus{ValidationError{Message: m}} },
	"prefixItems":           func(m string) error { return &PrefixItemsFieldFor31Plus{ValidationError{Message: m}} },
	"contains":              func(m string) error { return &ContainsFieldFor31Plus{ValidationError{Message: m}} },
	"minContains":           func(m string) error { return &MinContainsFieldFor31Plus{ValidationError{Message: m}} },
	"maxContains":           func(m string) error { return &MaxContainsFieldFor31Plus{ValidationError{Message: m}} },
	"patternProperties":     func(m string) error { return &PatternPropertiesFieldFor31Plus{ValidationError{Message: m}} },
	"dependentSchemas":      func(m string) error { return &DependentSchemasFieldFor31Plus{ValidationError{Message: m}} },
	"propertyNames":         func(m string) error { return &PropertyNamesFieldFor31Plus{ValidationError{Message: m}} },
	"unevaluatedItems":      func(m string) error { return &UnevaluatedItemsFieldFor31Plus{ValidationError{Message: m}} },
	"unevaluatedProperties": func(m string) error { return &UnevaluatedPropertiesFieldFor31Plus{ValidationError{Message: m}} },
	"if":                    func(m string) error { return &IfFieldFor31Plus{ValidationError{Message: m}} },
	"then":                  func(m string) error { return &ThenFieldFor31Plus{ValidationError{Message: m}} },
	"else":                  func(m string) error { return &ElseFieldFor31Plus{ValidationError{Message: m}} },
	"dependentRequired":     func(m string) error { return &DependentRequiredFieldFor31Plus{ValidationError{Message: m}} },
	"contentEncoding":       func(m string) error { return &ContentEncodingFieldFor31Plus{ValidationError{Message: m}} },
	"contentMediaType":      func(m string) error { return &ContentMediaTypeFieldFor31Plus{ValidationError{Message: m}} },
	"contentSchema":         func(m string) error { return &ContentSchemaFieldFor31Plus{ValidationError{Message: m}} },
	"$defs":                 func(m string) error { return &DefsFieldFor31Plus{ValidationError{Message: m}} },
	"$schema":               func(m string) error { return &SchemaFieldFor31Plus{ValidationError{Message: m}} },
	"$comment":              func(m string) error { return &CommentFieldFor31Plus{ValidationError{Message: m}} },
	"$id":                   func(m string) error { return &IDFieldFor31Plus{ValidationError{Message: m}} },
	"$anchor":               func(m string) error { return &AnchorFieldFor31Plus{ValidationError{Message: m}} },
	"$dynamicAnchor":        func(m string) error { return &DynamicAnchorFieldFor31Plus{ValidationError{Message: m}} },
	"$dynamicRef":           func(m string) error { return &DynamicRefFieldFor31Plus{ValidationError{Message: m}} },
}

// errFieldFor31Plus dispatches errFieldFor31Plus's per-field message
// to the right typed leaf and wraps it in a FieldVersionMismatchError.
// Fields not in fieldFor31PlusLeaves fall back to a bare
// *ValidationError so the caller still gets a stable Message and the
// cluster + base layers; only the per-leaf type is missing.
//
// Reached only from schema.go's reject closure with a runtime field
// name; the four non-schema sites use direct constructors instead.
func errFieldFor31Plus(field string, origin *Origin) error {
	msg := "field " + field + " is for OpenAPI >=3.1"
	var leaf error
	if ctor, ok := fieldFor31PlusLeaves[field]; ok {
		leaf = ctor(msg)
	} else {
		leaf = &ValidationError{Message: msg}
	}
	return newFieldVersionMismatch(field, "3.1", leaf, origin)
}

type ItemSchemaFieldFor32Plus struct{ ValidationError }

func (e *ItemSchemaFieldFor32Plus) As(target any) bool {
	return asValidationError(target, &e.ValidationError)
}

var fieldFor32PlusLeaves = map[string]func(msg string) error{
	"itemSchema": func(m string) error { return &ItemSchemaFieldFor32Plus{ValidationError{Message: m}} },
}

func errFieldFor32Plus(field string, origin *Origin) error {
	msg := "field " + field + " is for OpenAPI >=3.2"
	var leaf error
	if ctor, ok := fieldFor32PlusLeaves[field]; ok {
		leaf = ctor(msg)
	} else {
		leaf = &ValidationError{Message: msg}
	}
	return newFieldVersionMismatch(field, "3.2", leaf, origin)
}

func newPathParameterRequired(param string, origin *Origin) error {
	return &PathParameterRequiredError{Param: param, Origin: origin}
}

func newDuplicateOperationID(endpoint1, endpoint2, operationID string, origin *Origin) error {
	return &DuplicateOperationIDError{
		Endpoint1:   endpoint1,
		Endpoint2:   endpoint2,
		OperationID: operationID,
		Origin:      origin,
	}
}

func newExtraSiblingFields(fields []string, origin *Origin) error {
	return &ExtraSiblingFieldsError{Fields: fields, Origin: origin}
}

func newSchemaTypeError(typ string, origin *Origin) error {
	return &SchemaTypeError{Type: typ, Origin: origin}
}

func newInvalidParameterIn(value string, origin *Origin) error {
	return &InvalidParameterInError{Value: value, Origin: origin}
}

func newSchemaPatternRegexError(pattern string, cause error, origin *Origin) error {
	return &SchemaPatternRegexError{Pattern: pattern, Cause: cause, Origin: origin}
}

func newInvalidSecuritySchemeType(typ string, origin *Origin) error {
	return &InvalidSecuritySchemeTypeError{Type: typ, Origin: origin}
}

func newInvalidHTTPScheme(scheme string, origin *Origin) error {
	return &InvalidHTTPSchemeError{Scheme: scheme, Origin: origin}
}

func newUnresolvedRef(ref string, origin *Origin) error {
	return &UnresolvedRefError{Ref: ref, Origin: origin}
}

func newAPIKeyInInvalid(value string, origin *Origin) error {
	return &APIKeyInInvalidError{Value: value, Origin: origin}
}

func newOpenIDConnectURLRequired(schemeName string, origin *Origin) error {
	return newRequiredField("openIdConnectUrl",
		&OpenIDConnectURLRequired{ValidationError{Message: fmt.Sprintf("no OIDC URL found for openIdConnect security scheme %q", schemeName)}}, origin)
}

func newSecuritySchemeFlowsRequired(schemeType string, origin *Origin) error {
	return newRequiredField("flows",
		&SecuritySchemeFlowsRequired{ValidationError{Message: fmt.Sprintf("security scheme of type %q should have 'flows'", schemeType)}}, origin)
}

func newSecuritySchemeInForbidden(schemeType string, origin *Origin) error {
	return newForbiddenField("in",
		&SecuritySchemeInForbidden{ValidationError{Message: fmt.Sprintf("security scheme of type %q can't have 'in'", schemeType)}}, origin)
}

func newSecuritySchemeNameForbidden(schemeType string, origin *Origin) error {
	return newForbiddenField("name",
		&SecuritySchemeNameForbidden{ValidationError{Message: fmt.Sprintf("security scheme of type %q can't have 'name'", schemeType)}}, origin)
}

func newSecuritySchemeBearerFormatForbidden(schemeType string, origin *Origin) error {
	return newForbiddenField("bearerFormat",
		&SecuritySchemeBearerFormatForbidden{ValidationError{Message: fmt.Sprintf("security scheme of type %q can't have 'bearerFormat'", schemeType)}}, origin)
}

func newSecuritySchemeFlowsForbidden(schemeType string, origin *Origin) error {
	return newForbiddenField("flows",
		&SecuritySchemeFlowsForbidden{ValidationError{Message: fmt.Sprintf("security scheme of type %q can't have 'flows'", schemeType)}}, origin)
}

func newPathMustStartWithSlash(path string, origin *Origin) error {
	return &PathMustStartWithSlashError{Path: path, Origin: origin}
}

func newConflictingPaths(path1, path2 string, origin *Origin) error {
	return &ConflictingPathsError{Path1: path1, Path2: path2, Origin: origin}
}

func newDuplicateParameter(in, name string, origin *Origin) error {
	return &DuplicateParameterError{In: in, Name: name, Origin: origin}
}

func newInvalidSerializationMethod(subject, style string, explode bool, origin *Origin) error {
	return &InvalidSerializationMethodError{Subject: subject, Style: style, Explode: explode, Origin: origin}
}

func newParameterExampleAndExamplesExclusive(parameterName string, origin *Origin) error {
	return newMutuallyExclusiveFields("example", "examples",
		&ParameterExampleAndExamplesExclusive{ValidationError{Message: fmt.Sprintf("parameter %q example and examples are mutually exclusive", parameterName)}}, origin)
}

func newServerVariableDefaultRequired(serverData string, origin *Origin) error {
	return newRequiredField("default",
		&ServerVariableDefaultRequired{ValidationError{Message: fmt.Sprintf("field default is required in %s", serverData)}}, origin)
}
