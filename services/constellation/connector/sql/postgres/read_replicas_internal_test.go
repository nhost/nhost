package postgres

import (
	"context"
	"log/slog"
	"os"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata"
)

type closeCountingPool struct {
	stubQuerier

	closed int
}

func (p *closeCountingPool) BeginTx(context.Context) (Tx, error) { //nolint:ireturn,nolintlint
	return nil, errStubQueryNotConfigured
}

func (p *closeCountingPool) Close() {
	p.closed++
}

func TestClientClose_ClosesReplicas(t *testing.T) {
	t.Parallel()

	primary := &closeCountingPool{}
	replica1 := &closeCountingPool{}
	replica2 := &closeCountingPool{}

	client := NewClient(primary)
	client.replicas = []Pool{replica1, replica2}

	client.Close()

	for name, pool := range map[string]*closeCountingPool{
		"primary":  primary,
		"replica1": replica1,
		"replica2": replica2,
	} {
		if pool.closed != 1 {
			t.Errorf("%s closed %d times, want 1", name, pool.closed)
		}
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
