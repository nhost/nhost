// Package openapi3 parses and writes OpenAPI 3 specification documents.
//
// Supports OpenAPI 3.0, OpenAPI 3.1, and OpenAPI 3.2:
//   - OpenAPI 3.0.x: https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md
//   - OpenAPI 3.1.x: https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.1.0.md
//   - OpenAPI 3.2.x: https://spec.openapis.org/oas/v3.2.0.html
//
// OpenAPI 3.1 Features:
//   - Type arrays with null support (e.g., ["string", "null"])
//   - JSON Schema 2020-12 keywords (const, examples, prefixItems, etc.)
//   - Webhooks for defining callback operations
//   - JSON Schema dialect specification
//   - SPDX license identifiers
//
// OpenAPI 3.2 Features:
//   - Media Type Object itemSchema for streaming sequential media types
//
// The implementation maintains 100% backward compatibility with OpenAPI 3.0.
//
// For OpenAPI 3.1 validation, use the JSON Schema 2020-12 validator option:
//
//	schema.VisitJSON(value, openapi3.EnableJSONSchema2020())
//
// Version detection is available via helper methods:
//
//	if doc.IsOpenAPI31OrLater() {
//	    // Handle OpenAPI 3.1 specific features
//	}
//	if doc.IsOpenAPI32OrLater() {
//	    // Handle OpenAPI 3.2 specific features
//	}
package openapi3
