package queries_test

import (
	"context"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"log/slog"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
)

// These test adapters let the ordinary golden harness exercise the product
// driver inside its existing rollback-only test transaction, rather than
// allocating a second pool for each nested golden or committing fixture rows.
type insertTestTx struct{ pgx.Tx }

func (q insertTestTx) Query(ctx context.Context, sql string, args ...any) (postgres.Rows, error) {
	return q.Tx.Query(ctx, sql, args...) //nolint:wrapcheck,sqlclosecheck
}

func (q insertTestTx) QueryRow(ctx context.Context, sql string, args ...any) postgres.Row {
	return q.Tx.QueryRow(ctx, sql, args...)
}

func (q insertTestTx) Exec(ctx context.Context, sql string, args ...any) error {
	_, err := q.Tx.Exec(ctx, sql, args...)
	return err //nolint:wrapcheck
}

// Commit rolls back only in the golden fixture, never in the product driver.
func (q insertTestTx) Commit(
	ctx context.Context,
) error {
	if err := q.Rollback(ctx); err != nil {
		return fmt.Errorf("fixture rollback: %w", err)
	}

	return nil
}

type insertTestPool struct{ insertTestTx }

func (q insertTestPool) BeginTx(context.Context) (postgres.Tx, error) {
	return q.insertTestTx, nil
}
func (insertTestPool) Close() {}

func executeInsertGolden(t *testing.T, tx pgx.Tx, operation core.SQLOperation) any {
	t.Helper()

	client := postgres.NewClient(insertTestPool{insertTestTx{tx}})

	result, err := client.ExecuteOperations(
		t.Context(),
		[]core.SQLOperation{operation},
		slog.New(slog.DiscardHandler),
	)
	if err != nil {
		if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok {
			return postgresErrorGolden(pgErr)
		}

		return fmt.Errorf("executing insert golden: %w", err)
	}

	value, ok := result[operation.Name].(jsontext.Value)
	if !ok {
		return nil
	}

	var decoded any
	if err := json.Unmarshal(value, &decoded); err != nil {
		t.Fatalf("decode dependent result: %v", err)
	}

	return []any{decoded}
}

func postgresErrorGolden(pgErr *pgconn.PgError) map[string]any {
	return map[string]any{
		"Severity": pgErr.Severity, "SeverityUnlocalized": pgErr.SeverityUnlocalized,
		"Code": pgErr.Code, "Message": pgErr.Message, "Detail": pgErr.Detail,
		"Hint": pgErr.Hint, "Position": pgErr.Position,
		"InternalPosition": pgErr.InternalPosition, "InternalQuery": pgErr.InternalQuery,
		"Where": pgErr.Where, "SchemaName": pgErr.SchemaName,
		"TableName": pgErr.TableName, "ColumnName": pgErr.ColumnName,
		"DataTypeName": pgErr.DataTypeName, "ConstraintName": pgErr.ConstraintName,
		"File": pgErr.File, "Line": pgErr.Line, "Routine": pgErr.Routine,
	}
}
