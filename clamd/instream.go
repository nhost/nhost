package clamd

import (
	"context"
	"errors"
	"fmt"
	"io"
)

func (c *Client) InStream(ctx context.Context, r io.ReaderAt) error { //nolint: cyclop
	conn, err := c.Dial(ctx)
	if err != nil {
		return fmt.Errorf("failed to dial: %w", err)
	}
	defer conn.Close()

	if err := sendCommand(conn, "INSTREAM"); err != nil {
		return fmt.Errorf("failed to send INSTREAM command: %w", err)
	}

	var iter int64

	for {
		buf := make([]byte, chunkSize)

		nr, err := r.ReadAt(buf, iter*chunkSize)
		iter++

		if nr > 0 {
			if err := sendChunk(conn, buf[0:nr]); err != nil {
				return fmt.Errorf("failed to send chunk: %w", err)
			}
		}

		if errors.Is(err, io.EOF) {
			break
		}

		if err != nil {
			return fmt.Errorf("failed to read chunk: %w", err)
		}
	}

	if err := sendEOF(conn); err != nil {
		return fmt.Errorf("failed to send EOF: %w", err)
	}

	response, err := readResponse(conn)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	if string(response) == "stream: OK\n" {
		return nil
	}

	return &VirusFoundError{string(response[8 : len(response)-7])}
}
