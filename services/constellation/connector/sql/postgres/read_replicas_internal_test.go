package postgres

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"os"
	"strings"
	"testing"
	"time"

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

type hangingRow struct {
	ctx context.Context //nolint:containedctx
}

func (r hangingRow) Scan(...any) error {
	<-r.ctx.Done()

	return fmt.Errorf("scanning hanging row: %w", r.ctx.Err())
}

type fakeTx struct {
	stubQuerier

	queryErr error
	hang     bool
}

func (t *fakeTx) QueryRow(ctx context.Context, _ string, _ ...any) Row { //nolint:ireturn,nolintlint
	if t.hang {
		return hangingRow{ctx: ctx}
	}

	return fakeRow{err: t.queryErr}
}

func (t *fakeTx) Commit(context.Context) error   { return nil }
func (t *fakeTx) Rollback(context.Context) error { return nil }

type fakePool struct {
	stubQuerier

	beginErr error
	queryErr error
	hang     bool
	begins   int
	closed   int
}

func (p *fakePool) BeginTx(context.Context) (Tx, error) { //nolint:ireturn,nolintlint
	p.begins++

	if p.beginErr != nil {
		return nil, p.beginErr
	}

	return &fakeTx{stubQuerier: stubQuerier{}, queryErr: p.queryErr, hang: p.hang}, nil
}

func (p *fakePool) Close() {
	p.closed++
}

type fakePositionRow struct {
	position *int64
}

func (r fakePositionRow) Scan(dest ...any) error {
	target, _ := dest[0].(**int64)
	*target = r.position

	return nil
}

type fakeRows struct{}

func (fakeRows) Close()            {}
func (fakeRows) Next() bool        { return false }
func (fakeRows) Scan(...any) error { return nil }
func (fakeRows) Err() error        { return nil }

type fakePollPool struct {
	fakePool

	positions []*int64
	pollErr   error
	polls     int
}

func (p *fakePollPool) QueryRow(context.Context, string, ...any) Row { //nolint:ireturn,nolintlint
	position := p.positions[0]
	p.positions = p.positions[1:]

	return fakePositionRow{position: position}
}

func (p *fakePollPool) Query(
	ctx context.Context,
	_ string,
	_ ...any,
) (Rows, error) { //nolint:ireturn,nolintlint
	p.polls++

	if p.hang {
		<-ctx.Done()
		return nil, fmt.Errorf("hanging poll: %w", ctx.Err())
	}

	if p.pollErr != nil {
		return nil, p.pollErr
	}

	return fakeRows{}, nil
}

func TestReplicaAttempts_HungReplicaFallsBackInTime(t *testing.T) {
	t.Parallel()

	logger := slog.New(slog.DiscardHandler)
	oneQuery := []core.SQLOperation{{Name: "users", SQL: "SELECT 1"}}

	tests := []struct {
		name string
		run  func(ctx context.Context, primary, replica *fakePollPool) error
	}{
		{
			name: "query",
			run: func(ctx context.Context, primary, replica *fakePollPool) error {
				client := NewClient(primary)
				client.replicas = []Pool{replica}

				_, err := client.ExecuteReadOperations(ctx, oneQuery, logger)

				return err
			},
		},
		{
			name: "subscription poll",
			run: func(ctx context.Context, primary, replica *fakePollPool) error {
				client := NewClient(primary)
				client.replicas = []Pool{replica}

				_, err := client.ExecuteMultiplexedOperation(ctx, "SELECT 1", nil, logger)

				return err
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			primary := &fakePollPool{positions: []*int64{new(int64(10))}}
			replica := &fakePollPool{positions: []*int64{new(int64(10))}}
			replica.hang = true

			ctx, cancel := context.WithTimeout(t.Context(), 2*time.Second)
			defer cancel()

			start := time.Now()

			if err := tt.run(ctx, primary, replica); err != nil {
				t.Fatalf("expected the primary to answer, got %v", err)
			}

			if elapsed := time.Since(start); elapsed >= 2*time.Second {
				t.Errorf(
					"took %s, want the replica attempt bounded within the caller deadline",
					elapsed,
				)
			}

			if primary.begins+primary.polls != 1 {
				t.Errorf("primary used %d times, want 1", primary.begins+primary.polls)
			}
		})
	}
}

func TestOpenReplicas_DoesNotLeakPasswords(t *testing.T) {
	t.Parallel()

	inc := metadata.NewInconsistencies()

	replicas := openReplicas(
		t.Context(),
		[]string{"postgres://app@127.0.0.1:1/app?password=s3cret-value&pool_max_conns=bad"},
		"default",
		inc,
		slog.New(slog.DiscardHandler),
	)
	if len(replicas) != 0 {
		t.Fatalf("got %d replica pools, want 0", len(replicas))
	}

	snap := inc.Snapshot()
	if len(snap) != 1 {
		t.Fatalf("got %d inconsistencies, want 1", len(snap))
	}

	if strings.Contains(snap[0].Reason, "s3cret-value") {
		t.Errorf("reason leaks the password: %q", snap[0].Reason)
	}

	if snap[0].Reason != "invalid read replica connection string" {
		t.Errorf("reason = %q, want the generic parse message", snap[0].Reason)
	}
}

func TestOpenReplica_UnresponsiveServerTimesOut(t *testing.T) {
	t.Parallel()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}

	var held []net.Conn

	t.Cleanup(func() {
		listener.Close()

		for _, conn := range held {
			conn.Close()
		}
	})

	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}

			held = append(held, conn)
		}
	}()

	start := time.Now()

	_, err = openReplica(
		t.Context(),
		"postgres://app:pw@"+listener.Addr().String()+"/app?sslmode=disable",
	)
	if err == nil {
		t.Fatal("openReplica succeeded against a server that never answers")
	}

	if elapsed := time.Since(start); elapsed > replicaConnectTimeout+3*time.Second {
		t.Errorf("openReplica took %s, want about %s", elapsed, replicaConnectTimeout)
	}
}

func TestExecuteMultiplexedOperation_ReplicaFloor(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		floor        int64
		primary      *fakePollPool
		replica      *fakePollPool
		wantPrimary  int
		wantReplica  int
		wantFloor    int64
		withReplicas bool
	}{
		{
			name:         "no replicas polls the primary without reading positions",
			floor:        0,
			primary:      &fakePollPool{positions: nil},
			replica:      &fakePollPool{positions: nil},
			wantPrimary:  1,
			wantReplica:  0,
			wantFloor:    0,
			withReplicas: false,
		},
		{
			name:         "replica that has caught up is polled and raises the floor",
			floor:        100,
			primary:      &fakePollPool{positions: nil},
			replica:      &fakePollPool{positions: []*int64{new(int64(100)), new(int64(130))}},
			wantPrimary:  0,
			wantReplica:  1,
			wantFloor:    130,
			withReplicas: true,
		},
		{
			name:         "replica behind the floor sends the poll to the primary",
			floor:        100,
			primary:      &fakePollPool{positions: []*int64{new(int64(150))}},
			replica:      &fakePollPool{positions: []*int64{new(int64(90))}},
			wantPrimary:  1,
			wantReplica:  0,
			wantFloor:    150,
			withReplicas: true,
		},
		{
			name:         "server without a replay position sends the poll to the primary",
			floor:        0,
			primary:      &fakePollPool{positions: []*int64{new(int64(40))}},
			replica:      &fakePollPool{positions: []*int64{nil}},
			wantPrimary:  1,
			wantReplica:  0,
			wantFloor:    40,
			withReplicas: true,
		},
		{
			name:         "replica poll error retries on the primary",
			floor:        0,
			primary:      &fakePollPool{positions: []*int64{new(int64(60))}},
			replica:      &fakePollPool{positions: []*int64{new(int64(50))}, pollErr: errFakeQuery},
			wantPrimary:  1,
			wantReplica:  1,
			wantFloor:    60,
			withReplicas: true,
		},
		{
			name:         "floor never goes down",
			floor:        200,
			primary:      &fakePollPool{positions: nil},
			replica:      &fakePollPool{positions: []*int64{new(int64(250)), new(int64(180))}},
			wantPrimary:  0,
			wantReplica:  1,
			wantFloor:    200,
			withReplicas: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			client := NewClient(tt.primary)
			if tt.withReplicas {
				client.replicas = []Pool{tt.replica}
			}

			client.readFloor.Store(tt.floor)

			if _, err := client.ExecuteMultiplexedOperation(
				t.Context(), "SELECT 1", nil, slog.New(slog.DiscardHandler),
			); err != nil {
				t.Fatalf("ExecuteMultiplexedOperation: %v", err)
			}

			if tt.primary.polls != tt.wantPrimary || tt.replica.polls != tt.wantReplica {
				t.Errorf(
					"primary polled %d times, replica %d times; want %d and %d",
					tt.primary.polls, tt.replica.polls, tt.wantPrimary, tt.wantReplica,
				)
			}

			if got := client.readFloor.Load(); got != tt.wantFloor {
				t.Errorf("floor = %d, want %d", got, tt.wantFloor)
			}
		})
	}
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

const replicaFloorPoll = "SELECT 'order-1', json_build_object('status', status)::text " +
	"FROM replica_floor_orders WHERE id = 1"

// labClient opens a client against the lab primary and replica, or skips the
// test when they are not configured.
func labClient(t *testing.T) (*Client, Pool, Pool) {
	t.Helper()

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

	t.Cleanup(client.Close)

	return client, primary, replica
}

func mustExec(t *testing.T, q Querier, sql string) {
	t.Helper()

	if err := q.Exec(context.WithoutCancel(t.Context()), sql); err != nil {
		t.Fatalf("%s: %v", sql, err)
	}
}

func waitUntil(t *testing.T, what string, done func() bool) {
	t.Helper()

	deadline := time.Now().Add(20 * time.Second)

	for !done() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for %s", what)
		}

		time.Sleep(100 * time.Millisecond)
	}
}

func orderStatus(t *testing.T, results []core.MultiplexedResult) string {
	t.Helper()

	if len(results) != 1 {
		t.Fatalf("got %d results, want 1", len(results))
	}

	return string(results[0].Data)
}

// delayReplica makes the replica apply changes 5 seconds late and waits until
// the setting is active.
func delayReplica(t *testing.T, replica Pool) {
	t.Helper()

	mustExec(t, replica, "ALTER SYSTEM SET recovery_min_apply_delay = '5s'")
	mustExec(t, replica, "SELECT pg_reload_conf()")

	waitUntil(t, "recovery_min_apply_delay", func() bool {
		var delay string

		err := replica.QueryRow(t.Context(), "SHOW recovery_min_apply_delay").Scan(&delay)

		return err == nil && delay == "5s"
	})

	time.Sleep(time.Second)
}

func TestExecuteMultiplexedOperation_LaggingReplicaNeverGoesBack(t *testing.T) {
	t.Parallel()

	client, primary, replica := labClient(t)
	ctx := t.Context()
	logger := slog.New(slog.DiscardHandler)

	mustExec(t, primary, "DROP TABLE IF EXISTS replica_floor_orders")
	mustExec(
		t, primary,
		"CREATE TABLE replica_floor_orders (id int PRIMARY KEY, status text NOT NULL)",
	)
	mustExec(t, primary, "INSERT INTO replica_floor_orders VALUES (1, 'Order accepted')")

	t.Cleanup(func() {
		mustExec(t, replica, "ALTER SYSTEM RESET recovery_min_apply_delay")
		mustExec(t, replica, "SELECT pg_reload_conf()")
		mustExec(t, primary, "DROP TABLE IF EXISTS replica_floor_orders")
	})

	waitUntil(t, "the order on the replica", func() bool {
		results, err := queryMultiplexed(ctx, replica, replicaFloorPoll, nil, logger)
		return err == nil && len(results) == 1
	})

	delayReplica(t, replica)
	mustExec(t, primary, "UPDATE replica_floor_orders SET status = 'Delivered' WHERE id = 1")

	shown, err := client.multiplexedOnPrimary(ctx, replicaFloorPoll, nil, logger)
	if err != nil {
		t.Fatalf("poll on primary: %v", err)
	}

	if got := orderStatus(t, shown); got != `{"status" : "Delivered"}` {
		t.Fatalf("primary poll = %s, want Delivered", got)
	}

	stale, err := queryMultiplexed(ctx, replica, replicaFloorPoll, nil, logger)
	if err != nil {
		t.Fatalf("direct replica query: %v", err)
	}

	if got := orderStatus(t, stale); got != `{"status" : "Order accepted"}` {
		t.Fatalf("replica is not lagging (%s); the test cannot exercise the floor", got)
	}

	next, err := client.ExecuteMultiplexedOperation(ctx, replicaFloorPoll, nil, logger)
	if err != nil {
		t.Fatalf("ExecuteMultiplexedOperation: %v", err)
	}

	if got := orderStatus(t, next); got != `{"status" : "Delivered"}` {
		t.Errorf("subscription went back to older data: %s", got)
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
