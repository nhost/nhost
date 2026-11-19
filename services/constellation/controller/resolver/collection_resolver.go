package resolver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sort"
	"strconv"

	"github.com/nhost/nhost/services/constellation/connector/groupedaggregate"
	"github.com/vektah/gqlparser/v2/ast"
)

var (
	errCollectionExecutorUnavailable = errors.New(
		"remote array target cannot execute per-parent modifiers",
	)
	errInvalidCollectionResult = errors.New("invalid grouped remote array result")
)

// groupedCollectionExecutor is the SQL connector's target-side batched array
// extension. It is defined at the consumer boundary; non-SQL connectors never
// claim to support the operation.
//
//go:generate mockgen -package mock -destination mock/grouped_collection_executor.go . groupedCollectionExecutor
type groupedCollectionExecutor interface {
	ExecuteGroupedCollection(
		ctx context.Context, req groupedaggregate.Request, role string,
		sessionVariables map[string]any, logger *slog.Logger,
	) (map[string]any, error)
}

func hasPerParentCollectionModifiers(field *ast.Field, variables map[string]any) bool {
	// Invalid negative pagination never executes a collection. Preserve the
	// target connector's existing GraphQL validation/error-path handling.
	for _, name := range []string{"limit", "offset"} {
		if arg := field.Arguments.ForName(name); arg != nil && arg.Value != nil {
			value, err := arg.Value.Value(variables)
			if err == nil {
				if number, parseErr := strconv.ParseFloat(
					fmt.Sprint(value), 64,
				); parseErr == nil && number < 0 {
					return false
				}
			}
		}
	}

	return field.Arguments.ForName("limit") != nil ||
		field.Arguments.ForName("offset") != nil ||
		field.Arguments.ForName("distinct_on") != nil
}

//nolint:funlen // Request preparation and key transport remain one ordered path.
func (r *RemoteRelationshipResolver) executeAndStitchCollection(
	ctx context.Context, results map[string]any, rq *remoteQuery,
	fragments ast.FragmentDefinitionList, variables map[string]any,
	role string, sessionVariables map[string]any, logger *slog.Logger,
) error {
	// buildJoinArguments has already removed every tuple containing a null
	// component and deduplicated complete tuples. A single effective key has
	// exactly the same window in the ordinary target operation on any backend.
	if len(rq.joinArguments) == 1 {
		return r.executeAndStitchOperation(ctx, results, rq, fragments, variables,
			role, sessionVariables, logger)
	}

	info := rq.collectionInfo

	target := r.connectors[rq.targetConnector]
	if target == nil {
		return fmt.Errorf("%w: %s", errTargetConnectorNotFound, rq.targetConnector)
	}

	exec, ok := target.(groupedCollectionExecutor)
	if !ok {
		return errCollectionExecutorUnavailable
	}

	db, ok := rq.resolver.(*databaseResolver)
	if !ok {
		return errCollectionExecutorUnavailable
	}

	sourceCols := make([]string, 0, len(info.joinMapping))
	for source := range info.joinMapping {
		sourceCols = append(sourceCols, source)
	}

	sort.Strings(sourceCols)
	targetCols := make([]string, len(sourceCols))

	jsonTargets := make([]bool, len(sourceCols))
	for i, source := range sourceCols {
		targetCols[i] = info.joinMapping[source]
		jsonTargets[i] = db.jsonColumns[targetCols[i]]
	}

	req, err := buildGroupedCollectionRequest(rq, info, fragments, variables)
	if err != nil {
		return fmt.Errorf("preparing grouped remote array: %w", err)
	}

	req.JoinColumns = targetCols
	req.JSONTargets = jsonTargets

	req.JoinTuples, err = collectionJoinTuples(rq.joinArguments, sourceCols, jsonTargets)
	if err != nil {
		return fmt.Errorf("preparing remote array join values: %w", err)
	}

	if len(targetCols) == 1 {
		req.JoinColumnSQLName = targetCols[0]
		req.JSONTarget = jsonTargets[0]
	}

	req, err = groupedaggregate.NewRequest(req)
	if err != nil {
		return fmt.Errorf("validating grouped collection request: %w", err)
	}

	perKey, err := exec.ExecuteGroupedCollection(ctx, req, role, sessionVariables, logger)
	if err != nil {
		return fmt.Errorf("executing grouped remote array: %w", err)
	}

	return stitchGroupedCollection(results, rq, perKey, sourceCols, jsonTargets)
}

func collectionJoinTuples(
	args []*remoteJoinArgument, sourceCols []string, jsonTargets []bool,
) ([][]any, error) {
	tuples := make([][]any, 0, len(args))
	for _, arg := range args {
		tuple := make([]any, len(sourceCols))
		for i, source := range sourceCols {
			value := arg.values[source]
			if jsonTargets[i] {
				encoded, err := json.Marshal(value)
				if err != nil {
					return nil, fmt.Errorf("encoding JSON join key %s: %w", source, err)
				}

				value = string(encoded)
			}

			tuple[i] = value
		}

		tuples = append(tuples, tuple)
	}

	return tuples, nil
}

func buildGroupedCollectionRequest(
	rq *remoteQuery, info *aggregateInfo, fragments ast.FragmentDefinitionList,
	variables map[string]any,
) (groupedaggregate.Request, error) {
	// BuildOperation injects target join-column phantoms and preserves the
	// original where/selection/aliases without writing to the cached AST.
	operation := rq.buildOperation()
	operation.SelectionSet = resolveVariableReferences(operation.SelectionSet, variables)

	field, ok := operation.SelectionSet[0].(*ast.Field)
	if !ok {
		return groupedaggregate.Request{}, errInvalidCollectionResult
	}

	// The ordinary operation's generated _in filter contains *all* parent
	// values. The correlated tuple predicate already constrains this key, so
	// retaining _in would repeat unbounded placeholders in every SQLite chunk.
	// Preserve only the client's where predicate (and its variables) here.
	args := make(ast.ArgumentList, 0, len(field.Arguments))
	if userWhere := findWhereArgument(rq.sourceField.Arguments); userWhere != nil {
		args = append(args, resolveArgumentVariables(ast.ArgumentList{userWhere}, variables)...)
	}

	for _, arg := range field.Arguments {
		if arg.Name != "where" {
			args = append(args, arg)
		}
	}

	field.Arguments = args

	selectedFragments := collectReferencedFragments(operation, fragments)
	for i, fragment := range selectedFragments {
		copyFragment := *fragment
		copyFragment.SelectionSet = resolveVariableReferences(fragment.SelectionSet, variables)
		selectedFragments[i] = &copyFragment
	}

	return groupedaggregate.Request{
		TableSchema: info.targetTableSchema, AllowEmptySchema: true,
		TableName: info.targetTableName, Field: field, ArgumentPath: rq.argumentPath(),
		Fragments: selectedFragments, Variables: variables,
		JoinColumnSQLName: "", JoinValues: nil, JoinColumns: nil, JoinTuples: nil,
		JSONTargets: nil, JSONTarget: false,
	}, nil
}

func stitchGroupedCollection(
	results map[string]any, rq *remoteQuery, perKey map[string]any,
	sourceCols []string, jsonTargets []bool,
) error {
	lookup := make(map[string][]any, len(rq.joinArguments))

	var selectedRows []any
	for _, arg := range rq.joinArguments {
		values := make([]any, len(sourceCols))

		parts := make([]string, len(sourceCols))
		for i, source := range sourceCols {
			values[i] = arg.values[source]
			parts[i] = joinValueKey(values[i], jsonTargets[i])
		}

		key := joinPartsKey(parts)

		groupKey := groupedaggregate.TupleKey(values, jsonTargets)
		if len(values) == 1 {
			groupKey = groupedaggregate.JoinKey(values[0], jsonTargets[0])
		}

		group, found := perKey[groupKey]
		if !found {
			continue
		}

		entry, ok := group.(map[string]any)
		if !ok {
			return fmt.Errorf("%w: group %T", errInvalidCollectionResult, group)
		}

		rows, ok := entry["nodes"].([]any)
		if !ok {
			return fmt.Errorf("%w: nodes %T", errInvalidCollectionResult, entry["nodes"])
		}

		lookup[key] = rows
		selectedRows = append(selectedRows, rows...)
	}

	rq.stitchResults(results, lookup)
	removeRemoteResultPhantoms(selectedRows, rq.remotePhantomFields)

	return nil
}
