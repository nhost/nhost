package clienv //nolint:testpackage

import (
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"testing"
)

func newTestCliEnv() *CliEnv {
	return New(
		io.Discard, io.Discard,
		NewPathStructure("", "", "", ""),
		"", "", "", "", "", "", "",
	)
}

func setupAuthFile(t *testing.T, refreshToken string) {
	t.Helper()

	nhostDir := filepath.Join(os.Getenv("XDG_STATE_HOME"), "nhost")
	if err := os.MkdirAll(nhostDir, 0o755); err != nil {
		t.Fatalf("failed to create nhost dir: %v", err)
	}

	creds := Credentials{RefreshToken: refreshToken}

	data, err := json.Marshal(creds)
	if err != nil {
		t.Fatalf("failed to marshal credentials: %v", err)
	}

	authFile := filepath.Join(nhostDir, "auth.json")
	if err := os.WriteFile(authFile, data, 0o600); err != nil {
		t.Fatalf("failed to write auth file: %v", err)
	}
}

func TestCredentials(t *testing.T) {
	t.Run("valid credentials", func(t *testing.T) {
		t.Setenv("XDG_STATE_HOME", t.TempDir())
		setupAuthFile(t, "test-refresh-token")

		result, err := newTestCliEnv().Credentials()
		if err != nil {
			t.Fatalf("expected no error, got: %v", err)
		}

		if result.RefreshToken != "test-refresh-token" {
			t.Fatalf(
				"expected refresh token %q, got %q",
				"test-refresh-token",
				result.RefreshToken,
			)
		}
	})

	t.Run("missing file", func(t *testing.T) {
		t.Setenv("XDG_STATE_HOME", t.TempDir())

		_, err := newTestCliEnv().Credentials()
		if err == nil {
			t.Fatal("expected error for missing auth file")
		}
	})

	t.Run("empty refresh token", func(t *testing.T) {
		t.Setenv("XDG_STATE_HOME", t.TempDir())
		setupAuthFile(t, "")

		_, err := newTestCliEnv().Credentials()
		if !errors.Is(err, errMissingRefreshToken) {
			t.Fatalf(
				"expected errMissingRefreshToken, got: %v",
				err,
			)
		}
	})
}

func TestSaveCredentials(t *testing.T) {
	t.Setenv("XDG_STATE_HOME", t.TempDir())

	ce := newTestCliEnv()
	creds := Credentials{RefreshToken: "saved-token"}

	if err := saveCredentials(ce, creds); err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	result, err := ce.Credentials()
	if err != nil {
		t.Fatalf("expected no error reading back, got: %v", err)
	}

	if result.RefreshToken != "saved-token" {
		t.Fatalf(
			"expected refresh token %q, got %q",
			"saved-token",
			result.RefreshToken,
		)
	}
}
