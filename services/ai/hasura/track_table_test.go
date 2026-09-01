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
	"github.com/google/go-cmp/cmp"
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

func TestTrackEnumTable(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name      string
		responses []sequentialResponse
		wantReqs  int
		wantErr   bool
		// wantSecondType is the expected "type" field of the second request
		// (after recovery). Empty when wantReqs == 1.
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
		{
			name: "other error propagates",
			responses: []sequentialResponse{
				{
					status: http.StatusBadRequest,
					body:   `{"code":"some-other-code","error":"boom","path":"$"}`,
				},
			},
			wantReqs: 1,
			wantErr:  true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			handler, captured := newSequentialHandler(t, tc.responses)
			c := newMetadataTestClient(t, handler)

			req := &hasura.TrackEnumTableRequest{
				Type: "pg_track_table",
				Args: hasura.TrackEnumTableArgs{
					Source: "default",
					Table: hasura.TrackTableRequestArgsTable{
						Schema: "public", Name: "color",
					},
					IsEnum:        true,
					Configuration: hasura.TrackTableRequestArgsConfiguration{},
				},
			}

			err := c.TrackEnumTable(context.Background(), req)
			if (err != nil) != tc.wantErr {
				t.Fatalf("TrackEnumTable() err = %v, wantErr = %v", err, tc.wantErr)
			}

			if got := len(*captured); got != tc.wantReqs {
				t.Fatalf("requests: expected %d, got %d", tc.wantReqs, got)
			}

			// Verify first request carries the is_enum flag (sensitive shape).
			var first map[string]any
			if err := json.Unmarshal((*captured)[0], &first); err != nil {
				t.Fatalf("failed to parse first request: %v", err)
			}

			args, ok := first["args"].(map[string]any)
			if !ok {
				t.Fatalf("args missing or wrong type: %T", first["args"])
			}

			if isEnum, _ := args["is_enum"].(bool); !isEnum {
				t.Errorf("first request: expected is_enum=true, got %v", args["is_enum"])
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

				secondArgs, ok := second["args"].(map[string]any)
				if !ok {
					t.Fatalf("second args missing or wrong type: %T", second["args"])
				}

				if _, ok := secondArgs["is_enum"]; ok {
					t.Errorf("second request: unexpected is_enum key: %v", secondArgs)
				}
			}
		})
	}
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

func TestTrackEnumTableRequestShape(t *testing.T) {
	t.Parallel()

	// Pin the JSON shape of TrackEnumTableRequest so a refactor that renames
	// or drops a field surfaces here, not as a silent migration breakage.
	if diff := cmp.Diff(
		`{"type":"pg_track_table","args":{"source":"default",`+
			`"table":{"schema":"public","name":"color"},"is_enum":true,`+
			`"configuration":{"custom_name":"","custom_root_fields":`+
			`{"select":"","select_by_pk":"","select_aggregate":"","select_stream":"",`+
			`"insert":"","insert_one":"","update":"","update_by_pk":"","update_many":"",`+
			`"delete":"","delete_by_pk":""},"column_config":null}}}`,
		mustMarshal(t, &hasura.TrackEnumTableRequest{
			Type: "pg_track_table",
			Args: hasura.TrackEnumTableArgs{
				Source: "default",
				Table: hasura.TrackTableRequestArgsTable{
					Schema: "public", Name: "color",
				},
				IsEnum:        true,
				Configuration: hasura.TrackTableRequestArgsConfiguration{},
			},
		}),
	); diff != "" {
		t.Errorf("JSON shape drifted (-want +got):\n%s", diff)
	}
}

func mustMarshal(t *testing.T, v any) string {
	t.Helper()

	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	return string(b)
}
