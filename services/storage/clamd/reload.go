package clamd

import (
	"context"
	"fmt"
)

func (c *Client) Reload(ctx context.Context) error {
	conn, err := c.Dial(ctx)
	if err != nil {
		return fmt.Errorf("failed to dial: %w", err)
	}
	defer conn.Close()

	if err := sendCommand(conn, "RELOAD"); err != nil {
		return fmt.Errorf("failed to send RELOAD command: %w", err)
	}

	response, err := readResponse(conn)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	if string(response) != "RELOADING\n" {
		return fmt.Errorf("unknown response: %s", string(response)) //nolint:err113
	}

	return nil
}
