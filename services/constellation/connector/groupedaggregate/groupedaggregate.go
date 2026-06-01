// Package groupedaggregate defines the request and executor types for
// batched grouped-aggregate execution across connectors. It is the resolver-
// to-connector contract used by cross-database array-aggregate relationships.
//
// The package lives outside both connector/ and controller/ to break the
// import cycle that would otherwise exist between the SQL connector and the
// resolver layer that dispatches into it.
package groupedaggregate

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/vektah/gqlparser/v2/ast"
)

// Request describes a batched grouped-aggregate query against a single target
// table. The executor groups the target by JoinColumnSQLName, filtered to
// rows where that column equals one of JoinValues, and returns one aggregate
// row per join value.
//
// Prefer constructing a Request via NewRequest to surface missing required
// fields at the call site rather than deep inside the SQL builder.
type Request struct {
	// TableSchema is the database schema (e.g. "public") of the target table.
	TableSchema string
	// TableName is the unqualified name of the target table to aggregate over.
	TableName string
	// JoinColumnSQLName is the SQL column name on the target table used both
	// as the IN-list filter and the GROUP BY key.
	JoinColumnSQLName string
	// JoinValues are the distinct join keys to filter on; the executor returns
	// one aggregate entry per value (empty groups included). Must be non-nil-
	// elemented and pre-deduped by the caller — the executor does not filter
	// nils or collapse duplicates, and a nil entry will be stringified to "<nil>"
	// when keying the result map (see Executor godoc).
	JoinValues []any
	// Field is the user's aggregate selection at the GraphQL root, used by the
	// executor to drive sub-field selection (aggregate / nodes).
	Field *ast.Field
	// Fragments is the operation's fragment definition list, forwarded to the
	// SQL builder so fragment spreads inside Field can be resolved.
	Fragments ast.FragmentDefinitionList
	// Variables are the GraphQL operation variables, forwarded to the SQL
	// builder for argument resolution (where, order_by, limit, offset).
	Variables map[string]any
}

// ErrInvalidRequest is returned by NewRequest when required fields are missing.
var ErrInvalidRequest = errors.New("invalid grouped aggregate request")

// NewRequest validates that the fields required to build a grouped-aggregate
// SQL query are present: TableSchema, TableName, JoinColumnSQLName, and Field.
// JoinValues, Fragments, and Variables are optional and may be zero. Callers
// initialise the Request by name so the type system prevents accidental field
// swaps among the same-typed string fields.
func NewRequest(req Request) (Request, error) {
	switch {
	case req.TableSchema == "":
		return Request{}, fmt.Errorf(
			"%w: TableSchema is required",
			ErrInvalidRequest,
		)
	case req.TableName == "":
		return Request{}, fmt.Errorf(
			"%w: TableName is required",
			ErrInvalidRequest,
		)
	case req.JoinColumnSQLName == "":
		return Request{}, fmt.Errorf(
			"%w: JoinColumnSQLName is required",
			ErrInvalidRequest,
		)
	case req.Field == nil:
		return Request{}, fmt.Errorf(
			"%w: Field is required",
			ErrInvalidRequest,
		)
	}

	return req, nil
}

// Executor is an extension interface implemented by connectors that support
// batched grouped-aggregate execution — the optimized resolution path for
// cross-database array-aggregate relationships.
//
// SQL connectors implement this. Remote-schema connectors do not, and the
// schema generator avoids exposing aggregate fields on relationships whose
// target is a remote schema, so the type-assertion against this interface in
// the resolver is unreachable when the target is non-SQL.
//
// Result-map invariants. The returned map is keyed by the stringified join
// value — specifically fmt.Sprintf("%v", v) of each entry in Request.JoinValues
// — and each value preserves the same GraphQL response fields as the same-
// database aggregate field (aliases when present, otherwise "aggregate" /
// "nodes"). An entry is present for every value in Request.JoinValues,
// including those with no matching target rows (count: 0, nodes: []). Because
// keys are %v-stringified, distinct JoinValues
// entries that share the same %v representation (e.g. a []byte and its string
// equivalent) will collide on the same key; callers must dedupe in a way that
// matches that formatting. The resolver-side stitcher applies the same
// fmt.Sprintf("%v", …) formatting on the parent side to look results back up.
//
// Parameter ordering caveat. req.Variables (the GraphQL operation variables)
// and the sessionVariables argument are both map[string]any and travel side-
// by-side at every call site; swapping them silently compiles and reaches the
// SQL builder. This is accepted technical debt that mirrors connector.Connector.
// Execute and is the reason the signature exists in its current shape. If
// Executor ever diverges from connector.Connector.Execute, prefer wrapping the
// session context (role + sessionVariables) in a small Session struct so the
// type system enforces the separation.
//
//go:generate mockgen -package mock -destination mock/executor.go . Executor
type Executor interface {
	ExecuteGroupedAggregate(
		ctx context.Context,
		req Request,
		role string,
		sessionVariables map[string]any,
		logger *slog.Logger,
	) (map[string]any, error)
}
