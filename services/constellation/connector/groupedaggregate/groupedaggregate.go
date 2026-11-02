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
	"encoding/json"
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
	// Empty is the SQLite namespace for collection requests only.
	TableSchema string
	// AllowEmptySchema permits SQLite's schema-less collection target while
	// retaining the grouped-aggregate request's existing validation contract.
	AllowEmptySchema bool
	// TableName is the unqualified name of the target table to aggregate over.
	TableName string
	// JoinColumnSQLName is the SQL column name on the target table used both
	// as the IN-list filter and the GROUP BY key.
	JoinColumnSQLName string
	// JoinValues are the distinct join keys to filter on; the executor returns
	// one aggregate entry per value (empty groups included). Must be non-nil-
	// elemented and pre-deduped by the caller — the executor does not filter
	// nils or collapse duplicates (see Executor godoc).
	JoinValues []any
	// JoinColumns and JoinTuples describe collection keys in sorted source-column
	// order. JoinColumns holds target GraphQL field names; the collection SQL
	// builder also accepts SQL names as a fallback. A single-column collection
	// can use JoinValues instead, with JoinColumnSQLName resolved the same way.
	JoinColumns []string
	JoinTuples  [][]any
	// JSONTargets marks JSON/JSONB columns in JoinColumns order.
	JSONTargets []bool
	// JSONTarget indicates that the target join column has a json/jsonb GraphQL
	// type. JoinValues must then be canonical JSON text for SQL binding; the
	// executor uses typed JSON keys when indexing the returned groups.
	JSONTarget bool
	// Field is the user's aggregate selection, used by the executor to drive
	// sub-field selection (aggregate / nodes).
	Field *ast.Field
	// ArgumentPath is the GraphQL selection path from the operation root to
	// Field, using response field names joined by ".selectionSet.". Connectors
	// use it to render validation errors for nested aggregate relationships.
	// Empty falls back to Field's alias/name for direct executor callers.
	ArgumentPath string
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
// SQL query are present: TableSchema (unless AllowEmptySchema), TableName,
// a join column (or JoinColumns), and Field.
// JoinValues, Fragments, and Variables are optional and may be zero. Callers
// initialise the Request by name so the type system prevents accidental field
// swaps among the same-typed string fields.
func NewRequest(req Request) (Request, error) {
	switch {
	case req.TableSchema == "" && !req.AllowEmptySchema:
		return Request{}, fmt.Errorf("%w: TableSchema is required", ErrInvalidRequest)
	case req.TableName == "":
		return Request{}, fmt.Errorf(
			"%w: TableName is required",
			ErrInvalidRequest,
		)
	case req.JoinColumnSQLName == "" && len(req.JoinColumns) == 0:
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

// JoinKey is shared by grouped-result indexing and parent stitching. The
// non-JSON form intentionally matches an ID string to an integer ID.
func JoinKey(value any, jsonTarget bool) string {
	if jsonTarget {
		encoded, err := json.Marshal(value)
		if err == nil {
			return "json:" + string(encoded)
		}
	}

	return fmt.Sprintf("%v", value)
}

// TupleKey indexes a composite join key. Non-JSON components keep the
// cross-scalar ID matching of ordinary relationships; JSON components retain
// their JSON type (including string versus number) and canonical object order.
func TupleKey(values []any, jsonTargets []bool) string {
	parts := make([]string, len(values))
	for i, value := range values {
		if i < len(jsonTargets) && jsonTargets[i] {
			parts[i] = JoinKey(value, true)
		} else {
			parts[i] = fmt.Sprint(value)
		}
	}

	encoded, err := json.Marshal(parts)
	if err != nil {
		// []string cannot contain unsupported JSON values.
		return fmt.Sprint(parts)
	}

	return string(encoded)
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
// Result-map invariants. For JSONTarget, the map is keyed by JoinKey of the
// decoded JSON group key (not the JSON-text SQL parameter). This distinguishes
// JSON strings from numbers and canonicalizes object keys. Otherwise it uses
// the legacy %v representation, retaining cross-scalar ID matching. Each
// value preserves the requested GraphQL fields and includes empty groups.
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
