package hasura_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/Yamashou/gqlgenc/clientv2"
	"github.com/nhost/nhost/services/ai/hasura"
)

// newMetadataTestClient wires a hasura.Client whose QueryMetadata POSTs land
// on the given handler. metadata's URL builder strips two path segments from
// BaseURL and appends /v1/metadata, so we provide a placeholder path that
// resolves cleanly.
func newMetadataTestClient(
	t *testing.T,
	handler http.HandlerFunc,
) *hasura.Client {
	t.Helper()

	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	c := hasura.NewClient(
		srv.Client(),
		srv.URL+"/v1/graphql",
		&clientv2.Options{ParseDataAlongWithErrors: false},
	)

	return c
}

// errorHandler returns a handler that fires sequential responses keyed by an
// atomic counter — useful for testing recovery paths that re-issue requests.
type sequentialResponse struct {
	status int
	body   string
}

func newSequentialHandler(
	t *testing.T,
	responses []sequentialResponse,
) (http.HandlerFunc, *[][]byte) {
	t.Helper()

	var idx atomic.Int32

	captured := make([][]byte, 0, len(responses))

	mu := make(chan struct{}, 1)
	mu <- struct{}{}

	handler := func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("failed to read body: %v", err)
		}

		<-mu

		captured = append(captured, body)

		mu <- struct{}{}

		i := idx.Add(1) - 1
		if int(i) >= len(responses) {
			t.Errorf("unexpected request #%d", i)
			w.WriteHeader(http.StatusInternalServerError)

			return
		}

		resp := responses[i]
		w.WriteHeader(resp.status)
		_, _ = w.Write([]byte(resp.body))
	}

	return handler, &captured
}

func TestTrackTable(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name           string
		responses      []sequentialResponse
		wantReqs       int
		wantErr        bool
		wantSecondType string
	}{
		{
			name: "success on first call",
			responses: []sequentialResponse{
				{status: http.StatusOK, body: `{}`},
			},
			wantReqs: 1,
		},
		{
			name: "already-tracked falls back to pg_set_table_customization",
			responses: []sequentialResponse{
				{
					status: http.StatusBadRequest,
					body:   `{"code":"already-tracked","error":"table already tracked","path":"$"}`,
				},
				{status: http.StatusOK, body: `{}`},
			},
			wantReqs:       2,
			wantSecondType: "pg_set_table_customization",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			handler, captured := newSequentialHandler(t, tc.responses)
			c := newMetadataTestClient(t, handler)

			req := &hasura.TrackTableRequest{
				Type: "pg_track_table",
				Args: hasura.TrackTableRequestArgs{
					Source: "default",
					Table: hasura.TrackTableRequestArgsTable{
						Schema: "public", Name: "users",
					},
					Configuration: hasura.TrackTableRequestArgsConfiguration{},
				},
			}

			err := c.TrackTable(context.Background(), req)
			if (err != nil) != tc.wantErr {
				t.Fatalf("TrackTable() err = %v, wantErr = %v", err, tc.wantErr)
			}

			if got := len(*captured); got != tc.wantReqs {
				t.Fatalf("requests: expected %d, got %d", tc.wantReqs, got)
			}

			if tc.wantSecondType != "" {
				var second map[string]any
				if err := json.Unmarshal((*captured)[1], &second); err != nil {
					t.Fatalf("failed to parse second request: %v", err)
				}

				if got, _ := second["type"].(string); got != tc.wantSecondType {
					t.Errorf(
						"second request type: expected %q, got %q",
						tc.wantSecondType, got,
					)
				}
			}
		})
	}
}
