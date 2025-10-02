package getter

import (
	"context"
)

type clientContextKey int

const clientContextValue clientContextKey = 0

func NewContextWithClient(ctx context.Context, client *Client) context.Context {
	return context.WithValue(ctx, clientContextValue, client)
}

func ClientFromContext(ctx context.Context) *Client {
	// ctx.Value returns nil if ctx has no value for the key;
	client, ok := ctx.Value(clientContextValue).(*Client)
	if !ok {
		return nil
	}
	return client
}

// configure configures a client with options.
func (c *Client) configure() error {
	// Default decompressor values
	if c.Decompressors == nil {
		c.Decompressors = Decompressors
	}
	// Default getter values
	if c.Getters == nil {
		c.Getters = Getters
	}
	return nil
}
