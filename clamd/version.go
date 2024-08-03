package clamd

import (
	"fmt"
	"strings"
)

type Version struct {
	Version string
}

func parseVersion(response []byte) Version {
	parts := strings.SplitN(string(response), " ", 2) //nolint:mnd
	return Version{
		Version: parts[1],
	}
}

func (c *Client) Version() (Version, error) {
	conn, err := c.Dial()
	if err != nil {
		return Version{}, fmt.Errorf("failed to dial: %w", err)
	}
	defer conn.Close()

	if err := sendCommand(conn, "VERSION"); err != nil {
		return Version{}, fmt.Errorf("failed to send VERSION command: %w", err)
	}

	response, err := readResponse(conn)
	if err != nil {
		return Version{}, fmt.Errorf("failed to read response: %w", err)
	}

	return parseVersion(response), nil
}
