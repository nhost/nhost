package system

import (
	"fmt"
	"io"
	"os"
	"strings"
)

func AddToGitignore(l string) error {
	f, err := os.OpenFile(".gitignore", os.O_APPEND|os.O_CREATE|os.O_RDWR, 0o644) //nolint:mnd
	if err != nil {
		return fmt.Errorf("failed to open gitignore: %w", err)
	}
	defer f.Close()

	b, err := io.ReadAll(f)
	if err != nil {
		return fmt.Errorf("failed to read gitignore: %w", err)
	}

	if strings.Contains(string(b), l) {
		return nil
	}

	if _, err := f.WriteString(l); err != nil {
		return fmt.Errorf("failed to write gitignore: %w", err)
	}

	return nil
}
