package resolver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"

	"github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/connector/groupedaggregate"
	connectorrelationships "github.com/nhost/nhost/services/constellation/connector/relationships"
	"github.com/vektah/gqlparser/v2/ast"
)

// errAggregateMultiColumnJoinUnsupported is returned when a cross-database
// aggregate relationship uses a multi-column join mapping. The grouped
// aggregate SQL builder currently supports only single-column GROUP BY.
var errAggregateMultiColumnJoinUnsupported = errors.New(
	"cross-database aggregate relationships with multi-column joins are not yet supported",
)

// errAggregateConnectorNotSupported is returned when the target connector
// does not implement groupedaggregate.Executor — i.e. it is not a SQL
// connector. The schema generator guards against this case but we keep the
// runtime check for safety.
var errAggregateConnectorNotSupported = errors.New(
	"target connector does not support grouped aggregates",
)

// executeAndStitchAggregate executes a cross-database grouped-aggregate
// relationship by invoking the target connector's groupedaggregate.Executor
// and writing the per-parent aggregate result into the parent rows.
func (r *RemoteRelationshipResolver) executeAndStitchAggregate(
	ctx context.Context,
	results map[string]any,
	rq *remoteQuery,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	logger *slog.Logger,
) error {
	info := rq.aggregateInfo
	if info == nil {
		return nil
	}

	if len(info.joinMapping) != 1 {
		return errAggregateMultiColumnJoinUnsupported
	}

	var sourceCol, targetCol string
	for s, t := range info.joinMapping {
		sourceCol, targetCol = s, t
	}

	target, ok := r.connectors[rq.targetConnector]
	if !ok {
		return fmt.Errorf("%w: %s", errTargetConnectorNotFound, rq.targetConnector)
	}

	exec, ok := r.aggregateExecutors[rq.targetConnector]
	if !ok {
		return fmt.Errorf("%w: %s", errAggregateConnectorNotSupported, rq.targetConnector)
	}

	jsonTarget, err := aggregateTargetIsJSON(target, info, targetCol, role)
	if err != nil {
		return err
	}

	req, err := newAggregateRequest(rq, sourceCol, targetCol, jsonTarget, fragments, variables)
	if err != nil {
		return err
	}

	if len(req.JoinValues) == 0 {
		stitchAggregateResults(rq, results, nil, sourceCol, jsonTarget)

		return nil
	}

	perKey, err := exec.ExecuteGroupedAggregate(
		ctx,
		req,
		role,
		sessionVariables,
		logger,
	)
	if err != nil {
		return fmt.Errorf("grouped aggregate execution failed: %w", err)
	}

	stitchAggregateResults(rq, results, perKey, sourceCol, jsonTarget)

	return nil
}

func newAggregateRequest(
	rq *remoteQuery, sourceCol, targetCol string, jsonTarget bool,
	fragments ast.FragmentDefinitionList, variables map[string]any,
) (groupedaggregate.Request, error) {
	joinValues, err := aggregateJoinValues(rq.joinArguments, sourceCol, jsonTarget)
	if err != nil {
		return groupedaggregate.Request{}, err
	}

	if len(joinValues) == 0 {
		var empty groupedaggregate.Request

		return empty, nil
	}

	req, err := groupedaggregate.NewRequest(groupedaggregate.Request{
		TableSchema:       rq.aggregateInfo.targetTableSchema,
		AllowEmptySchema:  false,
		TableName:         rq.aggregateInfo.targetTableName,
		JoinColumnSQLName: targetCol,
		JoinValues:        joinValues,
		JoinColumns:       nil,
		JoinTuples:        nil,
		JSONTargets:       nil,
		JSONTarget:        jsonTarget,
		Field:             rq.sourceField,
		ArgumentPath:      rq.argumentPath(),
		Fragments:         fragments,
		Variables:         variables,
	})
	if err != nil {
		return groupedaggregate.Request{}, fmt.Errorf("building grouped aggregate request: %w", err)
	}

	return req, nil
}

func aggregateTargetIsJSON(
	target connector.Connector, info *aggregateInfo, targetCol, role string,
) (bool, error) {
	if target == nil {
		return false, nil
	}

	schemas, err := target.GetSchema()
	if err != nil {
		return false, fmt.Errorf("loading aggregate target schema: %w", err)
	}

	typeName := target.GetTypeName(info.targetTableSchema + "." + info.targetTableName)
	db := newDatabaseResolver(nil, typeName)
	db.setTargetTypes(
		schemas[role], schemas["admin"],
		connectorrelationships.CustomizedTypeName(target, typeName),
	)

	return db.jsonColumns[targetCol], nil
}

func aggregateJoinValues(
	joinArgs []*remoteJoinArgument,
	sourceCol string,
	jsonTarget bool,
) ([]any, error) {
	joinValues := uniqueJoinValues(joinArgs, sourceCol, jsonTarget)
	if !jsonTarget {
		return joinValues, nil
	}

	for i, value := range joinValues {
		encoded, err := json.Marshal(value)
		if err != nil {
			return nil, fmt.Errorf("encoding aggregate JSON join key: %w", err)
		}

		joinValues[i] = string(encoded)
	}

	return joinValues, nil
}

// uniqueJoinValues collects the non-nil, deduplicated values of sourceCol
// across all join arguments. Used to build the IN-list for a grouped
// aggregate execution.
func uniqueJoinValues(joinArgs []*remoteJoinArgument, sourceCol string, jsonTarget bool) []any {
	joinValues := make([]any, 0, len(joinArgs))
	seen := make(map[string]struct{}, len(joinArgs))

	for _, arg := range joinArgs {
		v := arg.values[sourceCol]
		if v == nil {
			continue
		}

		key := joinValueDedupKey(v)
		if jsonTarget {
			key = groupedaggregate.JoinKey(v, true)
		}

		if _, ok := seen[key]; ok {
			continue
		}

		seen[key] = struct{}{}

		joinValues = append(joinValues, v)
	}

	return joinValues
}

// stitchAggregateResults writes the per-key aggregate result into each parent
// row at the rq.alias field. Parents whose join key has no entry in perKey
// receive a zero-valued aggregate object built from the user's selection.
func stitchAggregateResults(
	rq *remoteQuery,
	results map[string]any,
	perKey map[string]any,
	sourceCol string,
	jsonTarget bool,
) {
	parentPath := rq.getParentPath()
	if parentPath.IsEmpty() {
		return
	}

	outputName := rq.alias

	lookupKey := sourceCol
	if alias, ok := rq.localJoinAliases[sourceCol]; ok {
		lookupKey = alias
	}

	parentPath.ForEach(results, func(parentRow map[string]any) {
		v := parentRow[lookupKey]
		if v == nil {
			parentRow[outputName] = nil

			return
		}

		key := groupedaggregate.JoinKey(v, jsonTarget)
		if entry, ok := perKey[key]; ok {
			parentRow[outputName] = entry

			return
		}

		parentRow[outputName] = emptyAggregateForSelection(rq.sourceField)
	})
}

// aggregateSubFieldCount is the number of top-level sub-fields a grouped-
// aggregate payload commonly exposes: aggregate and nodes, each under its
// GraphQL response name.
const aggregateSubFieldCount = 2

// emptyAggregateForSelection produces a default { aggregate: {...}, nodes: [] }
// payload shaped to match the user's selection. Used to fill in parent rows
// whose join key returned no matching target rows.
func emptyAggregateForSelection(field *ast.Field) map[string]any {
	out := make(map[string]any, aggregateSubFieldCount)

	for _, sel := range field.SelectionSet {
		sub, ok := sel.(*ast.Field)
		if !ok {
			continue
		}

		responseName := aggregateResponseName(sub)

		switch sub.Name {
		case "aggregate":
			out[responseName] = emptyAggregateBlock(sub)
		case "nodes":
			out[responseName] = []any{}
		}
	}

	return out
}

func aggregateResponseName(field *ast.Field) string {
	if field.Alias != "" {
		return field.Alias
	}

	return field.Name
}

// emptyAggregateBlock fills the requested aggregate sub-fields with zero values:
// count → 0, all numeric/extremum aggregates → null per-column.
func emptyAggregateBlock(field *ast.Field) map[string]any {
	out := make(map[string]any, len(field.SelectionSet))

	for _, sel := range field.SelectionSet {
		sub, ok := sel.(*ast.Field)
		if !ok {
			continue
		}

		responseName := aggregateResponseName(sub)
		if sub.Name == "count" {
			out[responseName] = 0

			continue
		}

		cols := make(map[string]any, len(sub.SelectionSet))
		for _, colSel := range sub.SelectionSet {
			if colField, isField := colSel.(*ast.Field); isField {
				cols[aggregateResponseName(colField)] = nil
			}
		}

		out[responseName] = cols
	}

	return out
}
