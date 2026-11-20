package migrations_test

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/internal/lib/hasura/metadata"
	"github.com/nhost/nhost/services/storage/migrations"
)

func checkCleanupMetadataRequests(
	t *testing.T,
	requests []metadata.TrackTable,
	alreadyTracked bool,
) {
	t.Helper()

	wantTypes := []string{"pg_track_table"}
	if alreadyTracked {
		wantTypes = append(wantTypes, "pg_set_table_customization")
	}

	gotTypes := make([]string, len(requests))

	wantConfiguration := metadata.Configuration{
		CustomName: "filesToDelete",
		CustomRootFields: metadata.CustomRootFields{
			Select:               "filesToDelete",
			SelectByPk:           "fileToDelete",
			SelectAggregate:      "filesToDeleteAggregate",
			Insert:               "insertFilesToDelete",
			InsertOne:            "insertFileToDelete",
			Update:               "updateFilesToDelete",
			UpdateByPk:           "updateFileToDelete",
			Delete:               "deleteFilesToDelete",
			DeleteByPk:           "deleteFileToDelete",
			AdditionalProperties: nil,
		},
		CustomColumnNames:    map[string]string{"id": "id", "deleted_at": "deletedAt"},
		AdditionalProperties: nil,
	}
	for i, request := range requests {
		gotTypes[i] = request.Type
		if diff := cmp.Diff(wantConfiguration, request.Args.Configuration); diff != "" {
			t.Errorf("%s cleanup configuration mismatch (-want +got):\n%s", request.Type, diff)
		}
	}

	if diff := cmp.Diff(wantTypes, gotTypes); diff != "" {
		t.Errorf("cleanup metadata requests mismatch (-want +got):\n%s", diff)
	}
}

func TestApplyHasuraMetadataCleanupCustomization(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		alreadyTracked bool
	}{
		{name: "new table"},
		{name: "already tracked table", alreadyTracked: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var (
				requests   []metadata.TrackTable
				requestsMu sync.Mutex
			)

			server := httptest.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					var request metadata.TrackTable
					if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
						t.Errorf("decode metadata request: %v", err)
						w.WriteHeader(http.StatusBadRequest)

						return
					}

					if request.Args.Table.Name == "files_to_delete" {
						requestsMu.Lock()

						requests = append(requests, request)
						requestsMu.Unlock()
					}

					w.Header().Set("Content-Type", "application/json")

					response := `{}`
					switch {
					case request.Type == "export_metadata":
						response = `{"metadata":{"sources":[]}}`
					case request.Type == "pg_track_table" && tt.alreadyTracked:
						w.WriteHeader(http.StatusBadRequest)

						response = `{"code":"already-tracked","error":"already tracked","path":"$"}`
					}

					if _, err := w.Write([]byte(response)); err != nil {
						t.Errorf("write metadata response: %v", err)
					}
				}),
			)
			defer server.Close()

			if err := migrations.ApplyHasuraMetadata(
				t.Context(), server.URL, "admin-secret", "default", slog.New(slog.DiscardHandler),
			); err != nil {
				t.Fatalf("ApplyHasuraMetadata() error = %v", err)
			}

			requestsMu.Lock()
			defer requestsMu.Unlock()

			checkCleanupMetadataRequests(t, requests, tt.alreadyTracked)
		})
	}
}
