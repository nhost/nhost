package postgres

import (
	"context"
	"encoding/json"
	"encoding/json/jsontext"
	"errors"
	"fmt"
	"maps"

	"github.com/jackc/pgx/v5"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

type physicalInsertRow map[string]*string

var (
	errZeroObjectInsert    = errors.New("cannot proceed to insert object relation")
	errZeroArrayParent     = errors.New("cannot proceed to insert array relations")
	errMissingInsertSource = errors.New("missing dependent source")
	errMissingInsertFK     = errors.New("dependent foreign key is missing")
)

// executeInsertPlan runs the pre-rendered dependent statements on the same
// Querier (the source transaction) as every other root field. Each level's
// rows are captured before descending into its after-parent relationships;
// no select filter or PK lookup is used to recover inserted rows.
func executeInsertPlan(
	ctx context.Context,
	q Querier,
	plan *core.InsertPlan,
) (jsontext.Value, error) {
	rootRows, affected, err := executeInsertLevel(ctx, q, plan.Root, nil)
	if err != nil {
		return nil, err
	}

	rootJSON, err := json.Marshal(rootRows)
	if err != nil {
		return nil, fmt.Errorf("encoding captured root rows: %w", err)
	}

	params := append([]any(nil), plan.FinalParameters...)

	params[0] = string(rootJSON)
	if plan.Collection {
		params[1] = affected - len(rootRows)
	}

	var raw []byte
	if err := q.QueryRow(ctx, plan.FinalSQL, params...).Scan(&raw); err != nil {
		if errors.Is(err, pgx.ErrNoRows) && !plan.Collection {
			return nil, nil
		}

		return nil, fmt.Errorf("failed to scan result row: %w", err)
	}

	return jsontext.Value(raw), nil
}

func executeInsertLevel(
	ctx context.Context,
	q Querier,
	level core.InsertLevel,
	sources map[string]physicalInsertRow,
) ([]physicalInsertRow, int, error) {
	if level.Batch != nil {
		rows, err := executeInsertStatement(ctx, q, *level.Batch, sources)
		return rows, len(rows), err
	}

	rows := make([]physicalInsertRow, 0, len(level.Objects))

	count := 0
	for _, obj := range level.Objects {
		rowSources := make(map[string]physicalInsertRow, len(sources)+len(obj.Before))
		maps.Copy(rowSources, sources)

		beforeCount, err := executeBeforeInsertBranches(ctx, q, obj.Before, rowSources)
		if err != nil {
			return nil, 0, err
		}

		count += beforeCount

		inserted, err := executeInsertStatement(ctx, q, obj.Row, rowSources)
		if err != nil {
			return nil, 0, err
		}

		count += len(inserted)
		if len(inserted) == 0 && (len(obj.Arrays) > 0 || len(obj.AfterObjects) > 0) {
			return nil, 0, fmt.Errorf(
				"%w since insert to table %s affects zero rows",
				errZeroArrayParent, obj.Row.TableRef,
			)
		}

		if len(inserted) == 0 {
			continue
		}

		rows = append(rows, inserted[0])

		rowSources["$parent"] = inserted[0]
		for _, branches := range [][]core.InsertBranch{obj.Arrays, obj.AfterObjects} {
			n, err := executeAfterInsertBranches(ctx, q, branches, rowSources)
			if err != nil {
				return nil, 0, err
			}

			count += n
		}
	}

	return rows, count, nil
}

func executeBeforeInsertBranches(
	ctx context.Context,
	q Querier,
	branches []core.InsertBranch,
	sources map[string]physicalInsertRow,
) (int, error) {
	count := 0
	for _, branch := range branches {
		inserted, n, err := executeInsertLevel(ctx, q, branch.Level, sources)
		if err != nil {
			return 0, err
		}

		if len(inserted) != 1 {
			return 0, fmt.Errorf(
				"%w %q since insert affects zero rows",
				errZeroObjectInsert,
				branch.Name,
			)
		}

		sources[branch.Name] = inserted[0]
		count += n
	}

	return count, nil
}

func executeAfterInsertBranches(
	ctx context.Context,
	q Querier,
	branches []core.InsertBranch,
	sources map[string]physicalInsertRow,
) (int, error) {
	count := 0
	for _, branch := range branches {
		_, n, err := executeInsertLevel(ctx, q, branch.Level, sources)
		if err != nil {
			return 0, err
		}

		count += n
	}

	return count, nil
}

func executeInsertStatement(
	ctx context.Context, q Querier, stmt core.InsertStatement, sources map[string]physicalInsertRow,
) ([]physicalInsertRow, error) {
	params := make([]any, len(stmt.Parameters))
	for i, value := range stmt.Parameters {
		fk, ok := value.(core.InsertFKValue)
		if !ok {
			params[i] = value
			continue
		}

		row, exists := sources[fk.Source]
		if !exists {
			return nil, fmt.Errorf("%w %q", errMissingInsertSource, fk.Source)
		}

		col, exists := row[fk.Column]
		if !exists {
			return nil, fmt.Errorf("%w: %s.%s", errMissingInsertFK, fk.Source, fk.Column)
		}

		if col == nil {
			// A real SQL NULL in a returned nullable source remains SQL NULL.
			// A parent that returned *no row* is rejected by executeInsertLevel.
			params[i] = nil
			continue
		}

		params[i] = *col
	}

	var data []byte
	if err := q.QueryRow(ctx, stmt.SQL, params...).Scan(&data); err != nil {
		return nil, fmt.Errorf("failed to scan result row: %w", err)
	}

	var rows []physicalInsertRow
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, fmt.Errorf("decoding captured physical rows: %w", err)
	}

	return rows, nil
}
