package cmd

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	serveutil "github.com/nhost/nhost/internal/lib/serve"
	"github.com/urfave/cli/v3"
)

const serviceTestJWTConfig = `{"type":"HS256","key":"service-test-jwt-secret-32-bytes-long"}`

func TestNewService(t *testing.T) {
	t.Parallel()

	metadataPath := copyServiceTestMetadata(t)

	if svc, err := runNewService(t, metadataPath, "://invalid"); err == nil {
		svc.Shutdown()
		t.Fatal("NewService with an invalid Hasura upstream URL returned no error")
	} else if !strings.Contains(err.Error(), "invalid "+flagHasuraUpstreamURL) {
		t.Fatalf("NewService error = %q, want invalid Hasura upstream URL", err)
	}

	// A successful construction after the failure exercises the same metadata
	// path again and guards the failure cleanup from poisoning later instances.
	svc, err := runNewService(t, metadataPath, "")
	if err != nil {
		t.Fatalf("NewService after failed construction: %v", err)
	}

	if svc.Handler == nil {
		t.Fatal("NewService Handler is nil")
	}

	if svc.Background == nil {
		t.Error("NewService Background is nil")
	}

	if svc.Close == nil {
		t.Fatal("NewService Close is nil")
	}

	recorder := httptest.NewRecorder()
	svc.Handler.ServeHTTP(
		recorder,
		httptest.NewRequest(http.MethodGet, "/healthz", nil),
	)

	if recorder.Code != http.StatusOK {
		t.Errorf("GET /healthz status = %d, want %d", recorder.Code, http.StatusOK)
	}

	svc.Close()
	svc.Shutdown()
}

func runNewService(
	t *testing.T,
	metadataPath string,
	hasuraUpstreamURL string,
) (*serveutil.Service, error) {
	t.Helper()

	var svc *serveutil.Service

	cmd := &cli.Command{
		Name:  "serve",
		Flags: serveFlags(),
		Action: func(ctx context.Context, cmd *cli.Command) error {
			var err error

			svc, err = NewService(ctx, cmd, slog.New(slog.DiscardHandler))

			return err
		},
	}

	err := cmd.Run(context.Background(), []string{
		"serve",
		"--" + flagMetadataPath, metadataPath,
		"--" + flagAdminSecret, "service-test-admin-secret",
		"--" + flagJWTSecret, serviceTestJWTConfig,
		"--" + flagHasuraUpstreamURL, hasuraUpstreamURL,
	})
	if err != nil {
		return nil, fmt.Errorf("running serve command: %w", err)
	}

	return svc, nil
}

func copyServiceTestMetadata(t *testing.T) string {
	t.Helper()

	fixture := filepath.Join(
		"..", "metadata", "internal", "hasura", "testdata", "TestFromYAML", "success",
	)

	destination := filepath.Join(t.TempDir(), "metadata")
	if err := os.CopyFS(destination, os.DirFS(fixture)); err != nil {
		t.Fatalf("copying metadata fixture: %v", err)
	}

	return filepath.Join(destination, "metadata.yaml")
}
