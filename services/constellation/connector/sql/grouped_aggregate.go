package sql //nolint:revive,nolintlint // package name "sql" shadows database/sql; see sql.go for the rationale.

import (
	"context"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"fmt"
	"log/slog"

	"github.com/nhost/nhost/services/constellation/connector/groupedaggregate"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	groupedaggdispatch "github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/groupedaggregate"
)

// ExecuteGroupedAggregate runs a grouped aggregate query and returns the
// results keyed by the stringified join value. Implements
// connector.GroupedAggregateExecutor.
//
// The shape of each value is
//
//	{ "aggregate": {...}, "nodes": [...] }
//
// matching the same-database aggregate field's response. An entry is present
// for every join value, including those with no matching target rows
// (count: 0, nodes: []).
func (c *Connector) ExecuteGroupedAggregate(
	ctx context.Context,
	req groupedaggregate.Request,
	role string,
	sessionVariables map[string]any,
	logger *slog.Logger,
) (map[string]any, error) {
	op, err := c.groupedAggOp.BuildGroupedAggregateSQL(groupedaggdispatch.BuildInput{
		TableSchema:       req.TableSchema,
		TableName:         req.TableName,
		Field:             req.Field,
		Fragments:         req.Fragments,
		Variables:         req.Variables,
		Role:              role,
		SessionVariables:  sessionVariables,
		JoinColumnSQLName: req.JoinColumnSQLName,
		JoinValues:        req.JoinValues,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to build grouped aggregate SQL: %w", err)
	}

	results, err := c.driver.ExecuteOperations(ctx, []core.SQLOperation{op}, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to execute grouped aggregate: %w", err)
	}

	raw, ok := results[op.Name]
	if !ok {
		return nil, fmt.Errorf("grouped aggregate result missing for %q", op.Name)
	}

	return parseGroupedAggregateResult(raw)
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
			"unexpected grouped aggregate result type %T (expected jsontext.Value)", raw,
		)
	}

	var rows []map[string]any
	if err := json.Unmarshal(jsonBytes, &rows); err != nil {
		return nil, fmt.Errorf("failed to unmarshal grouped aggregate result: %w", err)
	}

	out := make(map[string]any, len(rows))

	for _, row := range rows {
		key, hasKey := row["_join_key"]
		if !hasKey {
			return nil, fmt.Errorf("grouped aggregate row missing _join_key: %v", row)
		}

		entry := make(map[string]any, 2) //nolint:mnd
		if agg, ok := row["aggregate"]; ok {
			entry["aggregate"] = agg
		}

		if nodes, ok := row["nodes"]; ok {
			entry["nodes"] = nodes
		}

		out[fmt.Sprintf("%v", key)] = entry
	}

	return out, nil
}
