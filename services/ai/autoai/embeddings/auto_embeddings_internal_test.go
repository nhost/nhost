package embeddings

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/nhost/nhost/services/ai/autoai"
	"github.com/nhost/nhost/services/ai/autoai/embedder"
	"github.com/nhost/nhost/services/ai/hasura"
	"github.com/nhost/nhost/services/ai/internal/livetest"
)

type observingLiveClient struct {
	*hasura.Client

	mutation string
	writes   int
	t        *testing.T
}

func (c *observingLiveClient) RawQuery(
	ctx context.Context,
	query string,
	vars map[string]any,
	result any,
) error {
	if err := c.Client.RawQuery(ctx, query, vars, result); err != nil {
		return fmt.Errorf("running live worker query: %w", err)
	}

	if query == c.mutation {
		c.writes++
		if vars["embeddings"] != "[1,0]" {
			c.t.Error("in-process mutation vector differs")
		}
	}

	return nil
}

//nolint:paralleltest // Live metadata changes are serialized across packages.
func TestWorkerRunLive(t *testing.T) {
	database, hc := livetest.Connect(t)
	livetest.Lock(t, database)

	name := "worker_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	schema := pq.QuoteIdentifier(name)
	id := uuid.NewString()

	livetest.SuppressedExec(
		t,
		database,
		"CREATE SCHEMA "+schema+"; CREATE TABLE "+schema+".documents(id integer PRIMARY KEY,embedding vector(2)); INSERT INTO "+schema+".documents(id) VALUES (1)",
	)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(
			context.WithoutCancel(t.Context()),
			10*time.Second,
		)
		defer cancel()

		if err := hc.QueryMetadata(
			ctx,
			map[string]any{
				"type": "pg_untrack_table",
				"args": map[string]any{
					"source":  "default",
					"table":   map[string]any{"schema": name, "name": "documents"},
					"cascade": true,
				},
			},
			new(any),
		); err != nil {
			t.Error("untracking worker target failed")
		}

		livetest.SuppressedExec(
			t,
			database,
			`DELETE FROM ai.auto_embeddings_configuration WHERE id=$1`,
			id,
		)

		if _, err := database.ExecContext(
			ctx,
			"DROP SCHEMA "+schema+" CASCADE",
		); err != nil {
			t.Error("dropping worker target failed")
		}
	})

	if err := hc.QueryMetadata(
		t.Context(),
		map[string]any{
			"type": "pg_track_table",
			"args": map[string]any{
				"source": "default",
				"table":  map[string]any{"schema": name, "name": "documents"},
			},
		},
		new(any),
	); err != nil {
		t.Fatal("tracking worker target failed")
	}

	query := fmt.Sprintf(`query { %s_documents { id } }`, name)
	mutation := fmt.Sprintf(
		`mutation($id:Int!,$embeddings:vector!) { update_%s_documents_by_pk(pk_columns:{id:$id},_set:{embedding:$embeddings}) { id } }`,
		name,
	)
	future := time.Now().Add(24 * time.Hour)
	livetest.SuppressedExec(
		t,
		database,
		`INSERT INTO ai.auto_embeddings_configuration(id,name,schema_name,table_name,column_name,provider,dimensions,model,query,mutation,last_run) VALUES($1,$2,$2,'documents','embedding','openai',2,'local-model',$3,$4,$5)`,
		id,
		name,
		query,
		mutation,
		future,
	)

	server := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != "/v1/embeddings" {
				t.Error("unexpected adapter path")
			}

			if _, err := io.WriteString(w, `{"data":[{"embedding":[1,0]}]}`); err != nil {
				t.Error("writing embedding response failed")
			}
		}),
	)
	defer server.Close()

	built, err := embedder.BuildConfiguredEmbedders(
		fmt.Sprintf(
			`[{"name":"openai","type":"openai_embeddings","configuration":{"base_url":%q}}]`,
			server.URL+"/v1",
		),
		nil,
	)
	if err != nil {
		t.Fatal("building worker registry failed")
	}

	client := &observingLiveClient{Client: hc, mutation: mutation, writes: 0, t: t}
	process := New(
		time.Minute,
		client,
		built.Registry,
		autoai.NewAutoAI(
			hc,
			autoai.NewSQLCatalog(database),
			built.Registry,
			"http://ai",
			"test-secret",
		),
		slog.New(slog.DiscardHandler),
	)

	config, err := hc.GetAiAutoEmbeddingsConfiguration(t.Context(), id)
	if err != nil {
		t.Fatal("loading worker configuration failed")
	}

	process.run(t.Context(), config.AiAutoEmbeddingsConfiguration, process.logger)

	if client.writes != 1 {
		t.Fatal("direct worker run did not complete mutation")
	}
}
