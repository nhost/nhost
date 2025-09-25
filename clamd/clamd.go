package clamd

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"time"
)

const chunkSize = 1024

type Client struct {
	addr string
}

func NewClient(addr string) (*Client, error) {
	url, err := url.Parse(addr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse addr: %w", err)
	}

	if url.Scheme != "tcp" {
		return nil, fmt.Errorf("invalid scheme: %s", url.Scheme) //nolint:err113
	}

	return &Client{url.Host}, nil
}

func (c *Client) Dial(ctx context.Context) (net.Conn, error) {
	dialer := net.Dialer{ //nolint:exhaustruct
		Deadline: time.Now().Add(1 * time.Minute),
		Timeout:  time.Minute,
	}

	conn, err := dialer.DialContext(ctx, "tcp", c.addr)
	if err != nil {
		return nil, fmt.Errorf("failed to dial: %w", err)
	}

	return conn, nil
}

func sendCommand(conn net.Conn, command string) error {
	if _, err := fmt.Fprintf(conn,
		"n%s\n", command); err != nil {
		return fmt.Errorf("failed to write command: %w", err)
	}

	return nil
}

func readResponse(conn net.Conn) ([]byte, error) {
	buf := make([]byte, 1024) //nolint:mnd

	n, err := conn.Read(buf)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	return buf[:n], nil
}

func sendChunk(conn net.Conn, data []byte) error {
	var buf [4]byte

	lenData := len(data)
	buf[0] = byte(lenData >> 24) //nolint:mnd
	buf[1] = byte(lenData >> 16) //nolint:mnd
	buf[2] = byte(lenData >> 8)  //nolint:mnd
	buf[3] = byte(lenData >> 0)

	a := buf

	b := make([]byte, len(a))
	copy(b, a[:])

	if _, err := conn.Write(b); err != nil {
		return fmt.Errorf("failed to write chunk size: %w", err)
	}

	if _, err := conn.Write(data); err != nil {
		return fmt.Errorf("failed to write chunk: %w", err)
	}

	return nil
}

func sendEOF(conn net.Conn) error {
	_, err := conn.Write([]byte{0, 0, 0, 0})
	return err //nolint:wrapcheck
}
