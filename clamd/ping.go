package clamd

import "fmt"

func (c *Client) Ping() error {
	conn, err := c.Dial()
	if err != nil {
		return fmt.Errorf("failed to dial: %w", err)
	}
	defer conn.Close()

	if err := sendCommand(conn, "PING"); err != nil {
		return fmt.Errorf("failed to send PING command: %w", err)
	}

	response, err := readResponse(conn)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	if string(response) != "PONG\n" {
		return fmt.Errorf("unknown response: %s", string(response)) //nolint:goerr113
	}

	return nil
}
