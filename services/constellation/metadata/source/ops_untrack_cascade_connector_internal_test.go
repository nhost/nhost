package source

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// errFakeConnRefused is a static sentinel for the connect-failure fallback test
// (err113 forbids inline dynamic errors).
var errFakeConnRefused = errors.New("dial tcp: connection refused")

// fakeDataRows is a minimal pgx.Rows over string columns, enough for the two
// cascade introspection queries (FK graph, function return types), both of
// which scan only into *string destinations.
type fakeDataRows struct {
	rows [][]string
	idx  int
}

func (r *fakeDataRows) Next() bool {
	if r.idx >= len(r.rows) {
		return false
	}

	r.idx++

	return true
}

func (r *fakeDataRows) Scan(dest ...any) error {
	row := r.rows[r.idx-1]
	for i := range dest {
		if i >= len(row) {
			break
		}

		if p, ok := dest[i].(*string); ok {
			*p = row[i]
		}
	}

	return nil
}

func (r *fakeDataRows) Close()                                       {}
func (r *fakeDataRows) Err() error                                   { return nil }
func (r *fakeDataRows) CommandTag() pgconn.CommandTag                { return pgconn.CommandTag{} }
func (r *fakeDataRows) FieldDescriptions() []pgconn.FieldDescription { return nil }
func (r *fakeDataRows) Values() ([]any, error)                       { return nil, nil }
func (r *fakeDataRows) RawValues() [][]byte                          { return nil }
func (r *fakeDataRows) Conn() *pgx.Conn                              { return nil }

// fakeDataConn is a fake source-data-database connection. funcReturnTableSQL is
// the only query that references pg_proc, so that token disambiguates it from
// the FK-graph query.
type fakeDataConn struct {
	fkRows   [][]string
	funcRows [][]string
	closed   bool
}

func (c *fakeDataConn) Query(
	_ context.Context, sql string, _ ...any,
) (pgx.Rows, error) {
	if strings.Contains(sql, "pg_proc") {
		return &fakeDataRows{rows: c.funcRows, idx: 0}, nil
	}

	return &fakeDataRows{rows: c.fkRows, idx: 0}, nil
}

func (c *fakeDataConn) QueryRow(_ context.Context, _ string, _ ...any) pgx.Row {
	return fakeRow{dest: nil, err: pgx.ErrNoRows}
}

func (c *fakeDataConn) Close(_ context.Context) error {
	c.closed = true

	return nil
}

// cascadeStore bootstraps a Store from cascadeFixtureJSON (whose source resolves
// its data URL from PG_URL) and points PG_URL at a dummy DSN so sourceDataURL
// returns non-empty and loadUntrackDeps proceeds to the connector seam.
func cascadeStore(t *testing.T) *Store {
	t.Helper()

	s := NewStore(&fakeWriter{}, nil, nil)
	if err := s.BootstrapFromJSON([]byte(cascadeFixtureJSON), 1); err != nil {
		t.Fatalf("bootstrap cascade fixture: %v", err)
	}

	t.Setenv("PG_URL", "postgres://fake/cstl")

	return s
}

const untrackCascadeArgs = `{"source":"default",` +
	`"table":{"schema":"public","name":"user_departments"},"cascade":true}`

// TestLoadUntrackDeps_DBBackedPopulatesDeps exercises the DB-backed cascade path
// through the connector seam: a fake connection serves the FK-graph and
// function-return rows the cascade would read from a live Postgres, and
// loadUntrackDeps assembles them into untrackDeps. The connection must be closed.
//
//nolint:paralleltest // cascadeStore uses t.Setenv, which forbids t.Parallel.
func TestLoadUntrackDeps_DBBackedPopulatesDeps(t *testing.T) {
	s := cascadeStore(t)

	conn := &fakeDataConn{
		// constraintSchema, constraintName, fromSchema, fromTable, fromColumn,
		// toSchema, toTable, toColumn.
		fkRows: [][]string{
			{"public", "fk_dept_udept", "public", "departments", "department_id", "public", "user_departments", "id"},
		},
		funcRows: [][]string{{"public", "get_department_manager"}},
		closed:   false,
	}
	s.dataConnector = func(context.Context, string) (dataDBConn, error) {
		return conn, nil
	}

	deps, err := s.loadUntrackDeps(t.Context(), []byte(untrackCascadeArgs))
	if err != nil {
		t.Fatalf("loadUntrackDeps: %v", err)
	}

	if deps == nil {
		t.Fatal("loadUntrackDeps returned nil deps for a reachable data database")
	}

	gotFK := deps.fkByOwnerCols[fkOwnerKey(
		hasura.TableSource{Schema: "public", Name: "departments"}, []string{"department_id"},
	)]
	if gotFK.Schema != "public" || gotFK.Name != "user_departments" {
		t.Errorf("fkByOwnerCols target = %+v, want public.user_departments", gotFK)
	}

	if _, ok := deps.funcsReturningTarget[funcKey("public", "get_department_manager")]; !ok {
		t.Errorf("funcsReturningTarget missing get_department_manager: %+v", deps.funcsReturningTarget)
	}

	if !conn.closed {
		t.Error("loadUntrackDeps did not close the per-call data connection")
	}
}

// TestLoadUntrackDeps_ConnectFailureFallsBack pins the unreachable-database
// fallback: when the connector returns an error, loadUntrackDeps degrades to a
// metadata-only cascade (nil, nil) rather than failing the op.
//
//nolint:paralleltest // cascadeStore uses t.Setenv, which forbids t.Parallel.
func TestLoadUntrackDeps_ConnectFailureFallsBack(t *testing.T) {
	s := cascadeStore(t)
	s.dataConnector = func(context.Context, string) (dataDBConn, error) {
		return nil, errFakeConnRefused
	}

	deps, err := s.loadUntrackDeps(t.Context(), []byte(untrackCascadeArgs))
	if err != nil {
		t.Fatalf("loadUntrackDeps: want nil error (fallback), got %v", err)
	}

	if deps != nil {
		t.Errorf("loadUntrackDeps: want nil deps on connect failure, got %+v", deps)
	}
}

// TestLoadUntrackDeps_NoDataURLSkipsConnect pins the metadata-only path: with no
// resolvable source data URL, loadUntrackDeps returns (nil, nil) WITHOUT ever
// invoking the connector.
func TestLoadUntrackDeps_NoDataURLSkipsConnect(t *testing.T) {
	t.Parallel()

	s := NewStore(&fakeWriter{}, nil, nil)
	if err := s.BootstrapFromJSON([]byte(cascadeFixtureJSON), 1); err != nil {
		t.Fatalf("bootstrap cascade fixture: %v", err)
	}
	// PG_URL deliberately unset: sourceDataURL resolves to "".

	connectCalled := false
	s.dataConnector = func(context.Context, string) (dataDBConn, error) {
		connectCalled = true

		return nil, nil //nolint:nilnil // unreachable in this test; asserted below.
	}

	deps, err := s.loadUntrackDeps(t.Context(), []byte(untrackCascadeArgs))
	if err != nil || deps != nil {
		t.Fatalf("loadUntrackDeps = (%+v, %v), want (nil, nil)", deps, err)
	}

	if connectCalled {
		t.Error("loadUntrackDeps opened a data connection despite no resolvable data URL")
	}
}
