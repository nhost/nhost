//go:build integration

package hasura_test

import (
	"database/sql"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/nhost/nhost/services/ai/internal/livetest"
)

// Status writes must not fire the configuration event trigger (they would
// redeploy on every worker run); a deployment column change must fire it once.
//
//nolint:paralleltest // Advisory lock serializes live Hasura tests across packages.
func TestStatusWritesDoNotTriggerDeployLive(t *testing.T) {
	database, client := livetest.Connect(t)
	livetest.Lock(t, database)

	id := uuid.NewString()
	name := "live_" + strings.ReplaceAll(id, "-", "")
	livetest.SuppressedExec(
		t,
		database,
		`INSERT INTO ai.auto_embeddings_configuration (id,name,schema_name,table_name,column_name,provider,dimensions)
		 VALUES ($1,$2,'public','missing_target','embedding','openai',1536)`,
		id,
		name,
	)
	t.Cleanup(func() {
		livetest.SuppressedExec(
			t,
			database,
			`DELETE FROM ai.auto_embeddings_configuration WHERE id=$1`,
			id,
		)
	})

	var since time.Time
	if err := database.QueryRowContext(t.Context(), "SELECT clock_timestamp()").
		Scan(&since); err != nil {
		t.Fatalf("reading timestamp: %v", err)
	}

	message := "run failed"
	if _, err := client.SetAiAutoEmbeddingsConfigurationRunStatus(
		t.Context(),
		id,
		time.Now(),
		&message,
	); err != nil {
		t.Fatalf("setting run status: %v", err)
	}

	if _, err := client.SetAiAutoEmbeddingsConfigurationLastError(
		t.Context(),
		id,
		nil,
	); err != nil {
		t.Fatalf("clearing last error: %v", err)
	}

	time.Sleep(time.Second)

	if count := eventCount(t, database, id, since); count != 0 {
		t.Fatalf("status writes created %d deployment events", count)
	}

	if _, err := database.ExecContext(
		t.Context(),
		`UPDATE ai.auto_embeddings_configuration SET model='text-embedding-3-small' WHERE id=$1`,
		id,
	); err != nil {
		t.Fatalf("updating model: %v", err)
	}

	deadline := time.Now().Add(15 * time.Second)
	for eventCount(t, database, id, since) != 1 {
		if time.Now().After(deadline) {
			t.Fatal("model update did not produce exactly one deployment event")
		}

		time.Sleep(100 * time.Millisecond)
	}
}

func eventCount(t *testing.T, database *sql.DB, id string, since time.Time) int {
	t.Helper()

	var count int
	if err := database.QueryRowContext(
		t.Context(),
		`SELECT count(*) FROM hdb_catalog.event_log
		 WHERE trigger_name='ai_auto_embeddings_conf_events'
		 AND payload->'data'->'new'->>'id'=$1 AND created_at >= $2`,
		id,
		since,
	).Scan(&count); err != nil {
		t.Fatalf("counting deployment events: %v", err)
	}

	return count
}
