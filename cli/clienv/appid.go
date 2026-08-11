package clienv

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

// GetOrCreateAppID returns the app ID stored at path, creating it with a fresh
// random UUIDv4 if the file does not exist. The parent directory must already
// exist.
func GetOrCreateAppID(path string) (string, error) {
	b, err := os.ReadFile(path)
	if err == nil {
		id := strings.TrimSpace(string(b))
		if _, err := uuid.Parse(id); err != nil {
			return "", fmt.Errorf("app id file %s is malformed: %w", path, err)
		}

		return id, nil
	}

	if !errors.Is(err, os.ErrNotExist) {
		return "", fmt.Errorf("failed to read app id file %s: %w", path, err)
	}

	id := uuid.NewString()

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil { //nolint:mnd
		return "", fmt.Errorf("failed to create app id directory: %w", err)
	}

	if err := os.WriteFile(path, []byte(id+"\n"), 0o600); err != nil { //nolint:mnd
		return "", fmt.Errorf("failed to write app id file %s: %w", path, err)
	}

	return id, nil
}
