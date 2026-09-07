package main

import (
	"bytes"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	nhost "github.com/nhost/nhost/packages/nhost-go"
)

func TestLoadConfigRequiresCredentials(t *testing.T) {
	tests := []struct {
		name     string
		email    string
		password string
		wantErr  bool
	}{
		{name: "both missing", email: "", password: "", wantErr: true},
		{name: "email missing", email: "", password: "secret", wantErr: true},
		{name: "password missing", email: "service@example.com", password: "", wantErr: true},
		{name: "both set", email: "service@example.com", password: "secret", wantErr: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("NHOST_EMAIL", tt.email)
			t.Setenv("NHOST_PASSWORD", tt.password)

			cfg, err := loadConfig()
			if tt.wantErr {
				if !errors.Is(err, errMissingAuth) {
					t.Fatalf("loadConfig() error = %v, want %v", err, errMissingAuth)
				}

				return
			}

			if err != nil {
				t.Fatalf("loadConfig() unexpected error: %v", err)
			}

			if cfg.email != tt.email || cfg.password != tt.password {
				t.Fatalf("loadConfig() credentials = (%q, %q), want (%q, %q)",
					cfg.email, cfg.password, tt.email, tt.password)
			}
		})
	}
}

func TestEnsureAuthRejectsSignUpWithoutSession(t *testing.T) {
	t.Parallel()

	authService := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch r.URL.Path {
		case "/v1/signin/email-password":
			w.WriteHeader(http.StatusUnauthorized)

			if _, err := w.Write([]byte(`{"message":"invalid credentials"}`)); err != nil {
				t.Errorf("write sign-in response: %v", err)
			}
		case "/v1/signup/email-password":
			if _, err := w.Write([]byte(`{"session":null}`)); err != nil {
				t.Errorf("write sign-up response: %v", err)
			}
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(authService.Close)

	client := nhost.New(nhost.Options{
		Subdomain:    "",
		Region:       "",
		AuthURL:      authService.URL + "/v1",
		StorageURL:   "",
		GraphQLURL:   "",
		FunctionsURL: "",
		Storage:      nil,
		HTTPClient:   authService.Client(),
		Configure:    nil,
	})
	srv := &server{
		cfg: config{
			subdomain:        "",
			region:           "",
			authURL:          "",
			storageURL:       "",
			email:            "service@example.com",
			password:         "secret",
			publicStorageURL: "",
			cataasURL:        "",
			port:             "",
		},
		nhost:       client,
		http:        authService.Client(),
		uploadSlots: nil,
	}

	if err := srv.ensureAuth(t.Context()); !errors.Is(err, errNoSignUpSession) {
		t.Fatalf("ensureAuth() error = %v, want %v", err, errNoSignUpSession)
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
			email:            "",
			password:         "",
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
			email:            "",
			password:         "",
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
		t.Fatalf("handleUpload() status = %d, want %d", recorder.Code, http.StatusServiceUnavailable)
	}

	if got := recorder.Header().Get("Retry-After"); got != "1" {
		t.Fatalf("handleUpload() Retry-After = %q, want %q", got, "1")
	}
}
