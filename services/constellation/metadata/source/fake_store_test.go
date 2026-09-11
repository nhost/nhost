package source //nolint:testpackage // fake of unexported interface needs same-package access

import (
	"context"
	"strings"
	"sync/atomic"

	"github.com/jackc/pgx/v5"
)

// fakeStore is a minimal metadataStore for tests.
//
// Each successive QueryRow call returns the next fakeRow in responses. SQL is
// inspected just enough to distinguish the two queries the source issues
// (`resource_version` vs `metadata, resource_version`).
type fakeStore struct {
	versionRows  []fakeRow
	metadataRows []fakeRow

	versionIdx  atomic.Int32
	metadataIdx atomic.Int32

	closed atomic.Bool
}

type fakeRow struct {
	dest []any
	err  error
}

func (r fakeRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}

	for i := range dest {
		if i >= len(r.dest) {
			break
		}

		switch out := dest[i].(type) {
		case *int64:
			v, _ := r.dest[i].(int64)
			*out = v
		case *[]byte:
			v, _ := r.dest[i].([]byte)
			*out = v
		}
	}

	return nil
}

func (s *fakeStore) QueryRow(_ context.Context, sql string, _ ...any) pgx.Row {
	if strings.Contains(sql, "SELECT metadata") {
		i := int(s.metadataIdx.Add(1)) - 1
		if i >= len(s.metadataRows) {
			return fakeRow{dest: nil, err: pgx.ErrNoRows}
		}

		return s.metadataRows[i]
	}

	i := int(s.versionIdx.Add(1)) - 1
	if i >= len(s.versionRows) {
		return fakeRow{dest: nil, err: pgx.ErrNoRows}
	}

	return s.versionRows[i]
}

func (s *fakeStore) Close() {
	s.closed.Store(true)
}

// Query is a stub to satisfy the metadataStore interface. Existing tests
// (database_internal_test.go) exercise only QueryRow; if a future test
// needs multi-row results, give it a fakeRows implementation analogous
// to fakeRow.
func (s *fakeStore) Query(
	_ context.Context, _ string, _ ...any,
) (pgx.Rows, error) {
	return nil, pgx.ErrNoRows
}
