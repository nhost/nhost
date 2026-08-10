//go:build windows

package term

import (
	"os"

	"golang.org/x/sys/windows"
)

func enableVirtualTerminalProcessing(f *os.File) error {
	stdout := windows.Handle(f.Fd())

	var originalMode uint32
	windows.GetConsoleMode(stdout, &originalMode)
	return windows.SetConsoleMode(stdout, originalMode|windows.ENABLE_VIRTUAL_TERMINAL_PROCESSING)
}

func openTTY() (*os.File, error) {
	return os.Open("CONOUT$")
}
