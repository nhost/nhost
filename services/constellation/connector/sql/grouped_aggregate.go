package sql //nolint:revive,nolintlint // package name "sql" shadows database/sql; see sql.go for the rationale.

import (
	"context"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"log/slog"

	"github.com/nhost/nhost/services/constellation/connector/groupedaggregate"
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

// ExecuteGroupedAggregate runs a grouped aggregate query and returns the
// results keyed by the stringified join value. Implements
// connector.GroupedAggregateExecutor.
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

	return parseGroupedAggregateResult(raw)
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
	})
	if err != nil {
		return core.SQLOperation{}, fmt.Errorf("failed to build grouped aggregate SQL: %w", err)
	}

	return op, nil
}

// parseGroupedAggregateResult unmarshals the single-row JSON array result of
// a grouped aggregate query into a map keyed by stringified join value.
func parseGroupedAggregateResult(raw any) (map[string]any, error) {
	if raw == nil {
		return map[string]any{}, nil
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

		out[fmt.Sprintf("%v", key)] = entry
	}

	return out, nil
}
