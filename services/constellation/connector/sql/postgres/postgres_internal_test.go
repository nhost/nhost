package postgres

import (
	"context"
	"errors"
	"testing"
	"time"
)

// stubQuerier implements the Querier interface for white-box tests that need
// to drive execSQLInit without importing the mock subpackage (which would
// create an import cycle with this package).
type stubQuerier struct {
	execFn     func(ctx context.Context, sql string, args ...any) error
	queryRow   func(ctx context.Context, sql string, args ...any) Row
	queryRows  func(ctx context.Context, sql string, args ...any) (Rows, error)
	execCalls  int
	execErrors []error
}

func (s *stubQuerier) Exec(ctx context.Context, sql string, args ...any) error {
	s.execCalls++

	if s.execFn != nil {
		return s.execFn(ctx, sql, args...)
	}

	if len(s.execErrors) == 0 {
		return nil
	}

	idx := s.execCalls - 1
	if idx >= len(s.execErrors) {
		idx = len(s.execErrors) - 1
	}

	return s.execErrors[idx]
}

func (s *stubQuerier) Query(
	ctx context.Context, sql string, args ...any,
) (Rows, error) {
	if s.queryRows != nil {
		return s.queryRows(ctx, sql, args...)
	}

	return nil, errors.New("stubQuerier.Query not configured")
}

func (s *stubQuerier) QueryRow(
	ctx context.Context, sql string, args ...any,
) Row {
	if s.queryRow != nil {
		return s.queryRow(ctx, sql, args...)
	}

	return nil
}

// withFastRetries temporarily shrinks the sqlInit retry delay so tests don't
// wait the production-default ~31s for an all-retries-fail run.
func withFastRetries(t *testing.T, maxRetries int, baseDelay time.Duration) {
	t.Helper()

	origMax := sqlInitMaxRetries
	origDelay := sqlInitBaseRetryDelay
	sqlInitMaxRetries = maxRetries
	sqlInitBaseRetryDelay = baseDelay

	t.Cleanup(func() {
		sqlInitMaxRetries = origMax
		sqlInitBaseRetryDelay = origDelay
	})
}

func TestExecSQLInit_Success(t *testing.T) { //nolint:paralleltest
	withFastRetries(t, 3, time.Millisecond)

	q := &stubQuerier{}

	if err := execSQLInit(t.Context(), q); err != nil {
		t.Fatalf("execSQLInit() unexpected error: %v", err)
	}

	if q.execCalls != 1 {
		t.Errorf("expected 1 Exec call on success, got %d", q.execCalls)
	}
}

func TestExecSQLInit_RetriesThenSucceeds(t *testing.T) { //nolint:paralleltest
	withFastRetries(t, 5, time.Millisecond)

	q := &stubQuerier{
		execErrors: []error{
			errors.New("transient 1"),
			errors.New("transient 2"),
			nil, // third call succeeds
		},
	}

	if err := execSQLInit(t.Context(), q); err != nil {
		t.Fatalf("execSQLInit() unexpected error: %v", err)
	}

	if q.execCalls != 3 {
		t.Errorf("expected 3 Exec calls (2 retries then success), got %d", q.execCalls)
	}
}

func TestExecSQLInit_AllRetriesFail(t *testing.T) { //nolint:paralleltest
	withFastRetries(t, 3, time.Millisecond)

	terminal := errors.New("permanent failure")
	q := &stubQuerier{
		execErrors: []error{terminal},
	}

	err := execSQLInit(t.Context(), q)
	if err == nil {
		t.Fatal("expected error after all retries fail, got nil")
	}

	if !errors.Is(err, terminal) {
		t.Errorf("expected terminal error in chain, got: %v", err)
	}

	if q.execCalls != sqlInitMaxRetries {
		t.Errorf("expected %d Exec calls, got %d", sqlInitMaxRetries, q.execCalls)
	}
}

func TestExecSQLInit_ContextCancelled(t *testing.T) { //nolint:paralleltest
	// Long enough delay that the cancel races the time.After in the retry
	// loop; the cancel arm must win.
	withFastRetries(t, 5, 100*time.Millisecond)

	ctx, cancel := context.WithCancel(t.Context())

	q := &stubQuerier{
		execFn: func(_ context.Context, _ string, _ ...any) error {
			// Cancel after the first failed Exec so the next select hits the
			// ctx.Done arm of the retry-delay switch.
			cancel()
			return errors.New("first call fails")
		},
	}

	err := execSQLInit(ctx, q)
	if err == nil {
		t.Fatal("expected error from cancelled context, got nil")
	}

	if !errors.Is(err, context.Canceled) {
		t.Errorf("expected context.Canceled in chain, got: %v", err)
	}

	// Only one Exec call should have happened before the cancel hit.
	if q.execCalls != 1 {
		t.Errorf("expected 1 Exec call before cancel, got %d", q.execCalls)
	}
}

func TestBuildFunctionArguments(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		argNames    []string
		argTypes    []string
		numDefaults int
		wantLen     int
		wantFirst   string
		wantLast    string
		wantLastTyp string
		lastDefault bool
	}{
		{
			name:        "no arguments",
			argTypes:    nil,
			wantLen:     0,
			wantFirst:   "",
			wantLast:    "",
			wantLastTyp: "",
			lastDefault: false,
		},
		{
			name:        "named arguments no defaults",
			argNames:    []string{"user_id", "name"},
			argTypes:    []string{"integer", "text"},
			numDefaults: 0,
			wantLen:     2,
			wantFirst:   "user_id",
			wantLast:    "name",
			wantLastTyp: "text",
			lastDefault: false,
		},
		{
			name:        "named arguments with defaults",
			argNames:    []string{"user_id", "limit"},
			argTypes:    []string{"integer", "integer"},
			numDefaults: 1,
			wantLen:     2,
			wantFirst:   "user_id",
			wantLast:    "limit",
			wantLastTyp: "integer",
			lastDefault: true,
		},
		{
			name:        "unnamed arguments get generated names",
			argNames:    []string{"", ""},
			argTypes:    []string{"integer", "text"},
			numDefaults: 0,
			wantLen:     2,
			wantFirst:   "arg_1",
			wantLast:    "arg_2",
			wantLastTyp: "text",
			lastDefault: false,
		},
		{
			name:        "fewer names than types",
			argNames:    []string{"id"},
			argTypes:    []string{"integer", "text"},
			numDefaults: 0,
			wantLen:     2,
			wantFirst:   "id",
			wantLast:    "arg_2",
			wantLastTyp: "text",
			lastDefault: false,
		},
		{
			name:        "schema-prefixed type gets cleaned",
			argNames:    []string{"val"},
			argTypes:    []string{"pg_catalog.int4"},
			numDefaults: 0,
			wantLen:     1,
			wantFirst:   "val",
			wantLast:    "val",
			wantLastTyp: "int4",
			lastDefault: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			args := buildFunctionArguments(tt.argNames, tt.argTypes, tt.numDefaults)
			if len(args) != tt.wantLen {
				t.Fatalf("got %d args, want %d", len(args), tt.wantLen)
			}

			if tt.wantLen == 0 {
				return
			}

			if args[0].Name != tt.wantFirst {
				t.Errorf("first arg name = %q, want %q", args[0].Name, tt.wantFirst)
			}

			last := args[len(args)-1]
			if last.Name != tt.wantLast {
				t.Errorf("last arg name = %q, want %q", last.Name, tt.wantLast)
			}

			if last.Type != tt.wantLastTyp {
				t.Errorf("last arg Type = %q, want %q", last.Type, tt.wantLastTyp)
			}

			if last.HasDefault != tt.lastDefault {
				t.Errorf("last arg HasDefault = %v, want %v", last.HasDefault, tt.lastDefault)
			}
		})
	}
}
