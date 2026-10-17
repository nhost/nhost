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
)

func TestNewServiceShutdownReleasesSQLiteConnector(t *testing.T) {
	t.Parallel()

	metadataPath, databasePath := newServiceTestSQLiteMetadata(t)
	requireNoSQLiteDescriptors(t, databasePath)

	svc, err := newTestService(t, metadataPath)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	openDescriptors := sqliteDescriptorCount(t, databasePath)
	if openDescriptors == 0 {
		t.Fatal("NewService opened 0 SQLite descriptors, want at least 1")
	}

	closeService(t, svc)
	requireNoSQLiteDescriptors(t, databasePath)
	t.Logf("SQLite descriptors: constructed=%d, after Close=0", openDescriptors)
}

// closeService releases a constructed service the way serve.Run does, with a
// context bounded by the shutdown budget.
func closeService(t *testing.T, svc *serveutil.Service) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	if err := svc.Close(ctx); err != nil {
		t.Fatalf("Close: %v", err)
	}
}

// NewService validates its Options before acquiring anything, so an invalid one
// opens no connector that would then need releasing.
func TestNewServiceInvalidConfigOpensNothing(t *testing.T) {
	t.Parallel()

	metadataPath, databasePath := newServiceTestSQLiteMetadata(t)
	requireNoSQLiteDescriptors(t, databasePath)

	opts := serviceTestOptions(metadataPath)
	opts.GraphQLRequestBodyLimitBytes = 0

	svc, err := NewService(context.Background(), opts, slog.New(slog.DiscardHandler))
	if svc != nil {
		closeService(t, svc)
		t.Fatal("NewService with an invalid body limit returned a service")
	}

	if !errors.Is(err, errGraphQLBodyLimitNotPositive) {
		t.Fatalf("NewService error = %v, want wrapping %v", err, errGraphQLBodyLimitNotPositive)
	}

	requireNoSQLiteDescriptors(t, databasePath)
}

func TestNewServiceBackgroundThenShutdownReleasesSQLiteConnectorOnce(t *testing.T) {
	t.Parallel()

	metadataPath, databasePath := newServiceTestSQLiteMetadata(t)
	requireNoSQLiteDescriptors(t, databasePath)

	svc, err := newTestService(t, metadataPath)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	openDescriptors := sqliteDescriptorCount(t, databasePath)
	if openDescriptors == 0 {
		t.Fatal("NewService opened 0 SQLite descriptors, want at least 1")
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if err := svc.Background(ctx); err != nil {
		t.Fatalf("Background: %v", err)
	}

	requireNoSQLiteDescriptors(t, databasePath)
	closeService(t, svc)
	requireNoSQLiteDescriptors(t, databasePath)
	t.Logf(
		"SQLite descriptors: constructed=%d, after Background=0, after Close=0",
		openDescriptors,
	)
}

// newTestService builds constellation over the SQLite metadata at
// metadataPath, with the Hasura proxy disabled.
func newTestService(t *testing.T, metadataPath string) (*serveutil.Service, error) {
	t.Helper()

	return NewService(
		context.Background(), serviceTestOptions(metadataPath), slog.New(slog.DiscardHandler),
	)
}

func serviceTestOptions(metadataPath string) Options {
	opts := validTestOptions()
	opts.MetadataPath = metadataPath

	return opts
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
