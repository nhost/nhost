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
	"github.com/nhost/nhost/packages/nhost-go/middleware"
	"github.com/nhost/nhost/packages/nhost-go/storage"
)

const (
	maxCount             = 10
	maxCatBytes          = 2 << 20 // 2 MiB cap on a downloaded cat image.
	maxConcurrentUploads = 2
	httpTimeout          = 30 * time.Second
	readTimeout          = 10 * time.Second
	readHeaderTimeout    = 10 * time.Second
	writeTimeout         = (2*maxCount + 1) * httpTimeout
	idleTimeout          = 60 * time.Second
)

var (
	// errUpstreamStatus is returned when cataas responds with a non-success status.
	errUpstreamStatus     = errors.New("unexpected upstream status")
	errCatTooLarge        = errors.New("cat image exceeds 2 MiB limit")
	errMissingAdminSecret = errors.New("NHOST_ADMIN_SECRET is required")
)

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
	subdomain   string
	region      string
	authURL     string
	storageURL  string
	adminSecret string
	// publicStorageURL is only used to build browser-facing download links in
	// the response; it is not used to talk to storage.
	publicStorageURL string
	cataasURL        string
	port             string
}

func loadConfig() (config, error) {
	adminSecret := os.Getenv("NHOST_ADMIN_SECRET")
	if adminSecret == "" {
		return config{}, errMissingAdminSecret
	}

	return config{
		subdomain:        env("NHOST_SUBDOMAIN", "local"),
		region:           env("NHOST_REGION", "local"),
		authURL:          os.Getenv("NHOST_AUTH_URL"),
		storageURL:       os.Getenv("NHOST_STORAGE_URL"),
		adminSecret:      adminSecret,
		publicStorageURL: env("PUBLIC_STORAGE_URL", "https://local.storage.local.nhost.run/v1"),
		cataasURL:        env("CATAAS_URL", "https://cataas.com"),
		port:             env("PORT", "8080"),
	}, nil
}

type server struct {
	cfg         config
	nhost       *nhost.Client
	http        *http.Client
	uploadSlots chan struct{}
}

// fetchCat downloads one random cat picture, returning its bytes and file
// extension (derived from the response Content-Type).
func (s *server) fetchCat(ctx context.Context) ([]byte, string, error) {
	// Cache-buster so cataas returns a fresh cat each call.
	url := fmt.Sprintf(
		"%s/cat?ts=%d",
		strings.TrimRight(s.cfg.cataasURL, "/"),
		time.Now().UnixNano(),
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, "", fmt.Errorf("create request: %w", err)
	}

	resp, err := s.http.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("fetch cat: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusMultipleChoices {
		return nil, "", fmt.Errorf(
			"cataas returned status %d: %w",
			resp.StatusCode,
			errUpstreamStatus,
		)
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxCatBytes+1))
	if err != nil {
		return nil, "", fmt.Errorf("read cat body: %w", err)
	}

	if len(data) > maxCatBytes {
		return nil, "", errCatTooLarge
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

func (s *server) acquireUploadSlot(w http.ResponseWriter) bool {
	select {
	case s.uploadSlots <- struct{}{}:
		return true
	default:
		w.Header().Set("Retry-After", "1")
		http.Error(w, "server is busy; retry later", http.StatusServiceUnavailable)

		return false
	}
}

func validateUploadRequest(w http.ResponseWriter, r *http.Request) bool {
	if r.Method != http.MethodPost {
		http.Error(w, "use POST", http.StatusMethodNotAllowed)

		return false
	}

	if r.ContentLength != 0 {
		http.Error(w, "request body is not supported", http.StatusBadRequest)

		return false
	}

	return true
}

func (s *server) handleUpload(w http.ResponseWriter, r *http.Request) {
	if !validateUploadRequest(w, r) {
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

	if !s.acquireUploadSlot(w) {
		return
	}
	defer func() { <-s.uploadSlots }()

	ctx := r.Context()

	out := uploadResponse{Count: 0, Uploaded: make([]uploadedFile, 0, count)}
	for i := range count {
		data, ext, err := s.fetchCat(ctx)
		if err != nil {
			s.writeError(w, http.StatusBadGateway, err)
			return
		}

		name := fmt.Sprintf("cat-%d-%d.%s", time.Now().UnixNano(), i, ext)

		uploaded, _, err := s.nhost.Storage.UploadFiles(
			ctx,
			storage.UploadFilesBody{ //nolint:exhaustruct
				File:     [][]byte{data},
				Metadata: &[]storage.UploadFileMetadata{{Name: &name}}, //nolint:exhaustruct
			},
			nil,
		)
		if err != nil {
			s.writeError(w, http.StatusBadGateway, fmt.Errorf("upload: %w", err))
			return
		}

		for _, f := range uploaded.ProcessedFiles {
			out.Uploaded = append(out.Uploaded, uploadedFile{
				ID:       f.ID,
				Name:     f.Name,
				Size:     f.Size,
				MimeType: f.MimeType,
				URL: fmt.Sprintf(
					"%s/files/%s",
					strings.TrimRight(s.cfg.publicStorageURL, "/"),
					f.ID,
				),
			})
		}
	}

	out.Count = len(out.Uploaded)

	w.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(out); err != nil {
		log.Printf("encode response: %v", err)
	}
}

func (s *server) writeError(w http.ResponseWriter, status int, err error) {
	log.Printf("error: %v", err)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(map[string]string{"error": err.Error()}); err != nil {
		log.Printf("encode error response: %v", err)
	}
}

func main() {
	cfg, err := loadConfig()
	if err != nil {
		log.Fatalf("configuration: %v", err)
	}

	httpClient := &http.Client{Timeout: httpTimeout} //nolint:exhaustruct

	// A Run service is trusted server-side code, so it authenticates with the
	// admin secret rather than signing in as a user — the same pattern the
	// serverless-function examples use.
	//
	// NewBareClient, not New: this process holds no user session, so the
	// refresh and token-attachment middleware would have nothing to act on, and
	// New documents that its client must not be shared across users in a
	// server. The admin middleware is the entire pipeline here.
	//
	// AllowInsecureHTTP is required because inside the Nhost stack this service
	// reaches storage over plain HTTP at http://storage:5000/v1; the SDK
	// otherwise withholds the secret from a cleartext request to a non-loopback
	// host. Never enable it for a client that leaves the internal network.
	client := nhost.NewBareClient(nhost.Options{ //nolint:exhaustruct
		Subdomain:  cfg.subdomain,
		Region:     cfg.region,
		AuthURL:    cfg.authURL,
		StorageURL: cfg.storageURL,
		HTTPClient: httpClient,
		Configure: []nhost.ConfigureFunc{
			nhost.WithAdminSession(middleware.AdminSessionOptions{ //nolint:exhaustruct
				AdminSecret:       cfg.adminSecret,
				AllowInsecureHTTP: true,
			}),
		},
	})

	srv := &server{
		cfg:         cfg,
		nhost:       client,
		http:        httpClient,
		uploadSlots: make(chan struct{}, maxConcurrentUploads),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/upload", srv.handleUpload)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	addr := ":" + cfg.port
	log.Printf("cat-uploader listening on %s", addr)

	httpSrv := &http.Server{ //nolint:exhaustruct
		Addr:              addr,
		Handler:           mux,
		ReadTimeout:       readTimeout,
		ReadHeaderTimeout: readHeaderTimeout,
		WriteTimeout:      writeTimeout,
		IdleTimeout:       idleTimeout,
	}
	if err := httpSrv.ListenAndServe(); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
