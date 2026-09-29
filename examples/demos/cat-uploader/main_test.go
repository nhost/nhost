package main

import (
	"bytes"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	nhost "github.com/nhost/nhost/packages/nhost-go"
	"github.com/nhost/nhost/packages/nhost-go/middleware"
)

func TestLoadConfigRequiresAdminSecret(t *testing.T) {
	tests := []struct {
		name        string
		adminSecret string
		wantErr     bool
	}{
		{name: "missing", adminSecret: "", wantErr: true},
		{name: "set", adminSecret: "nhost-admin-secret", wantErr: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("NHOST_ADMIN_SECRET", tt.adminSecret)

			cfg, err := loadConfig()
			if tt.wantErr {
				if !errors.Is(err, errMissingAdminSecret) {
					t.Fatalf("loadConfig() error = %v, want %v", err, errMissingAdminSecret)
				}

				return
			}

			if err != nil {
				t.Fatalf("loadConfig() unexpected error: %v", err)
			}

			if cfg.adminSecret != tt.adminSecret {
				t.Fatalf("loadConfig() admin secret = %q, want %q",
					cfg.adminSecret, tt.adminSecret)
			}
		})
	}
}

// TestAdminSecretReachesStorage pins the pattern this example documents: the
// service authenticates as a trusted backend with the admin secret, never by
// signing in as a user. AllowInsecureHTTP is required because the Run service
// reaches storage over plain HTTP inside the Nhost network.
func TestAdminSecretReachesStorage(t *testing.T) {
	t.Parallel()

	const adminSecret = "nhost-admin-secret" //nolint:gosec // Test fixture, not a real credential.

	seen := make(chan string, 1)
	storageService := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			seen <- r.Header.Get("x-hasura-admin-secret")

			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{}`))
		}),
	)
	t.Cleanup(storageService.Close)

	client := nhost.NewBareClient(nhost.Options{
		StorageURL: storageService.URL + "/v1",
		HTTPClient: storageService.Client(),
		Configure: []nhost.ConfigureFunc{
			nhost.WithAdminSession(middleware.AdminSessionOptions{
				AdminSecret:       adminSecret,
				AllowInsecureHTTP: true,
			}),
		},
	})

	if _, _, err := client.Storage.GetVersion(t.Context(), nil); err != nil {
		t.Fatalf("storage request: %v", err)
	}

	if got := <-seen; got != adminSecret {
		t.Fatalf("x-hasura-admin-secret = %q, want %q", got, adminSecret)
	}
}

func TestFetchCatRejectsOversizedImage(t *testing.T) {
	t.Parallel()

	cat := bytes.Repeat([]byte("x"), maxCatBytes+1)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "image/jpeg")

		if _, err := w.Write(cat); err != nil {
			t.Errorf("write cat response: %v", err)
		}
	}))
	t.Cleanup(upstream.Close)

	srv := &server{
		cfg: config{
			subdomain:        "",
			region:           "",
			authURL:          "",
			storageURL:       "",
			adminSecret:      "",
			publicStorageURL: "",
			cataasURL:        upstream.URL,
			port:             "",
		},
		nhost:       nil,
		http:        upstream.Client(),
		uploadSlots: nil,
	}

	if _, _, err := srv.fetchCat(t.Context()); !errors.Is(err, errCatTooLarge) {
		t.Fatalf("fetchCat() error = %v, want %v", err, errCatTooLarge)
	}
}

func TestHandleUploadRejectsWhenBusy(t *testing.T) {
	t.Parallel()

	uploadSlots := make(chan struct{}, 1)
	uploadSlots <- struct{}{}

	srv := &server{
		cfg: config{
			subdomain:        "",
			region:           "",
			authURL:          "",
			storageURL:       "",
			adminSecret:      "",
			publicStorageURL: "",
			cataasURL:        "",
			port:             "",
		},
		nhost:       nil,
		http:        nil,
		uploadSlots: uploadSlots,
	}

	recorder := httptest.NewRecorder()
	srv.handleUpload(recorder, httptest.NewRequest(http.MethodPost, "/upload", nil))

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf(
			"handleUpload() status = %d, want %d",
			recorder.Code,
			http.StatusServiceUnavailable,
		)
	}

	if got := recorder.Header().Get("Retry-After"); got != "1" {
		t.Fatalf("handleUpload() Retry-After = %q, want %q", got, "1")
	}
}
