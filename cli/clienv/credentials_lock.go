package clienv

import (
	"fmt"
	"os"
	"path/filepath"
	"syscall"
)

func (ce *CliEnv) withCredentialsLock(fn func() error) error {
	lockFile := ce.Path.AuthFile() + ".lock"

	if err := os.MkdirAll(filepath.Dir(lockFile), 0o755); err != nil { //nolint:mnd
		return fmt.Errorf("failed to create dir: %w", err)
	}

	f, err := os.OpenFile(lockFile, os.O_CREATE|os.O_RDWR, 0o600) //nolint:mnd
	if err != nil {
		return fmt.Errorf("failed to open credentials lock: %w", err)
	}
	defer f.Close()

	if err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX); err != nil {
		return fmt.Errorf("failed to lock credentials: %w", err)
	}

	return fn()
}
