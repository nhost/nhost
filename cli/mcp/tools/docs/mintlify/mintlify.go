package mintlify

import (
	"context"
	"fmt"
)

const (
	apiBaseURL       = "https://api.mintlifytrieve.com"
	nhostDocsBaseURL = "https://docs.nhost.io"
)

type Mintlify struct {
	config *ConfigResponse
}

func New(ctx context.Context) (*Mintlify, error) {
	config, err := GetMcpConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("error getting MCP config: %w", err)
	}

	return &Mintlify{
		config: config,
	}, nil
}
