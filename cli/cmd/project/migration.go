package project

import (
	"bytes"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

func filterInitMigrationPsqlRestrictions(migrationsDir string) (returnErr error) {
	root, err := os.OpenRoot(migrationsDir)
	if err != nil {
		return fmt.Errorf("open initial migrations directory: %w", err)
	}
	defer func() {
		if err := root.Close(); err != nil {
			returnErr = errors.Join(
				returnErr,
				fmt.Errorf("close initial migrations directory: %w", err),
			)
		}
	}()

	entries, err := fs.ReadDir(root.FS(), ".")
	if err != nil {
		return fmt.Errorf("read initial migrations directory: %w", err)
	}

	for _, entry := range entries {
		if !entry.IsDir() || !strings.HasSuffix(entry.Name(), "_init") {
			continue
		}

		migrationPath := filepath.Join(entry.Name(), "up.sql")

		contents, err := root.ReadFile(migrationPath)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}

		if err != nil {
			return fmt.Errorf("read initial migration %q: %w", migrationPath, err)
		}

		filtered := stripPsqlRestrictionCommands(contents)
		if bytes.Equal(contents, filtered) {
			continue
		}

		const fileMode = 0o600
		if err := root.WriteFile(migrationPath, filtered, fileMode); err != nil {
			return fmt.Errorf("write filtered initial migration %q: %w", migrationPath, err)
		}
	}

	return nil
}

func stripPsqlRestrictionCommands(contents []byte) []byte {
	filtered := make([]byte, 0, len(contents))
	for len(contents) > 0 {
		lineEnd := bytes.IndexByte(contents, '\n')

		var line []byte
		if lineEnd == -1 {
			line, contents = contents, nil
		} else {
			line, contents = contents[:lineEnd+1], contents[lineEnd+1:]
		}

		command := bytes.TrimSuffix(line, []byte("\n"))

		command = bytes.TrimSuffix(command, []byte("\r"))
		if bytes.HasPrefix(command, []byte(`\restrict `)) ||
			bytes.HasPrefix(command, []byte(`\unrestrict `)) {
			continue
		}

		filtered = append(filtered, line...)
	}

	return filtered
}
