package sql //nolint:revive,nolintlint // package name "sql" shadows database/sql; see sql.go for the rationale.

import (
	"context"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"log/slog"
	"maps"

	"github.com/nhost/nhost/services/constellation/connector/groupedaggregate"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	groupedaggdispatch "github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/groupedaggregate"
)

// Errors returned by grouped aggregate execution and result parsing.
var (
	// ErrGroupedAggregateResultMissing reports that a grouped aggregate
	// operation completed but did not produce a result row for its named
	// operation.
	ErrGroupedAggregateResultMissing = errors.New("grouped aggregate result missing")
	// ErrGroupedAggregateUnexpectedType reports that a grouped aggregate
	// driver returned a value with a type other than jsontext.Value.
	ErrGroupedAggregateUnexpectedType = errors.New("unexpected grouped aggregate result type")
	// ErrGroupedAggregateMissingJoinKey reports that a grouped aggregate
	// result row was missing the required _join_key field.
	ErrGroupedAggregateMissingJoinKey = errors.New("grouped aggregate row missing _join_key")
)

// ExecuteGroupedCollection runs a bounded per-key array selection and returns
// only the requested target rows for each key. The same role and session
// permissions used by ordinary target operations are applied in the SQL builder.
func (c *Connector) ExecuteGroupedCollection(
	ctx context.Context,
	req groupedaggregate.Request,
	role string,
	sessionVariables map[string]any,
	logger *slog.Logger,
) (map[string]any, error) {
	if c.driver.Dialect().SupportsLateral() {
		return c.executeGroupedCollectionBatch(ctx, req, role, sessionVariables, logger)
	}

	return c.executeSQLiteGroupedCollection(ctx, req, role, sessionVariables, logger)
}

func (c *Connector) executeSQLiteGroupedCollection(
	ctx context.Context, req groupedaggregate.Request, role string,
	sessionVariables map[string]any, logger *slog.Logger,
) (map[string]any, error) {
	// SQLite defaults to 500 UNION terms and may have only 999 bind variables.
	// Keep both dimensions below those limits, without one query per parent.
	const maxKeyParameters = 200

	width := max(1, len(req.JoinColumns))
	chunkSize := max(1, maxKeyParameters/width)

	count := len(req.JoinValues)
	if len(req.JoinColumns) > 0 {
		count = len(req.JoinTuples)
	}

	merged := make(map[string]any, count)
	for start := 0; start < count; start += chunkSize {
		end := min(start+chunkSize, count)

		batch := req
		if len(req.JoinColumns) > 0 {
			batch.JoinTuples = req.JoinTuples[start:end]
		} else {
			batch.JoinValues = req.JoinValues[start:end]
		}

		rows, err := c.executeGroupedCollectionBatch(ctx, batch, role, sessionVariables, logger)
		if err != nil {
			return nil, err
		}

		maps.Copy(merged, rows)
	}

	return merged, nil
}

func (c *Connector) executeGroupedCollectionBatch(
	ctx context.Context, req groupedaggregate.Request, role string,
	sessionVariables map[string]any, logger *slog.Logger,
) (map[string]any, error) {
	op, err := c.groupedAggOp.BuildGroupedCollectionSQL(groupedaggdispatch.BuildInput{
		TableSchema: req.TableSchema, TableName: req.TableName,
		Field: req.Field, ArgumentPath: req.ArgumentPath,
		Fragments: req.Fragments, Variables: req.Variables,
		Role: role, SessionVariables: sessionVariables,
		JoinColumnSQLName: req.JoinColumnSQLName, JoinValues: req.JoinValues,
		JoinColumns: req.JoinColumns, JoinTuples: req.JoinTuples,
	}, c.roots.Operations[queries.OperationQuery])
	if err != nil {
		return nil, fmt.Errorf("building grouped collection: %w", err)
	}

	results, err := c.driver.ExecuteOperations(ctx, []core.SQLOperation{op}, logger)
	if err != nil {
		return nil, fmt.Errorf("executing grouped collection: %w", err)
	}

	raw, ok := results[op.Name]
	if !ok {
		return nil, fmt.Errorf("%w: %q", ErrGroupedAggregateResultMissing, op.Name)
	}

	if len(req.JoinColumns) > 1 {
		return parseGroupedCollectionTuples(raw, req.JSONTargets)
	}

	return parseGroupedAggregateResult(raw, req.JSONTarget)
}

// parseGroupedCollectionTuples preserves every tuple component's type while
// indexing composite join keys; single-column aggregate keys retain their
// existing parsing contract.
func parseGroupedCollectionTuples(raw any, jsonTargets []bool) (map[string]any, error) {
	rows, err := parseGroupedRows(raw)
	if err != nil {
		return nil, err
	}

	out := make(map[string]any, len(rows))
	for _, row := range rows {
		key, ok := row[groupedaggdispatch.ResultJoinKeyField].([]any)
		if !ok || len(key) != len(jsonTargets) {
			return nil, fmt.Errorf("%w: composite key", ErrGroupedAggregateMissingJoinKey)
		}

		delete(row, groupedaggdispatch.ResultJoinKeyField)
		out[groupedaggregate.TupleKey(key, jsonTargets)] = row
	}

	return out, nil
}

// ExecuteGroupedAggregate runs a grouped aggregate query and returns the
// results keyed by groupedaggregate.JoinKey. Implements
// groupedaggregate.Executor.
//
// Each value preserves the same GraphQL response fields emitted by the grouped
// aggregate SQL (aliases when present, otherwise "aggregate" / "nodes"), with
// only the internal join-key transport field removed. An entry is present for
// every join value, including those with no matching target rows (count: 0,
// nodes: []).
func (c *Connector) ExecuteGroupedAggregate(
	ctx context.Context,
	req groupedaggregate.Request,
	role string,
	sessionVariables map[string]any,
	logger *slog.Logger,
) (map[string]any, error) {
	op, err := c.buildGroupedAggregateOperation(req, role, sessionVariables)
	if err != nil {
		return nil, err
	}

	results, err := c.driver.ExecuteOperations(ctx, []core.SQLOperation{op}, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to execute grouped aggregate: %w", err)
	}

	raw, ok := results[op.Name]
	if !ok {
		return nil, fmt.Errorf("%w: %q", ErrGroupedAggregateResultMissing, op.Name)
	}

	return parseGroupedAggregateResult(raw, req.JSONTarget)
}

// ValidateGroupedAggregate builds the SQL for a grouped aggregate request and
// discards it, surfacing trusted argument failures without touching the
// database. The controller uses this before root connector execution when a
// mutation response selects a cross-database aggregate relationship.
func (c *Connector) ValidateGroupedAggregate(
	req groupedaggregate.Request,
	role string,
	sessionVariables map[string]any,
) error {
	_, err := c.buildGroupedAggregateOperation(req, role, sessionVariables)

	return err
}

func (c *Connector) buildGroupedAggregateOperation(
	req groupedaggregate.Request,
	role string,
	sessionVariables map[string]any,
) (core.SQLOperation, error) {
	op, err := c.groupedAggOp.BuildGroupedAggregateSQL(groupedaggdispatch.BuildInput{
		TableSchema:       req.TableSchema,
		TableName:         req.TableName,
		Field:             req.Field,
		ArgumentPath:      req.ArgumentPath,
		Fragments:         req.Fragments,
		Variables:         req.Variables,
		Role:              role,
		SessionVariables:  sessionVariables,
		JoinColumnSQLName: req.JoinColumnSQLName,
		JoinValues:        req.JoinValues,
		JoinColumns:       nil,
		JoinTuples:        nil,
	})
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf("failed to build grouped aggregate SQL: %w", err)
	}

	return op, nil
}

// parseGroupedAggregateResult unmarshals the single-row JSON array result of
// a grouped aggregate query into a map keyed like its parent join values.
func parseGroupedAggregateResult(raw any, jsonTarget bool) (map[string]any, error) {
	rows, err := parseGroupedRows(raw)
	if err != nil {
		return nil, err
	}

	out := make(map[string]any, len(rows))

	for _, row := range rows {
		key, hasKey := row[groupedaggdispatch.ResultJoinKeyField]
		if !hasKey {
			return nil, fmt.Errorf("%w: %v", ErrGroupedAggregateMissingJoinKey, row)
		}

		entry := make(map[string]any, len(row)-1)
		for name, value := range row {
			if name == groupedaggdispatch.ResultJoinKeyField {
				continue
			}

			entry[name] = value
		}

		out[groupedaggregate.JoinKey(key, jsonTarget)] = entry
	}

	return out, nil
}

func parseGroupedRows(raw any) ([]map[string]any, error) {
	if raw == nil {
		return nil, nil
	}

	jsonBytes, ok := raw.(jsontext.Value)
	if !ok {
		return nil, fmt.Errorf(
			"%w: %T (expected jsontext.Value)", ErrGroupedAggregateUnexpectedType, raw,
		)
	}

	var rows []map[string]any
	if err := json.Unmarshal(jsonBytes, &rows); err != nil {
		return nil, fmt.Errorf("failed to unmarshal grouped aggregate result: %w", err)
	}

	return rows, nil
}
