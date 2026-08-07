// Command cat-uploader is a small HTTP service, meant to run as an Nhost Run
// service, that demonstrates the Nhost Go SDK end to end:
//
//	POST /upload?count=N
//	  1. fetches N random cat pictures from cataas.com (Cat-as-a-Service),
//	  2. authenticates against Nhost Auth (email/password),
//	  3. uploads the images to Nhost Storage using the authenticated session,
//	  4. returns the resulting file IDs, names and public URLs as JSON.
//
// It authenticates once at startup (signing up the service user on first run),
// and relies on the SDK's client-side session middleware to attach the bearer
// token and refresh it automatically.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	nhost "github.com/nhost/nhost/packages/nhost-go"
	"github.com/nhost/nhost/packages/nhost-go/auth"
	"github.com/nhost/nhost/packages/nhost-go/storage"
)

const maxCount = 10

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// config is resolved from the environment. Inside a Run service the *_URL
// overrides point at the internal service names (e.g. http://auth:4000/v1);
// from a laptop they can be left unset and subdomain/region are used instead.
type config struct {
	subdomain  string
	region     string
	authURL    string
	storageURL string
	email      string
	password   string
	// publicStorageURL is only used to build browser-facing download links in
	// the response; it is not used to talk to storage.
	publicStorageURL string
	cataasURL        string
	port             string
}

func loadConfig() config {
	subdomain := env("NHOST_SUBDOMAIN", "local")
	region := env("NHOST_REGION", "local")
	return config{
		subdomain:        subdomain,
		region:           region,
		authURL:          os.Getenv("NHOST_AUTH_URL"),
		storageURL:       os.Getenv("NHOST_STORAGE_URL"),
		email:            env("NHOST_EMAIL", "cat-uploader@example.com"),
		password:         env("NHOST_PASSWORD", "password-1234"),
		publicStorageURL: env("PUBLIC_STORAGE_URL", "https://local.storage.local.nhost.run/v1"),
		cataasURL:        env("CATAAS_URL", "https://cataas.com"),
		port:             env("PORT", "8080"),
	}
}

type server struct {
	cfg   config
	nhost *nhost.Client
	http  *http.Client
}

// ensureAuth signs the service user in, creating the account on first run.
func (s *server) ensureAuth(ctx context.Context) error {
	_, err := s.nhost.Auth.SignInEmailPassword(ctx, auth.SignInEmailPasswordRequest{
		Email:    s.cfg.email,
		Password: s.cfg.password,
	}, nil)
	if err == nil {
		return nil
	}

	// Sign-in failed (most likely the user does not exist yet); try to create
	// it. Sign-up returns a session directly on this backend.
	log.Printf("sign-in failed (%v); attempting sign-up for %s", err, s.cfg.email)
	if _, suErr := s.nhost.Auth.SignUpEmailPassword(ctx, auth.SignUpEmailPasswordRequest{
		Email:    s.cfg.email,
		Password: s.cfg.password,
	}, nil); suErr != nil {
		return fmt.Errorf("sign-in and sign-up both failed: %w", errors.Join(err, suErr))
	}
	return nil
}

// fetchCat downloads one random cat picture, returning its bytes and file
// extension (derived from the response Content-Type).
func (s *server) fetchCat(ctx context.Context) ([]byte, string, error) {
	// Cache-buster so cataas returns a fresh cat each call.
	url := fmt.Sprintf("%s/cat?ts=%d", strings.TrimRight(s.cfg.cataasURL, "/"), time.Now().UnixNano())
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, "", err
	}
	resp, err := s.http.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("fetch cat: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return nil, "", fmt.Errorf("cataas returned status %d", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, 20<<20)) // 20 MiB cap
	if err != nil {
		return nil, "", err
	}
	ext := "jpg"
	switch ct := resp.Header.Get("Content-Type"); {
	case strings.Contains(ct, "png"):
		ext = "png"
	case strings.Contains(ct, "gif"):
		ext = "gif"
	case strings.Contains(ct, "webp"):
		ext = "webp"
	}
	return data, ext, nil
}

type uploadedFile struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Size     int    `json:"size"`
	MimeType string `json:"mimeType"`
	URL      string `json:"url"`
}

type uploadResponse struct {
	Count    int            `json:"count"`
	Uploaded []uploadedFile `json:"uploaded"`
}

func (s *server) handleUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "use POST", http.StatusMethodNotAllowed)
		return
	}
	count := 1
	if q := r.URL.Query().Get("count"); q != "" {
		n, err := strconv.Atoi(q)
		if err != nil || n < 1 {
			http.Error(w, "count must be a positive integer", http.StatusBadRequest)
			return
		}
		count = min(n, maxCount)
	}

	ctx := r.Context()
	out := uploadResponse{Uploaded: make([]uploadedFile, 0, count)}
	for i := range count {
		data, ext, err := s.fetchCat(ctx)
		if err != nil {
			s.writeError(w, http.StatusBadGateway, err)
			return
		}
		name := fmt.Sprintf("cat-%d-%d.%s", time.Now().UnixNano(), i, ext)
		resp, err := s.nhost.Storage.UploadFiles(ctx, storage.UploadFilesBody{
			File:     [][]byte{data},
			Metadata: &[]storage.UploadFileMetadata{{Name: &name}},
		}, nil)
		if err != nil {
			s.writeError(w, http.StatusBadGateway, fmt.Errorf("upload: %w", err))
			return
		}
		for _, f := range resp.Body.ProcessedFiles {
			out.Uploaded = append(out.Uploaded, uploadedFile{
				ID:       f.ID,
				Name:     f.Name,
				Size:     f.Size,
				MimeType: f.MimeType,
				URL:      fmt.Sprintf("%s/files/%s", strings.TrimRight(s.cfg.publicStorageURL, "/"), f.ID),
			})
		}
	}
	out.Count = len(out.Uploaded)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}

func (s *server) writeError(w http.ResponseWriter, status int, err error) {
	log.Printf("error: %v", err)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
}

func main() {
	cfg := loadConfig()

	httpClient := &http.Client{Timeout: 30 * time.Second}
	client := nhost.CreateClient(nhost.Options{
		Subdomain:  cfg.subdomain,
		Region:     cfg.region,
		AuthURL:    cfg.authURL,
		StorageURL: cfg.storageURL,
		HTTPClient: httpClient,
	})

	srv := &server{cfg: cfg, nhost: client, http: httpClient}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	if err := srv.ensureAuth(ctx); err != nil {
		cancel()
		log.Fatalf("authentication failed: %v", err)
	}
	cancel()
	log.Printf("authenticated as %s", cfg.email)

	mux := http.NewServeMux()
	mux.HandleFunc("/upload", srv.handleUpload)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	addr := ":" + cfg.port
	log.Printf("cat-uploader listening on %s", addr)
	httpSrv := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}
	if err := httpSrv.ListenAndServe(); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
