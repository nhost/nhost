package cmd

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"

	serveutil "github.com/nhost/nhost/internal/lib/serve"
	"github.com/urfave/cli/v3"
)

const serviceTestJWTConfig = `{"type":"HS256","key":"service-test-jwt-secret-32-bytes-long"}`

func TestNewServiceShutdownReleasesSQLiteConnector(t *testing.T) {
	t.Parallel()

	metadataPath, databasePath := newServiceTestSQLiteMetadata(t)
	requireNoSQLiteDescriptors(t, databasePath)

	svc, err := runNewService(t, metadataPath, "")
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	openDescriptors := sqliteDescriptorCount(t, databasePath)
	if openDescriptors == 0 {
		t.Fatal("NewService opened 0 SQLite descriptors, want at least 1")
	}

	svc.Shutdown()
	requireNoSQLiteDescriptors(t, databasePath)
	t.Logf("SQLite descriptors: constructed=%d, after Shutdown=0", openDescriptors)
}

func TestNewServiceRouterFailureReleasesSQLiteConnector(t *testing.T) {
	t.Parallel()

	metadataPath, databasePath := newServiceTestSQLiteMetadata(t)
	requireNoSQLiteDescriptors(t, databasePath)

	svc, err := runNewService(
		t,
		metadataPath,
		"",
		"--"+flagGraphQLRequestBodyLimitBytes,
		"0",
	)
	if svc != nil {
		svc.Shutdown()
		t.Fatal("NewService with an invalid body limit returned a service")
	}

	if err == nil {
		t.Fatal("NewService with an invalid body limit returned no error")
	}

	if !strings.Contains(err.Error(), flagGraphQLRequestBodyLimitBytes) {
		t.Fatalf("NewService error = %q, want %s", err, flagGraphQLRequestBodyLimitBytes)
	}

	requireNoSQLiteDescriptors(t, databasePath)
	t.Log("SQLite descriptors: after getRouter failure=0")
}

func TestNewServiceBackgroundThenShutdownReleasesSQLiteConnectorOnce(t *testing.T) {
	t.Parallel()

	metadataPath, databasePath := newServiceTestSQLiteMetadata(t)
	requireNoSQLiteDescriptors(t, databasePath)

	svc, err := runNewService(t, metadataPath, "")
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	openDescriptors := sqliteDescriptorCount(t, databasePath)
	if openDescriptors == 0 {
		t.Fatal("NewService opened 0 SQLite descriptors, want at least 1")
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if err := svc.RunBackground(ctx); err != nil {
		t.Fatalf("RunBackground: %v", err)
	}

	requireNoSQLiteDescriptors(t, databasePath)
	svc.Shutdown()
	requireNoSQLiteDescriptors(t, databasePath)
	t.Logf(
		"SQLite descriptors: constructed=%d, after Background=0, after Shutdown=0",
		openDescriptors,
	)
}

func runNewService(
	t *testing.T,
	metadataPath string,
	hasuraUpstreamURL string,
	extraArgs ...string,
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

	args := make([]string, 0, 9+len(extraArgs))
	args = append(
		args,
		"serve",
		"--"+flagMetadataPath, metadataPath,
		"--"+flagAdminSecret, "service-test-admin-secret",
		"--"+flagJWTSecret, serviceTestJWTConfig,
		"--"+flagHasuraUpstreamURL, hasuraUpstreamURL,
	)
	args = append(args, extraArgs...)

	if err := cmd.Run(context.Background(), args); err != nil {
		return nil, fmt.Errorf("running serve command: %w", err)
	}

	return svc, nil
}

func newServiceTestSQLiteMetadata(t *testing.T) (string, string) {
	t.Helper()

	tempDir := t.TempDir()
	databasePath := filepath.Join(tempDir, "service.sqlite")
	metadataPath := filepath.Join(tempDir, "metadata.toml")
	contents := fmt.Sprintf(`[[databases]]
name = "default"
kind = "sqlite"

[databases.configuration.connection_info]
database_url = %q
`, databasePath)

	if err := os.WriteFile(metadataPath, []byte(contents), 0o600); err != nil {
		t.Fatalf("writing SQLite metadata: %v", err)
	}

	return metadataPath, databasePath
}

func requireNoSQLiteDescriptors(t *testing.T, databasePath string) {
	t.Helper()

	if got := sqliteDescriptorCount(t, databasePath); got != 0 {
		t.Fatalf("SQLite descriptor count = %d, want 0", got)
	}
}

func sqliteDescriptorCount(t *testing.T, databasePath string) int {
	t.Helper()

	entries, err := os.ReadDir("/proc/self/fd")
	if errors.Is(err, fs.ErrNotExist) {
		t.Skip("descriptor lifecycle assertions require /proc/self/fd")
	}

	if err != nil {
		t.Fatalf("reading /proc/self/fd: %v", err)
	}

	count := 0
	for _, entry := range entries {
		target, err := os.Readlink(filepath.Join("/proc/self/fd", entry.Name()))
		if errors.Is(err, fs.ErrNotExist) {
			continue
		}

		if err != nil {
			t.Fatalf("reading descriptor %s: %v", entry.Name(), err)
		}

		if target == databasePath || strings.HasPrefix(target, databasePath+"-") {
			count++
		}
	}

	return count
}
