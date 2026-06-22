// Package memconnector provides an in-memory connector.Connector implementation
// for benchmarks and controller integration tests that need a deterministic,
// I/O-free data source. Benchmarks use it to isolate the controller +
// serialization pipeline from real database latency; the controller test suite
// uses it to compose multi-connector remote-relationship scenarios without
// standing up Postgres or SQLite.
//
// All exported symbols (the field/type builder helpers, Object, Query, QueryDef,
// and New) exist so external _test.go files can build canned schemas. There is
// no non-test consumer.
//
// Trade-offs to be aware of — these apply equally to benchmark and controller
// test usage:
//   - Only the "admin" role is served; no role-based schema filtering.
//   - Execute returns pre-canned responses verbatim under the field's alias;
//     there is no selection-set filtering, so the canned JSON must already
//     match the shape requested by the query.
//   - Fragments at the operation root are not supported and return an error.
package memconnector

import (
	"context"
	"fmt"
	"log/slog"

	conn "github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/vektah/gqlparser/v2/ast"
)

var _ conn.Connector = (*connector)(nil)

// The functions below are trivial constructor helpers for the most common
// shapes used in fixture schemas (non-null scalars, nullable scalars, named
// types, lists, and bare graph.Field/ObjectType wrappers). They exist so
// external _test.go files can build canned schemas without boilerplate; see
// the package godoc for the full design rationale.

func ID(name string) *graph.Field {
	return &graph.Field{
		Name:        name,
		Description: "",
		Type:        graph.NewNonNullType("ID"),
		Arguments:   nil,
		Directives:  nil,
	}
}

func String(name string) *graph.Field {
	return &graph.Field{
		Name:        name,
		Description: "",
		Type:        graph.NewNamedType("String"),
		Arguments:   nil,
		Directives:  nil,
	}
}

func Int(name string) *graph.Field {
	return &graph.Field{
		Name:        name,
		Description: "",
		Type:        graph.NewNamedType("Int"),
		Arguments:   nil,
		Directives:  nil,
	}
}

func Float(name string) *graph.Field {
	return &graph.Field{
		Name:        name,
		Description: "",
		Type:        graph.NewNamedType("Float"),
		Arguments:   nil,
		Directives:  nil,
	}
}

func Boolean(name string) *graph.Field {
	return &graph.Field{
		Name:        name,
		Description: "",
		Type:        graph.NewNamedType("Boolean"),
		Arguments:   nil,
		Directives:  nil,
	}
}

func Field(name string, typ *graph.Type) *graph.Field {
	return &graph.Field{
		Name:        name,
		Description: "",
		Type:        typ,
		Arguments:   nil,
		Directives:  nil,
	}
}

func Named(name string) *graph.Type {
	return graph.NewNamedType(name)
}

func NonNull(name string) *graph.Type {
	return graph.NewNonNullType(name)
}

func NonNullList(elem *graph.Type) *graph.Type {
	return graph.NewNonNullListType(elem)
}

func Object(name string, fields ...*graph.Field) *graph.ObjectType {
	return &graph.ObjectType{
		Name:        name,
		Description: "",
		Fields:      fields,
		Interfaces:  nil,
		Directives:  nil,
	}
}

// QueryDef maps a root query field to a return type and pre-canned response.
// All fields are exported so callers may construct values either via a struct
// literal or via the Query helper.
type QueryDef struct {
	Name     string
	Type     *graph.Type
	Response any
}

// Query builds a QueryDef binding a root field name to its return type and
// the pre-canned response Execute will return for it.
func Query(name string, typ *graph.Type, response any) QueryDef {
	return QueryDef{
		Name:     name,
		Type:     typ,
		Response: response,
	}
}

// queryEntry holds everything Execute and GetSchema need for a single root
// query field, derived from a QueryDef during construction.
type queryEntry struct {
	typ      *graph.Type
	response any
}

// connector implements connector.Connector with in-memory pre-canned responses.
// queryOrder preserves the order callers supplied so GetSchema produces a
// stable field list; queries is the source of truth for both schema building
// and Execute lookups.
type connector struct {
	objects    []*graph.ObjectType
	queryOrder []string
	queries    map[string]queryEntry
}

// New constructs an in-memory connector exposing the given object types and
// root queries. Returns an error if two QueryDef entries share the same name —
// silent override would be a footgun when a benchmark accidentally registers
// the same field twice. See the package godoc for the trade-offs versus a real
// connector.
//
// Returns connector.Connector rather than the concrete *connector so call
// sites depend on the interface, matching the production connector factories
// (newPostgresConnector, newSQLiteConnector) in the parent package.
func New( //nolint:ireturn,nolintlint
	objects []*graph.ObjectType,
	queries []QueryDef,
) (conn.Connector, error) {
	entries := make(map[string]queryEntry, len(queries))
	order := make([]string, 0, len(queries))

	for _, q := range queries {
		if _, dup := entries[q.Name]; dup {
			return nil, fmt.Errorf(
				"%w: %q",
				ErrDuplicateQueryDef, q.Name,
			)
		}

		entries[q.Name] = queryEntry{typ: q.Type, response: q.Response}
		order = append(order, q.Name)
	}

	return &connector{
		objects:    objects,
		queryOrder: order,
		queries:    entries,
	}, nil
}

// GetSchema builds a schema with query_root + all object types, returned for the "admin" role.
func (c *connector) GetSchema() (map[string]*graph.Schema, error) {
	queryRoot := "query_root"

	queryFields := make([]*graph.Field, len(c.queryOrder))
	for i, name := range c.queryOrder {
		queryFields[i] = &graph.Field{
			Name:        name,
			Description: "",
			Type:        c.queries[name].typ,
			Arguments:   nil,
			Directives:  nil,
		}
	}

	types := make([]*graph.ObjectType, 0, len(c.objects)+1)
	types = append(types, &graph.ObjectType{
		Name:        queryRoot,
		Description: "",
		Fields:      queryFields,
		Interfaces:  nil,
		Directives:  nil,
	})
	types = append(types, c.objects...)

	schema := &graph.Schema{
		Types:            types,
		Scalars:          nil,
		Enums:            nil,
		Interfaces:       nil,
		Unions:           nil,
		Inputs:           nil,
		Directives:       nil,
		QueryType:        &queryRoot,
		MutationType:     nil,
		SubscriptionType: nil,
	}

	return map[string]*graph.Schema{
		"admin": schema,
	}, nil
}

// Execute walks the operation's selection set and returns pre-canned responses
// keyed by alias (or field name).
func (c *connector) Execute(
	_ context.Context,
	operation *ast.OperationDefinition,
	_ ast.FragmentDefinitionList,
	_ map[string]any,
	_ string,
	_ map[string]any,
	_ *slog.Logger,
) (map[string]any, error) {
	result := make(map[string]any, len(operation.SelectionSet))

	for _, sel := range operation.SelectionSet {
		field, ok := sel.(*ast.Field)
		if !ok {
			return nil, fmt.Errorf(
				"%w: operation %q (pos %v): %T",
				ErrNonFieldSelection, operation.Name, sel.GetPosition(), sel,
			)
		}

		entry, ok := c.queries[field.Name]
		if !ok {
			return nil, fmt.Errorf(
				"%w: operation %q field %q",
				ErrUnknownField, operation.Name, field.Name,
			)
		}

		result[field.Alias] = entry.response
	}

	return result, nil
}

// ValidateOperation is a no-op: the in-memory connector serves fixed
// query/response mappings and has no pre-execution argument validation, so it
// returns nil and reports any unknown-field failure from Execute. It exists to
// satisfy the connector.Connector pre-execution-validation contract.
func (c *connector) ValidateOperation(
	_ *ast.OperationDefinition,
	_ ast.FragmentDefinitionList,
	_ map[string]any,
	_ string,
	_ map[string]any,
) error {
	return nil
}

func (c *connector) GetTypeName(identifier string) string {
	return identifier
}

func (c *connector) Close() {}
