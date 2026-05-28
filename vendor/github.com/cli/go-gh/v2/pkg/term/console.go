//go:build !windows

package term

import (
	"errors"
	"os"
)

func enableVirtualTerminalProcessing(f *os.File) error {
	return errors.New("not implemented")
}

func openTTY() (*os.File, error) {
	return os.Open("/dev/tty")
}
