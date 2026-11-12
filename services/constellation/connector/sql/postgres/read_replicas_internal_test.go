package postgres

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/metadata"
)

var (
	errFakeBegin = errors.New("connection refused")
	errFakeQuery = errors.New("division by zero")
)

var _ interface {
	ExecuteReadOperations(
		ctx context.Context, operations []core.SQLOperation, logger *slog.Logger,
	) (map[string]any, error)
} = (*Client)(nil)

type fakeRow struct {
	err error
}

func (r fakeRow) Scan(...any) error {
	return r.err
}

type fakeTx struct {
	stubQuerier

	queryErr error
}

func (t *fakeTx) QueryRow(context.Context, string, ...any) Row { //nolint:ireturn,nolintlint
	return fakeRow{err: t.queryErr}
}

func (t *fakeTx) Commit(context.Context) error   { return nil }
func (t *fakeTx) Rollback(context.Context) error { return nil }

type fakePool struct {
	stubQuerier

	beginErr error
	queryErr error
	begins   int
	closed   int
}

func (p *fakePool) BeginTx(context.Context) (Tx, error) { //nolint:ireturn,nolintlint
	p.begins++

	if p.beginErr != nil {
		return nil, p.beginErr
	}

	return &fakeTx{stubQuerier: stubQuerier{}, queryErr: p.queryErr}, nil
}

func (p *fakePool) Close() {
	p.closed++
}

func TestClientClose_ClosesReplicas(t *testing.T) {
	t.Parallel()

	primary := &fakePool{}
	replica1 := &fakePool{}
	replica2 := &fakePool{}

	client := NewClient(primary)
	client.replicas = []Pool{replica1, replica2}

	client.Close()

	for name, pool := range map[string]*fakePool{
		"primary":  primary,
		"replica1": replica1,
		"replica2": replica2,
	} {
		if pool.closed != 1 {
			t.Errorf("%s closed %d times, want 1", name, pool.closed)
		}
	}
}

func TestExecuteReadOperations(t *testing.T) {
	t.Parallel()

	oneQuery := []core.SQLOperation{{Name: "users", SQL: "SELECT 1"}}

	tests := []struct {
		name         string
		replicas     []*fakePool
		calls        int
		operations   []core.SQLOperation
		wantPrimary  int
		wantReplicas []int
		wantErr      error
	}{
		{
			name:         "no replicas uses the primary",
			replicas:     nil,
			calls:        2,
			operations:   oneQuery,
			wantPrimary:  2,
			wantReplicas: nil,
			wantErr:      nil,
		},
		{
			name:         "replicas take turns",
			replicas:     []*fakePool{{}, {}},
			calls:        4,
			operations:   oneQuery,
			wantPrimary:  0,
			wantReplicas: []int{2, 2},
			wantErr:      nil,
		},
		{
			name:         "replica that cannot begin falls back to the primary",
			replicas:     []*fakePool{{beginErr: errFakeBegin}},
			calls:        1,
			operations:   oneQuery,
			wantPrimary:  1,
			wantReplicas: []int{1},
			wantErr:      nil,
		},
		{
			name:         "query error on a replica is not retried on the primary",
			replicas:     []*fakePool{{queryErr: errFakeQuery}},
			calls:        1,
			operations:   oneQuery,
			wantPrimary:  0,
			wantReplicas: []int{1},
			wantErr:      errFakeQuery,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			primary := &fakePool{}
			client := NewClient(primary)

			for _, replica := range tt.replicas {
				client.replicas = append(client.replicas, replica)
			}

			logger := slog.New(slog.DiscardHandler)

			for range tt.calls {
				_, err := client.ExecuteReadOperations(t.Context(), tt.operations, logger)
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("error = %v, want %v", err, tt.wantErr)
				}
			}

			if primary.begins != tt.wantPrimary {
				t.Errorf("primary used %d times, want %d", primary.begins, tt.wantPrimary)
			}

			for i, replica := range tt.replicas {
				if replica.begins != tt.wantReplicas[i] {
					t.Errorf(
						"replica %d used %d times, want %d",
						i,
						replica.begins,
						tt.wantReplicas[i],
					)
				}
			}
		})
	}
}

func TestExecuteOperations_UsesPrimary(t *testing.T) {
	t.Parallel()

	primary := &fakePool{}
	replica := &fakePool{}

	client := NewClient(primary)
	client.replicas = []Pool{replica}

	_, err := client.ExecuteOperations(
		t.Context(),
		[]core.SQLOperation{{Name: "insert_users", SQL: "SELECT 1"}},
		slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatalf("ExecuteOperations: %v", err)
	}

	if primary.begins != 1 || replica.begins != 0 {
		t.Errorf(
			"primary used %d times, replica %d times; want 1 and 0",
			primary.begins,
			replica.begins,
		)
	}
}

func TestOpenReplicas_SkipsAndRecords(t *testing.T) {
	t.Parallel()

	inc := metadata.NewInconsistencies()

	replicas := openReplicas(
		t.Context(),
		[]string{"", "postgres://postgres:postgres@127.0.0.1:1/app?connect_timeout=1"},
		"default",
		inc,
		slog.New(slog.DiscardHandler),
	)
	if len(replicas) != 0 {
		t.Fatalf("got %d replica pools, want 0", len(replicas))
	}

	snap := inc.Snapshot()
	if len(snap) != 1 {
		t.Fatalf("got %d inconsistencies, want 1: %+v", len(snap), snap)
	}

	got := snap[0]
	if got.Kind != metadata.InconsistencyKindReadReplica ||
		got.Source != "default" ||
		got.Name != "read_replicas[1]" {
		t.Errorf("unexpected inconsistency: %+v", got)
	}

	if !strings.HasPrefix(got.Reason, "connecting to read replica: ") {
		t.Errorf("reason = %q, want a connection failure", got.Reason)
	}

	if strings.Contains(got.Reason, "postgres:postgres") {
		t.Errorf("reason leaks credentials: %q", got.Reason)
	}
}

func TestOpenReplica_Standby(t *testing.T) {
	t.Parallel()

	connStr := os.Getenv("CONSTELLATION_TEST_READ_REPLICA_URL")
	if connStr == "" {
		t.Skip("CONSTELLATION_TEST_READ_REPLICA_URL is not set")
	}

	pool, err := openReplica(t.Context(), connStr)
	if err != nil {
		t.Fatalf("openReplica: %v", err)
	}
	defer pool.Close()

	var inRecovery bool
	if err := pool.QueryRow(t.Context(), "SELECT pg_is_in_recovery()").
		Scan(&inRecovery); err != nil {
		t.Fatalf("checking recovery state: %v", err)
	}

	if !inRecovery {
		t.Error("replica pool is connected to a server that is not a standby")
	}
}

func TestExecuteReadOperations_LabReplica(t *testing.T) {
	t.Parallel()

	primaryURL := os.Getenv("CONSTELLATION_TEST_READ_REPLICA_PRIMARY_URL")
	replicaURL := os.Getenv("CONSTELLATION_TEST_READ_REPLICA_URL")

	if primaryURL == "" || replicaURL == "" {
		t.Skip("CONSTELLATION_TEST_READ_REPLICA_PRIMARY_URL / _URL are not set")
	}

	primary, err := Open(t.Context(), primaryURL)
	if err != nil {
		t.Fatalf("Open primary: %v", err)
	}

	replica, err := openReplica(t.Context(), replicaURL)
	if err != nil {
		primary.Close()
		t.Fatalf("openReplica: %v", err)
	}

	client := NewClient(primary)
	client.replicas = []Pool{replica}

	defer client.Close()

	standby := []core.SQLOperation{{
		Name: "standby",
		SQL:  "SELECT json_build_object('standby', pg_is_in_recovery())::text",
	}}
	logger := slog.New(slog.DiscardHandler)

	read, err := client.ExecuteReadOperations(t.Context(), standby, logger)
	if err != nil {
		t.Fatalf("ExecuteReadOperations: %v", err)
	}

	write, err := client.ExecuteOperations(t.Context(), standby, logger)
	if err != nil {
		t.Fatalf("ExecuteOperations: %v", err)
	}

	if got := string(asJSON(t, read["standby"])); got != `{"standby" : true}` {
		t.Errorf("read path ran on %s, want the replica", got)
	}

	if got := string(asJSON(t, write["standby"])); got != `{"standby" : false}` {
		t.Errorf("write path ran on %s, want the primary", got)
	}
}

func asJSON(t *testing.T, v any) []byte {
	t.Helper()

	switch b := v.(type) {
	case []byte:
		return b
	case interface{ String() string }:
		return []byte(b.String())
	default:
		t.Fatalf("unexpected result type %T", v)
		return nil
	}
}
