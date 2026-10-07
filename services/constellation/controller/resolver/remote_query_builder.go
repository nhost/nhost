package resolver

import (
	"sort"

	"github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
)

// typeNameResolver resolves the GraphQL type name for a target table.
// The identifier is "schema.table" format.
// Returns the resolved GraphQL type name, or the table name as fallback.
type typeNameResolver func(connectorName, identifier string) string

// BuildRemoteQueriesFromPlan eagerly builds remoteQuery objects from the
// initial results. Retained for compatibility and isolated strategy tests;
// production uses ResolvePlanned so child joins can read stitched parent rows.
func BuildRemoteQueriesFromPlan(
	results map[string]any,
	plan *planner.QueryPlan,
	fragments ast.FragmentDefinitionList,
	resolveTypeName typeNameResolver,
) []*remoteQuery { //nolint:revive // pendingQueries flow through Resolve; caller uses inferred type
	if plan == nil {
		return nil
	}

	var remoteQueries []*remoteQuery

	for _, rqp := range plan.RemoteQueries {
		rq := buildRemoteQueryFromPlan(results, rqp, fragments, resolveTypeName)
		if rq != nil {
			remoteQueries = append(remoteQueries, rq)
		}
	}

	return remoteQueries
}

// buildRemoteQueryFromPlan creates a remoteQuery from a RemoteQueryPlan and results.
func buildRemoteQueryFromPlan(
	results map[string]any,
	rqp *planner.RemoteQueryPlan,
	fragments ast.FragmentDefinitionList,
	resolveTypeName typeNameResolver,
) *remoteQuery {
	if rqp.SourcePath.IsEmpty() || len(rqp.SourcePath.ToRows(results)) == 0 {
		return nil
	}

	joinArgs := extractJoinArgumentsFromPlan(results, rqp)

	localPhantomFields, localJoinAliases := sourcePhantoms(rqp)

	// Grouped-aggregate cross-DB relationships bypass the resolver/operation
	// pipeline and go directly through the target connector's
	// groupedaggregate.Executor; aggregateInfo carries the needed inputs.
	if rqp.IsArrayAggregate {
		return &remoteQuery{
			targetConnector:     rqp.TargetConnector,
			alias:               rqp.OutputField,
			isArray:             true,
			joinArguments:       joinArgs,
			sourceColumns:       getSourceColumns(rqp),
			sourceField:         rqp.Selection,
			fragments:           fragments,
			parentPath:          rqp.SourcePath,
			namePath:            rqp.SourceNamePath,
			localPhantomFields:  localPhantomFields,
			localJoinAliases:    localJoinAliases,
			remotePhantomFields: nil,
			remoteJoinAliases:   nil,
			resolver:            nil,
			collectionInfo:      nil,
			aggregateInfo: &aggregateInfo{
				targetTableSchema: rqp.TargetTableSchema,
				targetTableName:   rqp.TargetTable,
				joinMapping:       rqp.JoinMapping,
			},
		}
	}

	var resolver remoteQueryResolver
	if rqp.ResolverType == planner.ResolverKindSchema {
		resolver = createSchemaResolver(rqp)
	} else {
		resolver = createDatabaseResolver(rqp, resolveTypeName)
	}

	return &remoteQuery{
		targetConnector:     rqp.TargetConnector,
		alias:               rqp.OutputField,
		isArray:             rqp.IsArray,
		joinArguments:       joinArgs,
		sourceColumns:       getSourceColumns(rqp),
		sourceField:         rqp.Selection,
		fragments:           fragments,
		parentPath:          rqp.SourcePath,
		namePath:            rqp.SourceNamePath,
		localPhantomFields:  localPhantomFields,
		localJoinAliases:    localJoinAliases,
		remotePhantomFields: nil, // Set by resolver during BuildOperation.
		remoteJoinAliases:   nil, // Set by resolver during BuildOperation when needed.
		resolver:            resolver,
		collectionInfo:      collectionInfoFromPlan(rqp),
		aggregateInfo:       nil,
	}
}

func collectionInfoFromPlan(rqp *planner.RemoteQueryPlan) *aggregateInfo {
	if !rqp.IsArray || rqp.ResolverType != planner.ResolverKindDatabase {
		return nil
	}

	return &aggregateInfo{
		targetTableSchema: rqp.TargetTableSchema,
		targetTableName:   rqp.TargetTable,
		joinMapping:       rqp.JoinMapping,
	}
}

func sourcePhantoms(rqp *planner.RemoteQueryPlan) ([]string, map[string]string) {
	if rqp.SourcePhantomFields == nil {
		return nil, nil
	}

	return rqp.SourcePhantomFields.Fields, rqp.SourcePhantomFields.Aliases
}

// extractJoinArgumentsFromPlan extracts join arguments from results based on the plan.
func extractJoinArgumentsFromPlan(
	results map[string]any,
	rqp *planner.RemoteQueryPlan,
) []*remoteJoinArgument {
	parentPath := rqp.SourcePath
	if parentPath.IsEmpty() {
		return nil
	}

	rows := parentPath.ToRows(results)
	if len(rows) == 0 {
		return nil
	}

	sourceColumns := getSourceColumns(rqp)
	sort.Strings(sourceColumns)

	return buildJoinArguments(rows, sourceColumns, sourceColumnAliases(rqp))
}

func sourceColumnAliases(rqp *planner.RemoteQueryPlan) map[string]string {
	if rqp.SourcePhantomFields == nil || len(rqp.SourcePhantomFields.Aliases) == 0 {
		return nil
	}

	return rqp.SourcePhantomFields.Aliases
}

// getSourceColumns returns the source columns for join key building.
func getSourceColumns(rqp *planner.RemoteQueryPlan) []string {
	if rqp.ResolverType == planner.ResolverKindSchema && len(rqp.LHSFields) > 0 {
		cols := make([]string, len(rqp.LHSFields))
		copy(cols, rqp.LHSFields)

		return cols
	}

	cols := make([]string, 0, len(rqp.JoinMapping))
	for col := range rqp.JoinMapping {
		cols = append(cols, col)
	}

	return cols
}

// buildJoinArguments builds unique join arguments from rows. Rows whose
// source columns contain any nulls are skipped (no join target).
func buildJoinArguments(
	rows []map[string]any,
	sourceColumns []string,
	sourceColumnAliases map[string]string,
) []*remoteJoinArgument {
	seen := make(map[string]struct{})

	var joinArgs []*remoteJoinArgument

	for _, row := range rows {
		keyParts := make([]string, 0, len(sourceColumns))
		values := make(map[string]any)
		hasNull := false

		for _, sourceCol := range sourceColumns {
			lookupKey := sourceCol
			if alias, ok := sourceColumnAliases[sourceCol]; ok {
				lookupKey = alias
			}

			val := row[lookupKey]
			if val == nil {
				hasNull = true

				break
			}

			keyParts = append(keyParts, joinValueDedupKey(val))
			values[sourceCol] = val
		}

		if hasNull {
			continue
		}

		key := joinPartsKey(keyParts)
		if _, exists := seen[key]; exists {
			continue
		}

		seen[key] = struct{}{}

		joinArgs = append(joinArgs, newRemoteJoinArgument(values))
	}

	return joinArgs
}

// createDatabaseResolver creates a databaseResolver from the plan.
// It resolves the target table name to its GraphQL type name using the resolver.
func createDatabaseResolver(
	rqp *planner.RemoteQueryPlan,
	resolveTypeName typeNameResolver,
) *databaseResolver {
	targetTableName := rqp.TargetTable

	// Resolve the target table name to its GraphQL type name (handles custom names)
	if resolveTypeName != nil && rqp.TargetTableSchema != "" {
		targetTableName = resolveTypeName(
			rqp.TargetConnector,
			rqp.TargetTableSchema+"."+rqp.TargetTable,
		)
	}

	return newDatabaseResolver(rqp.JoinMapping, targetTableName)
}

// createSchemaResolver creates a schemaResolver from the plan.
func createSchemaResolver(rqp *planner.RemoteQueryPlan) *schemaResolver {
	// Convert planner.RemoteFieldPathEntry to metadata.RemoteFieldPathEntry
	remoteFieldPath := make([]metadata.RemoteFieldPathEntry, len(rqp.RemoteFieldPath))

	for i, entry := range rqp.RemoteFieldPath {
		remoteFieldPath[i] = metadata.RemoteFieldPathEntry{
			FieldName: entry.FieldName,
			Arguments: entry.Arguments,
		}
	}

	return newSchemaResolver(rqp.LHSFields, remoteFieldPath)
}
