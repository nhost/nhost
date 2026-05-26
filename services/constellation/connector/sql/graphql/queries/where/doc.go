// Package where translates GraphQL where-clause arguments into parameterized
// SQL WHERE conditions. It implements the GraphQL filter sub-language
// (_eq, _and, _or, _not, _exists, relationship traversal, jsonb/array
// containment, regex/like, etc.) and emits SQL through the dialect.Dialect
// interface.
//
// Consumers supply a Table (and, transitively, Relationship) implementation
// so the parser can resolve column/relationship names without depending on
// the concrete *table type in the parent package.
package where
