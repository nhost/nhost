package clienv

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"strings"
)

// projectNameFileSource reads the project name recorded in nhost/project-name.
// Nothing in the CLI writes that file: it is committed and hand-written, which
// is what makes it the way to pin a compose project name for a layout the
// working directory name gets wrong, such as a backend kept in a folder of its
// own. Where it ranks, and what happens to a name compose would refuse, is
// resolveProjectName's business: this type only reports what the file holds.
type projectNameFileSource struct {
	path string
}

// Lookup returns the first non-blank line of the file, trimmed. A missing or
// blank file is not a source; a file that exists but cannot be read is an
// error.
func (s *projectNameFileSource) Lookup() (string, bool, error) {
	b, err := os.ReadFile(s.path)
	if errors.Is(err, fs.ErrNotExist) {
		return "", false, nil
	}

	if err != nil {
		return "", false, fmt.Errorf("failed to read project name: %w", err)
	}

	for line := range strings.Lines(string(b)) {
		if name := strings.TrimSpace(line); name != "" {
			return name, true, nil
		}
	}

	return "", false, nil
}
