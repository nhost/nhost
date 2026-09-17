package clienv

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const projectNameFilePerm = 0o644

var errUnusableProjectName = errors.New("project name has no usable characters")

// WriteProjectName records name at path as the docker compose project name for
// this project. `nhost create` writes it into the generated backend so each
// project keeps its own containers and database volume without the user
// exporting NHOST_PROJECT_NAME.
func WriteProjectName(path, name string) error {
	sanitized := sanitizeName(name)
	if sanitized == "" {
		return fmt.Errorf("%w: %q", errUnusableProjectName, name)
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil { //nolint:mnd
		return fmt.Errorf("failed to create folder for %s: %w", path, err)
	}

	if err := os.WriteFile(path, []byte(sanitized+"\n"), projectNameFilePerm); err != nil {
		return fmt.Errorf("failed to write project name file %s: %w", path, err)
	}

	return nil
}

// projectNameFileSource reads the project name out of the file
// WriteProjectName produced. Where it ranks is resolveProjectName's business,
// not this type's: it only reports what the file holds, and stays silent when
// the file is missing, unreadable, or holds nothing a compose project name can
// be built from.
type projectNameFileSource struct {
	path string
}

func (s *projectNameFileSource) Lookup() (string, bool) {
	b, err := os.ReadFile(s.path)
	if err != nil {
		return "", false
	}

	firstLine, _, _ := strings.Cut(string(b), "\n")

	name := sanitizeName(firstLine)
	if name == "" {
		return "", false
	}

	return name, true
}
