// Package arguments parses GraphQL operation arguments into typed intermediate
// values consumed by the SQL builders in the parent queries package. It is the
// parse-time phase of the query/mutation pipeline: GraphQL AST in, typed
// representation out (InsertObject, Update, OrderBy, StreamCursor, …).
//
// The package depends on the parent table only through the Table and
// Relationship interfaces, which the parent satisfies via the adapter in
// queries/arguments_adapter.go. It mirrors the pattern used by the where and
// permissions subpackages.
package arguments
