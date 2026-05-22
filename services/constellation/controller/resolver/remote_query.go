package resolver

import (
	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
	"github.com/vektah/gqlparser/v2/ast"
)

// remoteQueryResolver defines the strategy for building and processing remote
// queries. Different relationship types (db→db, db→rs, rs→db, rs→rs) implement
// this interface. It is unexported because no production code outside this
// package consumes it: per-strategy tests use inline stubs.
type remoteQueryResolver interface {
	// BuildOperation constructs the GraphQL operation to execute against the target.
	BuildOperation(rq *remoteQuery) *ast.OperationDefinition

	// ExtractResults extracts results from the remote response.
	ExtractResults(rq *remoteQuery, response any) []any

	// BuildResultLookup creates a lookup map from join key to results.
	BuildResultLookup(rq *remoteQuery, results []any) map[string][]any

	// GetJoinKeyFromParent extracts join key from a parent row for stitching.
	GetJoinKeyFromParent(rq *remoteQuery, parentRow map[string]any) string
}

// remoteQuery represents a pending remote relationship query.
// Uses composition with remoteQueryResolver for the type-specific logic.
type remoteQuery struct {
	targetConnector string
	alias           string
	isArray         bool
	joinArguments   []*remoteJoinArgument
	sourceField     *ast.Field
	fragments       ast.FragmentDefinitionList

	// parentPath is where localPhantomFields live (e.g. "games.homeTeam" for
	// a "games.homeTeam.department" relationship).
	parentPath          jsonpath.Path
	localPhantomFields  []string
	remotePhantomFields []string

	// resolver carries the strategy for type-specific operations. For
	// grouped-aggregate queries this is nil; the executor uses the
	// aggregateInfo fields below instead of going through resolver.
	resolver remoteQueryResolver

	// aggregateInfo, when non-nil, marks this remoteQuery as a cross-database
	// grouped-aggregate relationship and carries the inputs needed to invoke
	// the connector's groupedaggregate.Executor.
	aggregateInfo *aggregateInfo
}

// aggregateInfo carries the fields needed to dispatch a cross-database
// grouped-aggregate relationship through the connector's grouped-aggregate
// executor, bypassing the normal GraphQL operation path.
type aggregateInfo struct {
	// targetTableSchema is the database schema (e.g. "public") of the table
	// the aggregate is grouped over, used to resolve the GraphQL type name.
	targetTableSchema string
	// targetTableName is the unqualified table name the aggregate is grouped
	// over (paired with targetTableSchema for type-name resolution).
	targetTableName string
	// joinMapping maps source column → target column. For v1 only
	// single-column mappings are supported (multi-column GROUP BY is not
	// yet implemented).
	joinMapping map[string]string
}

// remoteJoinArgument represents join key values extracted from a row for
// remote queries.
type remoteJoinArgument struct {
	values map[string]any
}

// newRemoteJoinArgument creates a new remoteJoinArgument with the given values.
func newRemoteJoinArgument(values map[string]any) *remoteJoinArgument {
	return &remoteJoinArgument{
		values: values,
	}
}

// buildOperation delegates to the resolver.
func (rq *remoteQuery) buildOperation() *ast.OperationDefinition {
	if rq.resolver == nil {
		return nil
	}

	return rq.resolver.BuildOperation(rq)
}

// extractResults delegates to the resolver.
func (rq *remoteQuery) extractResults(response any) []any {
	if rq.resolver == nil {
		return nil
	}

	return rq.resolver.ExtractResults(rq, response)
}

// buildResultLookup delegates to the resolver.
func (rq *remoteQuery) buildResultLookup(results []any) map[string][]any {
	if rq.resolver == nil {
		return nil
	}

	return rq.resolver.BuildResultLookup(rq, results)
}

// getJoinKeyFromParent delegates to the resolver.
func (rq *remoteQuery) getJoinKeyFromParent(parentRow map[string]any) string {
	if rq.resolver == nil {
		return ""
	}

	return rq.resolver.GetJoinKeyFromParent(rq, parentRow)
}

// stitchResults places remote results into parent data. The stitching logic is
// identical for both database- and schema-resolver strategies; only the
// key/result extraction differs.
func (rq *remoteQuery) stitchResults(results map[string]any, resultLookup map[string][]any) {
	if rq.parentPath.IsEmpty() {
		return
	}

	outputName := rq.alias

	rq.parentPath.ForEach(results, func(parentRow map[string]any) {
		key := rq.getJoinKeyFromParent(parentRow)
		matches := resultLookup[key]

		if rq.isArray {
			if matches == nil {
				matches = []any{}
			}

			parentRow[outputName] = matches

			return
		}

		// Object relationship - take first match or null
		if len(matches) > 0 {
			parentRow[outputName] = matches[0]
		} else {
			parentRow[outputName] = nil
		}
	})
}

// removePhantomFieldsFromRemoteResults removes phantom fields from remote
// results. Like stitchResults, this is identical across resolver strategies.
func (rq *remoteQuery) removePhantomFieldsFromRemoteResults(results []any) {
	for _, result := range results {
		if resultMap, ok := result.(map[string]any); ok {
			for _, field := range rq.remotePhantomFields {
				delete(resultMap, field)
			}
		}
	}
}

// getLocalPhantomFields returns the local phantom fields.
func (rq *remoteQuery) getLocalPhantomFields() []string {
	return rq.localPhantomFields
}

// getParentPath returns the parent path used to locate parent rows for stitching.
func (rq *remoteQuery) getParentPath() jsonpath.Path {
	return rq.parentPath
}
