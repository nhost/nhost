// Package groupedaggregate exposes the side-channel SQL builder for
// cross-database aggregate relationships. It deliberately lives outside the
// queries package's Roots.BuildQuery dispatch because grouped aggregates are
// not user-facing GraphQL operations — they are batched fetches initiated by
// the cross-connector resolver.
package groupedaggregate

import (
	"fmt"
	"maps"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

// BuildInput bundles the inputs to a grouped-aggregate SQL build. The
// dispatcher and the per-table Builder both take this single value so callers
// initialise fields by name; this prevents silent argument swaps among the
// same-typed fields (two map[string]any, three string) that the previous
// positional signature exposed.
type BuildInput struct {
	// TableSchema is the database schema (e.g. "public") of the target table.
	// Used by Ops to look up the registered Builder; the Builder itself
	// already knows its own schema and can ignore this field.
	TableSchema string
	// TableName is the unqualified name of the target table. Like TableSchema,
	// it is used by Ops for dispatch and is informational for the Builder.
	TableName string
	// Field is the user's aggregate selection at the GraphQL root, used by
	// the Builder to drive sub-field selection (aggregate / nodes).
	Field *ast.Field
	// Fragments is the operation's fragment definition list, forwarded to the
	// SQL builder so fragment spreads inside Field can be resolved.
	Fragments ast.FragmentDefinitionList
	// Variables are the GraphQL operation variables, used by the Builder for
	// argument resolution (where, order_by, limit, offset).
	Variables map[string]any
	// Role is the request role that scopes row-level permissions and column
	// restrictions applied to the build.
	Role string
	// SessionVariables are the X-Hasura-* session variables, used when
	// expanding permission templates that reference them.
	SessionVariables map[string]any
	// JoinColumnSQLName is the SQL column name on the target table used both
	// as the IN-list filter and the GROUP BY key.
	JoinColumnSQLName string
	// JoinValues are the distinct join keys to filter on; the build returns
	// one aggregate row per value (empty groups included).
	JoinValues []any
}

// Builder builds a grouped-aggregate SQL statement for a single target table.
// The parent connector/sql/graphql/queries package declares a compile-time
// assertion that its *table type satisfies this interface.
//
// Builder implementations must be safe for concurrent use; Ops calls into
// them from multiple goroutines without serialisation (see Ops godoc).
//
//go:generate mockgen -package mock -destination mock/builder.go . Builder
type Builder interface {
	BuildGroupedAggregateSQL(in BuildInput) (core.SQLOperation, error)
}

// Ops dispatches grouped-aggregate SQL builds to the per-table Builder for
// the requested schema.table.
//
// Ops is safe for concurrent use after New returns: the builder map is frozen
// at construction (see New) and post-construction the map is only read.
// Builder implementations are themselves expected to be concurrency-safe so
// that the dispatch can fan out across goroutines without serialisation.
type Ops struct {
	builders map[string]Builder
}

// New returns an Ops backed by a copy of the given schema.table -> Builder
// map, so later mutations of the map's shape by the caller (adds, removes,
// rebindings) cannot affect dispatch. The clone is shallow: the Builder
// values are interface references shared with the caller, so changes to
// internal state of an implementor after New returns are visible to dispatch.
func New(builders map[string]Builder) *Ops {
	return &Ops{builders: maps.Clone(builders)}
}

// BuildGroupedAggregateSQL builds a grouped aggregate SQL operation for the
// table named by in.TableSchema and in.TableName. Returns an error if the
// table is not registered.
func (o *Ops) BuildGroupedAggregateSQL(in BuildInput) (core.SQLOperation, error) {
	b, ok := o.builders[in.TableSchema+"."+in.TableName]
	if !ok {
		return core.SQLOperation{}, fmt.Errorf(
			"table %s.%s not registered for grouped aggregate builds",
			in.TableSchema, in.TableName,
		)
	}

	op, err := b.BuildGroupedAggregateSQL(in)
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf(
			"grouped aggregate build for %s.%s: %w",
			in.TableSchema, in.TableName, err,
		)
	}

	return op, nil
}
