// Package transform evaluates Hasura Action REST Connector request/response
// transforms. Templates are rendered with the jsontmpl engine (the Go port of
// hasura/kriti-lang) rather than a bespoke evaluator: string-context fields
// (url, header values, query params, form fields) are wrapped in double quotes
// before rendering (mirroring graphql-engine's wrapUnescapedTemplate) so Kriti
// treats them as string literals with interpolation, while body transforms are
// rendered as JSON-context Kriti templates. The transform-only
// getSessionVariable function is registered into the scope.
//
// Null-rendered string-context fields: Hasura quote-wraps these templates, so a
// null interpolation renders to the literal string "null". Hasura then drops
// query params (graphql-engine QueryParams: `value == Just "null"`) and form
// fields (Body.foldFormEncoded: `v /= "null"`) whose rendered value is that
// literal, but does NOT drop headers (Headers.applyHeadersTransformFn sets the
// value unconditionally). We mirror this exactly: query params and form fields
// with a rendered "null" are dropped; a "null"-rendered header is kept.
//
// Control flow (if/else/end) inside a string-context field is constrained to
// what Kriti allows inside a quote-wrapped string literal. This is NOT a
// divergence from Hasura: graphql-engine wraps these templates identically
// (wrapUnescapedTemplate = `"" <> txt <> ""`), so both engines share the same
// Kriti behaviour here.
package transform
