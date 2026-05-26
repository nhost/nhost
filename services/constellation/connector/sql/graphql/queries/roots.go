package queries

import (
	"errors"
	"fmt"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	groupedaggdispatch "github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/groupedaggregate"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/permissions"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// OperationKind names the outer map key of a Roots value: the GraphQL
// operation a per-field SQL builder belongs to. The string values must match
// ast.Operation exactly because BuildQuery dispatches on the ast value and
// looks up the per-operation map by this constant. See TestOperationConstants
// for the regression guard.
type OperationKind string

// Operation kind keys for the outer map of a Roots value. Use these instead
// of bare strings so typos fail at compile time rather than at runtime as
// ErrNoRootsForRole.
const (
	OperationQuery        OperationKind = "query"
	OperationMutation     OperationKind = "mutation"
	OperationSubscription OperationKind = "subscription"
)

// Roots is the per-role registry of root-field SQL builders. Operations maps
// each operation kind (query/mutation/subscription) to a name→builder map.
// StreamFields names the subscription roots that correspond to _stream
// subscriptions; consumers can answer "is this field a stream subscription?"
// in O(1) without building any SQL. BuildRoots produces one Roots per database
// from introspected objects and metadata.
type Roots struct {
	Operations   map[OperationKind]map[string]core.Operation
	StreamFields map[string]struct{}
}

// BuildRoots builds the per-role SQL operation registry for one database from
// its introspection objects and metadata. It also returns a grouped-aggregate
// Ops handle used by cross-database aggregate resolution. nil or empty
// metadata yields a Roots with only an empty query map and an empty Ops.
func BuildRoots( //nolint:funlen
	objects *introspection.Objects,
	md *metadata.DatabaseMetadata,
	dialect dialect.Dialect,
) (Roots, *groupedaggdispatch.Ops, error) {
	if md == nil || len(md.Tables) == 0 {
		return Roots{
				Operations: map[OperationKind]map[string]core.Operation{
					OperationQuery: make(map[string]core.Operation),
				},
				StreamFields: map[string]struct{}{},
			},
			groupedaggdispatch.New(map[string]groupedaggdispatch.Builder{}),
			nil
	}

	rootsByOperation := map[OperationKind]map[string]core.Operation{
		OperationQuery:        make(map[string]core.Operation),
		OperationMutation:     make(map[string]core.Operation),
		OperationSubscription: make(map[string]core.Operation),
	}
	streamFields := map[string]struct{}{}

	tables := make([]*table, 0, len(md.Tables))
	tablesByKey := make(map[string]*table)

	// Enum tables are created too so they can be targets of FK relationships.
	for _, tableMeta := range md.Tables {
		table := newTable(tableMeta.Table.Schema, tableMeta.Table.Name, dialect)
		tables = append(tables, table)
		tablesByKey[tableMeta.Table.Schema+"."+tableMeta.Table.Name] = table
	}

	for i, tableMeta := range md.Tables {
		if err := tables[i].Initialize(objects, tableMeta, tables); err != nil {
			return Roots{}, nil, fmt.Errorf("failed to initialize table %s.%s: %w",
				tableMeta.Table.Schema, tableMeta.Table.Name, err)
		}
	}

	for i, tableMeta := range md.Tables {
		if err := permissions.Initialize(tables[i], tables[i].permissions, tableMeta); err != nil {
			return Roots{}, nil, fmt.Errorf("failed to initialize table %s.%s: %w",
				tableMeta.Table.Schema, tableMeta.Table.Name, err)
		}
	}

	for _, fnMeta := range md.Functions {
		fn := newFunction(fnMeta.Function.Schema, fnMeta.Function.Name, dialect)

		tableSchema, tableName, err := fn.Initialize(objects, fnMeta)
		if err != nil {
			// Defense-in-depth: reconcile drops functions that are missing
			// from introspection or whose return type is not a table type.
			// If one slips through, skip just the function rather than
			// aborting the whole connector.
			if errors.Is(err, errFunctionNotFound) ||
				errors.Is(err, errFunctionDoesNotReturnTableType) {
				continue
			}

			return Roots{}, nil, fmt.Errorf("failed to initialize function %s.%s: %w",
				fnMeta.Function.Schema, fnMeta.Function.Name, err)
		}

		baseTable, ok := tablesByKey[tableSchema+"."+tableName]
		if !ok {
			// Defense-in-depth: reconcile drops functions whose base
			// table is not tracked. If one slips through, skip just the
			// function rather than aborting the whole connector.
			continue
		}

		baseTable.AddFunction(fn)
	}

	for _, table := range tables {
		registerTableRoots(table, rootsByOperation, streamFields)
	}

	builders := make(map[string]groupedaggdispatch.Builder, len(tablesByKey))
	for k, t := range tablesByKey {
		builders[k] = t
	}

	return Roots{Operations: rootsByOperation, StreamFields: streamFields},
		groupedaggdispatch.New(builders),
		nil
}

// BuildQuery routes each root field of the GraphQL operation to its
// registered SQL builder and returns the resulting SQLOperations. Returns
// ErrNoRootsForRole when this Roots has no map for the operation kind, and a
// wrapped error when the operation kind is unknown or a field has no
// registered builder.
func (r Roots) BuildQuery(
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
) ([]core.SQLOperation, error) {
	// Determine which root to use based on operation type
	var rootMap map[string]core.Operation

	var ok bool

	switch operation.Operation {
	case ast.Query:
		rootMap, ok = r.Operations[OperationQuery]
		if !ok {
			return nil, fmt.Errorf("%w: query", ErrNoRootsForRole)
		}
	case ast.Mutation:
		rootMap, ok = r.Operations[OperationMutation]
		if !ok {
			return nil, fmt.Errorf("%w: mutations", ErrNoRootsForRole)
		}
	case ast.Subscription:
		rootMap, ok = r.Operations[OperationSubscription]
		if !ok {
			return nil, fmt.Errorf("%w: subscriptions", ErrNoRootsForRole)
		}
	default:
		return nil, fmt.Errorf("%w: %s", ErrNoRootsForRole, operation.Operation)
	}

	// Build SQL operations for each field in the selection set
	operations := make([]core.SQLOperation, 0, len(operation.SelectionSet))

	for _, selection := range operation.SelectionSet {
		field, ok := selection.(*ast.Field)
		if !ok {
			// Skip non-field selections (fragments, inline fragments)
			continue
		}

		// Find the corresponding operation for this field
		opFn, exists := rootMap[field.Name]
		if !exists {
			return nil, fmt.Errorf(
				"%w: field %q in role %q", errNoOperationForFieldInRole, field.Name, role,
			)
		}

		// Build the SQL query for this field
		sqlOp, err := opFn(field, fragments, variables, role, sessionVariables, rootMap)
		if err != nil {
			return nil, fmt.Errorf("failed to build query for field %q: %w", field.Name, err)
		}

		operations = append(operations, sqlOp)
	}

	return operations, nil
}

// IsStreamSubscription reports whether field corresponds to a _stream
// subscription root registered in this Roots. The check is an O(1) lookup on
// the registered name and does not build any SQL, so callers can route stream
// vs. live-query subscriptions without paying the cost of BuildQuery.
func (r Roots) IsStreamSubscription(field *ast.Field) bool {
	if field == nil {
		return false
	}

	_, ok := r.StreamFields[field.Name]

	return ok
}
