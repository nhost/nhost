package openapi3

import "slices"

// CodedError is implemented by every typed validation error. Code returns a
// stable, kebab-case identifier for the validation rule that failed (e.g.
// "operation-responses-required"), so consumers can suppress specific
// findings, assign per-rule severities, emit machine-readable diagnostics
// (e.g. the LSP Diagnostic.code field), or link to per-rule documentation
// without depending on message text.
//
// Every code is declared as a literal on its error type; nothing is derived.
// Codes are a contract: message wording and Go type names may change freely,
// codes may not. Renaming or removing a code is a breaking change and is
// recorded in the README changelog. The full set is available from
// ValidationErrorCodes.
//
// Like net.Error, this interface exists as an assertion target for consumers;
// the package itself constructs concrete error types and does not consume it.
// Reach the code of a wrapped error with errors.As:
//
//	var coded openapi3.CodedError
//	if errors.As(err, &coded) {
//		fmt.Println(coded.Code())
//	}
type CodedError interface {
	error
	Code() string
}

func (e *AnchorFieldFor31Plus) Code() string             { return "anchor-field-for-3-1-plus" }
func (e *APIKeyInInvalidError) Code() string             { return "security-scheme-apikey-in-invalid" }
func (e *APIKeySecuritySchemeNameRequired) Code() string { return "security-scheme-name-required" }
func (e *CommentFieldFor31Plus) Code() string            { return "comment-field-for-3-1-plus" }
func (e *ConflictingPathsError) Code() string            { return "conflicting-paths" }
func (e *ConstFieldFor31Plus) Code() string              { return "const-field-for-3-1-plus" }
func (e *ContainsFieldFor31Plus) Code() string           { return "contains-field-for-3-1-plus" }
func (e *ContentEncodingFieldFor31Plus) Code() string    { return "content-encoding-field-for-3-1-plus" }
func (e *ContentMediaTypeFieldFor31Plus) Code() string {
	return "content-media-type-field-for-3-1-plus"
}
func (e *ContentSchemaFieldFor31Plus) Code() string { return "content-schema-field-for-3-1-plus" }
func (e *DefaultViolatesSchema) Code() string       { return "default-violates-schema" }
func (e *DefsFieldFor31Plus) Code() string          { return "defs-field-for-3-1-plus" }
func (e *DependentRequiredFieldFor31Plus) Code() string {
	return "dependent-required-field-for-3-1-plus"
}
func (e *DependentSchemasFieldFor31Plus) Code() string { return "dependent-schemas-field-for-3-1-plus" }
func (e *DuplicateOperationIDError) Code() string      { return "duplicate-operation-id" }
func (e *DuplicateParameterError) Code() string        { return "duplicate-parameter" }
func (e *DuplicateRequiredFieldError) Code() string    { return "duplicate-required-field" }
func (e *DuplicateTagError) Code() string              { return "duplicate-tag" }
func (e *DynamicAnchorFieldFor31Plus) Code() string    { return "dynamic-anchor-field-for-3-1-plus" }
func (e *DynamicRefFieldFor31Plus) Code() string       { return "dynamic-ref-field-for-3-1-plus" }
func (e *ElseFieldFor31Plus) Code() string             { return "else-field-for-3-1-plus" }
func (e *ExamplesFieldFor31Plus) Code() string         { return "examples-field-for-3-1-plus" }
func (e *ExampleValueExternalValueExclusive) Code() string {
	return "value-external-value-mutually-exclusive"
}
func (e *ExampleValueOrExternalValueRequired) Code() string {
	return "value-or-external-value-required"
}
func (e *ExampleViolatesSchema) Code() string                { return "example-violates-schema" }
func (e *ExternalDocsURLRequired) Code() string              { return "external-docs-url-required" }
func (e *ExtraSiblingFieldsError) Code() string              { return "extra-sibling-fields" }
func (e *HeaderContentSchemaExactlyOne) Code() string        { return "content-or-schema-exactly-one" }
func (e *HeaderContentSingleEntry) Code() string             { return "header-content-single-entry" }
func (e *HeaderInForbidden) Code() string                    { return "in-forbidden" }
func (e *HeaderNameForbidden) Code() string                  { return "name-forbidden" }
func (e *IDFieldFor31Plus) Code() string                     { return "id-field-for-3-1-plus" }
func (e *IfFieldFor31Plus) Code() string                     { return "if-field-for-3-1-plus" }
func (e *InfoRequired) Code() string                         { return "info-required" }
func (e *InfoSummaryFieldFor31Plus) Code() string            { return "summary-field-for-3-1-plus" }
func (e *InfoTitleRequired) Code() string                    { return "info-title-required" }
func (e *InfoVersionRequired) Code() string                  { return "info-version-required" }
func (e *InvalidHTTPSchemeError) Code() string               { return "security-scheme-http-scheme-invalid" }
func (e *InvalidParameterInError) Code() string              { return "parameter-in-invalid" }
func (e *InvalidSecuritySchemeTypeError) Code() string       { return "security-scheme-type-invalid" }
func (e *InvalidSerializationMethodError) Code() string      { return "serialization-method-invalid" }
func (e *ItemSchemaFieldFor32Plus) Code() string             { return "item-schema-field-for-3-2-plus" }
func (e *JSONSchemaDialectAbsoluteURIRequired) Code() string { return "json-schema-dialect-required" }
func (e *JSONSchemaDialectFieldFor31Plus) Code() string {
	return "jsonschemadialect-field-for-3-1-plus"
}
func (e *LicenseIdentifierFieldFor31Plus) Code() string { return "identifier-field-for-3-1-plus" }
func (e *LicenseNameRequired) Code() string             { return "license-name-required" }
func (e *LicenseURLIdentifierExclusive) Code() string   { return "url-identifier-mutually-exclusive" }
func (e *LinkOperationIDOrRefRequired) Code() string    { return "operation-id-or-operation-ref-required" }
func (e *LinkOperationIDRefExclusive) Code() string {
	return "operation-id-operation-ref-mutually-exclusive"
}
func (e *MaxContainsFieldFor31Plus) Code() string { return "max-contains-field-for-3-1-plus" }
func (e *MediaTypeExampleExamplesExclusive) Code() string {
	return "example-examples-mutually-exclusive"
}
func (e *MinContainsFieldFor31Plus) Code() string          { return "min-contains-field-for-3-1-plus" }
func (e *OAuthFlowAuthorizationURLForbidden) Code() string { return "authorization-url-forbidden" }
func (e *OAuthFlowAuthorizationURLRequired) Code() string {
	return "oauth-flow-authorization-url-required"
}
func (e *OAuthFlowScopesRequired) Code() string          { return "oauth-flow-scopes-required" }
func (e *OAuthFlowTokenURLForbidden) Code() string       { return "token-url-forbidden" }
func (e *OAuthFlowTokenURLRequired) Code() string        { return "oauth-flow-token-url-required" }
func (e *OpenAPIVersionRequired) Code() string           { return "openapi-required" }
func (e *OpenIDConnectURLRequired) Code() string         { return "openid-connect-url-required" }
func (e *OperationResponsesRequired) Code() string       { return "operation-responses-required" }
func (e *ParameterContentSchemaExactlyOne) Code() string { return "content-or-schema-exactly-one" }
func (e *ParameterContentSingleEntry) Code() string      { return "parameter-content-single-entry" }
func (e *ParameterExampleAndExamplesExclusive) Code() string {
	return "example-examples-mutually-exclusive"
}
func (e *ParameterNameRequired) Code() string       { return "parameter-name-required" }
func (e *PathMustStartWithSlashError) Code() string { return "path-must-start-with-slash" }
func (e *PathParameterRequiredError) Code() string  { return "path-parameter-required" }
func (e *PathParametersError) Code() string         { return "path-parameters-mismatch" }
func (e *PathsRequired) Code() string               { return "paths-required" }
func (e *PatternPropertiesFieldFor31Plus) Code() string {
	return "pattern-properties-field-for-3-1-plus"
}
func (e *PrefixItemsFieldFor31Plus) Code() string   { return "prefix-items-field-for-3-1-plus" }
func (e *PropertyNamesFieldFor31Plus) Code() string { return "property-names-field-for-3-1-plus" }
func (e *RequestBodyContentRequired) Code() string  { return "request-body-content-required" }
func (e *ResponseDescriptionRequired) Code() string { return "response-description-required" }
func (e *ResponsesNonEmptyRequired) Code() string   { return "responses-required" }
func (e *SchemaAdditionalPropertiesBothForms) Code() string {
	return "additional-properties-both-forms-exclusive"
}
func (e *SchemaFieldFor31Plus) Code() string    { return "schema-field-for-3-1-plus" }
func (e *SchemaItemsRequired) Code() string     { return "schema-items-required" }
func (e *SchemaPatternRegexError) Code() string { return "schema-pattern-regex-invalid" }
func (e *SchemaReadOnlyWriteOnlyExclusive) Code() string {
	return "read-only-write-only-mutually-exclusive"
}
func (e *SchemaTypeError) Code() string { return "schema-type-unsupported" }
func (e *SchemaUnevaluatedItemsBothForms) Code() string {
	return "unevaluated-items-both-forms-exclusive"
}
func (e *SchemaUnevaluatedPropertiesBothForms) Code() string {
	return "unevaluated-properties-both-forms-exclusive"
}
func (e *SecuritySchemeBearerFormatForbidden) Code() string { return "bearer-format-forbidden" }
func (e *SecuritySchemeFlowsForbidden) Code() string        { return "flows-forbidden" }
func (e *SecuritySchemeFlowsRequired) Code() string         { return "flows-required" }
func (e *SecuritySchemeInForbidden) Code() string           { return "in-forbidden" }
func (e *SecuritySchemeNameForbidden) Code() string         { return "name-forbidden" }
func (e *ServerURLRequired) Code() string                   { return "server-url-required" }
func (e *ServerURLTemplateError) Code() string              { return "server-url-template-invalid" }
func (e *ServerVariableDefaultRequired) Code() string       { return "default-required" }
func (e *ThenFieldFor31Plus) Code() string                  { return "then-field-for-3-1-plus" }
func (e *UnevaluatedItemsFieldFor31Plus) Code() string      { return "unevaluated-items-field-for-3-1-plus" }
func (e *UnevaluatedPropertiesFieldFor31Plus) Code() string {
	return "unevaluated-properties-field-for-3-1-plus"
}
func (e *UnresolvedRefError) Code() string     { return "unresolved-ref" }
func (e *WebhookNilError) Code() string        { return "webhook-nil" }
func (e *WebhooksFieldFor31Plus) Code() string { return "webhooks-field-for-3-1-plus" }

// ValidationErrorCodes returns every code a validation error can carry,
// sorted. TestValidationErrorCodes keeps it in sync with the errors the
// validators emit.
func ValidationErrorCodes() []string {
	return slices.Clone(validationErrorCodes)
}

var validationErrorCodes = []string{
	"additional-properties-both-forms-exclusive",
	"anchor-field-for-3-1-plus",
	"authorization-url-forbidden",
	"bearer-format-forbidden",
	"comment-field-for-3-1-plus",
	"conflicting-paths",
	"const-field-for-3-1-plus",
	"contains-field-for-3-1-plus",
	"content-encoding-field-for-3-1-plus",
	"content-media-type-field-for-3-1-plus",
	"content-or-schema-exactly-one",
	"content-schema-field-for-3-1-plus",
	"default-required",
	"default-violates-schema",
	"defs-field-for-3-1-plus",
	"dependent-required-field-for-3-1-plus",
	"dependent-schemas-field-for-3-1-plus",
	"duplicate-operation-id",
	"duplicate-parameter",
	"duplicate-required-field",
	"duplicate-tag",
	"dynamic-anchor-field-for-3-1-plus",
	"dynamic-ref-field-for-3-1-plus",
	"else-field-for-3-1-plus",
	"example-examples-mutually-exclusive",
	"example-violates-schema",
	"examples-field-for-3-1-plus",
	"external-docs-url-required",
	"extra-sibling-fields",
	"flows-forbidden",
	"flows-required",
	"header-content-single-entry",
	"id-field-for-3-1-plus",
	"identifier-field-for-3-1-plus",
	"if-field-for-3-1-plus",
	"in-forbidden",
	"info-required",
	"info-title-required",
	"info-version-required",
	"item-schema-field-for-3-2-plus",
	"json-schema-dialect-required",
	"jsonschemadialect-field-for-3-1-plus",
	"license-name-required",
	"max-contains-field-for-3-1-plus",
	"min-contains-field-for-3-1-plus",
	"name-forbidden",
	"oauth-flow-authorization-url-required",
	"oauth-flow-scopes-required",
	"oauth-flow-token-url-required",
	"openapi-required",
	"openid-connect-url-required",
	"operation-id-operation-ref-mutually-exclusive",
	"operation-id-or-operation-ref-required",
	"operation-responses-required",
	"parameter-content-single-entry",
	"parameter-in-invalid",
	"parameter-name-required",
	"path-must-start-with-slash",
	"path-parameter-required",
	"path-parameters-mismatch",
	"paths-required",
	"pattern-properties-field-for-3-1-plus",
	"prefix-items-field-for-3-1-plus",
	"property-names-field-for-3-1-plus",
	"read-only-write-only-mutually-exclusive",
	"request-body-content-required",
	"response-description-required",
	"responses-required",
	"schema-field-for-3-1-plus",
	"schema-items-required",
	"schema-pattern-regex-invalid",
	"schema-type-unsupported",
	"security-scheme-apikey-in-invalid",
	"security-scheme-http-scheme-invalid",
	"security-scheme-name-required",
	"security-scheme-type-invalid",
	"serialization-method-invalid",
	"server-url-required",
	"server-url-template-invalid",
	"summary-field-for-3-1-plus",
	"then-field-for-3-1-plus",
	"token-url-forbidden",
	"unevaluated-items-both-forms-exclusive",
	"unevaluated-items-field-for-3-1-plus",
	"unevaluated-properties-both-forms-exclusive",
	"unevaluated-properties-field-for-3-1-plus",
	"unresolved-ref",
	"url-identifier-mutually-exclusive",
	"value-external-value-mutually-exclusive",
	"value-or-external-value-required",
	"webhook-nil",
	"webhooks-field-for-3-1-plus",
}
