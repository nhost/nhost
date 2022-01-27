// Package wsjson provides helpers for reading and writing JSON messages.
package wsjson // import "nhooyr.io/websocket/wsjson"

import (
	"context"
	"encoding/json"
	"fmt"

	"nhooyr.io/websocket"
	"nhooyr.io/websocket/internal/bpool"
	"nhooyr.io/websocket/internal/errd"
)

// Read reads a JSON message from c into v.
// It will reuse buffers in between calls to avoid allocations.
func Read(ctx context.Context, c *websocket.Conn, v interface{}) error {
	return read(ctx, c, v)
}

func read(ctx context.Context, c *websocket.Conn, v interface{}) (err error) {
	defer errd.Wrap(&err, "failed to read JSON message")

	_, r, err := c.Reader(ctx)
	if err != nil {
		return err
	}

	b := bpool.Get()
	defer bpool.Put(b)

	_, err = b.ReadFrom(r)
	if err != nil {
		return err
	}

	err = json.Unmarshal(b.Bytes(), v)
	if err != nil {
		c.Close(websocket.StatusInvalidFramePayloadData, "failed to unmarshal JSON")
		return fmt.Errorf("failed to unmarshal JSON: %w", err)
	}

	return nil
}

// Write writes the JSON message v to c.
// It will reuse buffers in between calls to avoid allocations.
func Write(ctx context.Context, c *websocket.Conn, v interface{}) error {
	return write(ctx, c, v)
}

func write(ctx context.Context, c *websocket.Conn, v interface{}) (err error) {
	defer errd.Wrap(&err, "failed to write JSON message")

	w, err := c.Writer(ctx, websocket.MessageText)
	if err != nil {
		return err
	}

	// json.Marshal cannot reuse buffers between calls as it has to return
	// a copy of the byte slice but Encoder does as it directly writes to w.
	err = json.NewEncoder(w).Encode(v)
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	return w.Close()
}
