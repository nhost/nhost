package tui

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"syscall"

	"golang.org/x/term"
)

func PromptInput(hide bool) (string, error) {
	reader := bufio.NewReader(os.Stdin)
	var response string
	var err error

	if !hide {
		response, err = reader.ReadString('\n')
		if err != nil {
			return "", fmt.Errorf("failed to read input: %w", err)
		}
	} else {
		output, err := term.ReadPassword(syscall.Stdin)
		if err != nil {
			return "", fmt.Errorf("failed to read input: %w", err)
		}
		response = string(output)
	}

	return strings.TrimSpace(response), err
}
