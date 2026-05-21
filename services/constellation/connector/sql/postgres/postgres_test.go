package postgres_test

import (
	"encoding/json/jsontext"
	"errors"
	"log/slog"
	"testing"

	"github.com/jackc/pgx/v5"
	"go.uber.org/mock/gomock"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres/mock"
	sqlsub "github.com/nhost/nhost/services/constellation/connector/sql/subscription"
)

func discardLogger() *slog.Logger {
	return slog.New(slog.DiscardHandler)
}

// errScanFailed / errCommitFailed are package-level sentinels so the
// table-driven ExecuteOperations cases can use errors.Is without sharing
// closure state.
var (
	errScanFailed   = errors.New("scan failed")
	errCommitFailed = errors.New("commit failed")
)

// scanJSONInto returns a Row.Scan stub that copies payload into the *[]byte
// destination, so success-path cases produce a real jsontext.Value result.
func scanJSONInto(t *testing.T, payload []byte) func(dest ...any) error {
	t.Helper()

	return func(dest ...any) error {
		ptr, ok := dest[0].(*[]byte)
		if !ok {
			t.Fatal("expected *[]byte dest")
		}

		*ptr = payload

		return nil
	}
}

// expectExecuteErr asserts the result of a client.ExecuteOperations call
// matches the expected error/result shape for one table-driven case.
func expectExecuteErr(
	t *testing.T,
	err error,
	wantErrSubstring string,
	wantErrIs error,
) {
	t.Helper()

	switch {
	case wantErrSubstring != "":
		if err == nil {
			t.Fatal("expected error, got nil")
		}

		if got := err.Error(); got != wantErrSubstring {
			t.Errorf("unexpected error: %s", got)
		}
	case wantErrIs != nil:
		if err == nil {
			t.Fatal("expected error, got nil")
		}

		if !errors.Is(err, wantErrIs) {
			t.Errorf("expected error %v in chain, got: %v", wantErrIs, err)
		}
	default:
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	}
}

func TestExecuteOperations(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name             string
		setupMocks       func(t *testing.T, pool *mock.MockPool, tx *mock.MockTx, row *mock.MockRow)
		wantErrSubstring string
		wantErrIs        error
		wantResult       func(t *testing.T, result map[string]any)
	}{
		{
			name: "begin tx error",
			setupMocks: func(_ *testing.T, pool *mock.MockPool, _ *mock.MockTx, _ *mock.MockRow) {
				pool.EXPECT().
					BeginTx(gomock.Any()).
					Return(nil, errors.New("connection refused"))
			},
			wantErrSubstring: "failed to begin transaction: connection refused",
			wantErrIs:        nil,
			wantResult:       nil,
		},
		{
			name: "success",
			setupMocks: func(t *testing.T, pool *mock.MockPool, tx *mock.MockTx, row *mock.MockRow) {
				t.Helper()
				pool.EXPECT().BeginTx(gomock.Any()).Return(tx, nil)
				row.EXPECT().Scan(gomock.Any()).DoAndReturn(scanJSONInto(t, []byte(`{"id": 1}`)))
				tx.EXPECT().QueryRow(gomock.Any(), "SELECT 1", gomock.Any()).Return(row)
				tx.EXPECT().Commit(gomock.Any()).Return(nil)
			},
			wantErrSubstring: "",
			wantErrIs:        nil,
			wantResult: func(t *testing.T, result map[string]any) {
				t.Helper()

				v, ok := result["op1"]
				if !ok {
					t.Fatal("expected op1 in results")
				}

				jv, ok := v.(jsontext.Value)
				if !ok {
					t.Fatalf("expected jsontext.Value, got %T", v)
				}

				if got := string(jv); got != `{"id": 1}` {
					t.Errorf("unexpected result: %s", got)
				}
			},
		},
		{
			name: "err no rows",
			setupMocks: func(_ *testing.T, pool *mock.MockPool, tx *mock.MockTx, row *mock.MockRow) {
				pool.EXPECT().BeginTx(gomock.Any()).Return(tx, nil)
				row.EXPECT().Scan(gomock.Any()).Return(pgx.ErrNoRows)
				tx.EXPECT().QueryRow(gomock.Any(), "SELECT 1", gomock.Any()).Return(row)
				tx.EXPECT().Commit(gomock.Any()).Return(nil)
			},
			wantErrSubstring: "",
			wantErrIs:        nil,
			wantResult: func(t *testing.T, result map[string]any) {
				t.Helper()

				if v := result["op1"]; v != nil {
					t.Errorf("expected nil result for ErrNoRows, got %v", v)
				}
			},
		},
		{
			name: "scan error",
			setupMocks: func(_ *testing.T, pool *mock.MockPool, tx *mock.MockTx, row *mock.MockRow) {
				pool.EXPECT().BeginTx(gomock.Any()).Return(tx, nil)
				row.EXPECT().Scan(gomock.Any()).Return(errScanFailed)
				tx.EXPECT().QueryRow(gomock.Any(), "SELECT 1", gomock.Any()).Return(row)
				tx.EXPECT().Rollback(gomock.Any()).Return(nil)
			},
			wantErrSubstring: "",
			wantErrIs:        errScanFailed,
			wantResult:       nil,
		},
		{
			name: "commit error",
			setupMocks: func(t *testing.T, pool *mock.MockPool, tx *mock.MockTx, row *mock.MockRow) {
				t.Helper()
				pool.EXPECT().BeginTx(gomock.Any()).Return(tx, nil)
				row.EXPECT().Scan(gomock.Any()).DoAndReturn(scanJSONInto(t, []byte(`{"id": 1}`)))
				tx.EXPECT().QueryRow(gomock.Any(), "SELECT 1", gomock.Any()).Return(row)
				tx.EXPECT().Commit(gomock.Any()).Return(errCommitFailed)
				tx.EXPECT().Rollback(gomock.Any()).Return(nil)
			},
			wantErrSubstring: "",
			wantErrIs:        errCommitFailed,
			wantResult:       nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			pool := mock.NewMockPool(ctrl)
			tx := mock.NewMockTx(ctrl)
			row := mock.NewMockRow(ctrl)

			tt.setupMocks(t, pool, tx, row)

			client := postgres.NewClient(pool)

			result, err := client.ExecuteOperations(
				t.Context(),
				[]core.SQLOperation{{Name: "op1", SQL: "SELECT 1", Parameters: nil}},
				discardLogger(),
			)

			expectExecuteErr(t, err, tt.wantErrSubstring, tt.wantErrIs)

			if tt.wantResult != nil {
				tt.wantResult(t, result)
			}
		})
	}
}

// multiplexedSuccessMocks wires the rows iterator for the successful path of
// ExecuteMultiplexedOperation: two real subscription/data rows and a final
// Next()=false sentinel.
func multiplexedSuccessMocks(t *testing.T, pool *mock.MockPool, rows *mock.MockRows) {
	t.Helper()

	pool.EXPECT().
		Query(gomock.Any(), "SELECT sub_id, data", gomock.Any()).
		Return(rows, nil)

	call := 0
	rows.EXPECT().
		Next().
		DoAndReturn(func() bool {
			call++
			return call <= 2
		}).
		Times(3)

	rows.EXPECT().
		Scan(gomock.Any(), gomock.Any()).
		DoAndReturn(func(dest ...any) error {
			strPtr, ok := dest[0].(*string)
			if !ok {
				t.Fatal("expected *string dest[0]")
			}

			dataPtr, ok := dest[1].(*[]byte)
			if !ok {
				t.Fatal("expected *[]byte dest[1]")
			}

			switch call {
			case 1:
				*strPtr = "sub-1"
				*dataPtr = []byte(`{"a":1}`)
			case 2:
				*strPtr = "sub-2"
				*dataPtr = []byte(`{"a":2}`)
			}

			return nil
		}).
		Times(2)

	rows.EXPECT().Err().Return(nil)
	rows.EXPECT().Close()
}

func TestExecuteMultiplexedOperation(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name             string
		sql              string
		setupMocks       func(t *testing.T, pool *mock.MockPool, rows *mock.MockRows)
		wantErrSubstring string
		wantResults      []sqlsub.MultiplexedResult
	}{
		{
			name:             "success",
			sql:              "SELECT sub_id, data",
			setupMocks:       multiplexedSuccessMocks,
			wantErrSubstring: "",
			wantResults: []sqlsub.MultiplexedResult{
				{SubscriptionID: "sub-1", Data: []byte(`{"a":1}`)},
				{SubscriptionID: "sub-2", Data: []byte(`{"a":2}`)},
			},
		},
		{
			name: "query error",
			sql:  "SELECT 1",
			setupMocks: func(_ *testing.T, pool *mock.MockPool, _ *mock.MockRows) {
				pool.EXPECT().
					Query(gomock.Any(), gomock.Any(), gomock.Any()).
					Return(nil, errors.New("query failed"))
			},
			wantErrSubstring: "failed to execute multiplexed query: query failed",
			wantResults:      nil,
		},
		{
			name: "rows iteration error",
			sql:  "SELECT 1",
			setupMocks: func(_ *testing.T, pool *mock.MockPool, rows *mock.MockRows) {
				pool.EXPECT().
					Query(gomock.Any(), gomock.Any(), gomock.Any()).
					Return(rows, nil)
				rows.EXPECT().Next().Return(false)
				rows.EXPECT().Err().Return(errors.New("iteration error"))
				rows.EXPECT().Close()
			},
			wantErrSubstring: "error iterating multiplexed results: iteration error",
			wantResults:      nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			pool := mock.NewMockPool(ctrl)
			rows := mock.NewMockRows(ctrl)

			tt.setupMocks(t, pool, rows)

			client := postgres.NewClient(pool)

			results, err := client.ExecuteMultiplexedOperation(
				t.Context(), tt.sql, []any{"arg1"}, discardLogger(),
			)

			if tt.wantErrSubstring != "" {
				if err == nil {
					t.Fatal("expected error, got nil")
				}

				if got := err.Error(); got != tt.wantErrSubstring {
					t.Errorf("unexpected error: %s", got)
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if len(results) != len(tt.wantResults) {
				t.Fatalf("expected %d results, got %d", len(tt.wantResults), len(results))
			}

			for i, w := range tt.wantResults {
				if results[i].SubscriptionID != w.SubscriptionID ||
					string(results[i].Data) != string(w.Data) {
					t.Errorf("result[%d] = %+v, want %+v", i, results[i], w)
				}
			}
		})
	}
}

func TestDialect(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	pool := mock.NewMockPool(ctrl)

	client := postgres.NewClient(pool)
	d := client.Dialect()

	if _, ok := d.(*dialect.PostgresDialect); !ok {
		t.Errorf("expected *dialect.PostgresDialect, got %T", d)
	}
}

func TestClient_Close(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	pool := mock.NewMockPool(ctrl)

	pool.EXPECT().Close()

	client := postgres.NewClient(pool)
	client.Close()
}

func TestNewClient(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	pool := mock.NewMockPool(ctrl)

	client := postgres.NewClient(pool)
	if client == nil {
		t.Fatal("NewClient returned nil")
	}

	// The constructor must accept the Pool argument and expose the Dialect
	// without a connection — proves the wiring without a live database.
	if d := client.Dialect(); d == nil {
		t.Error("expected non-nil Dialect from NewClient output")
	}
}
