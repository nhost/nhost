package hasura

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

func (c *Client) RawQuery(
	ctx context.Context,
	query string,
	vars map[string]any,
	res any,
) error {
	r := struct {
		Query     string         `json:"query"`
		Variables map[string]any `json:"variables"`
	}{
		Query:     query,
		Variables: vars,
	}

	requestBody, err := json.Marshal(r)
	if err != nil {
		return fmt.Errorf("encode: %w", err)
	}

	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.Client.BaseURL,
		bytes.NewBuffer(requestBody),
	)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	request.Header.Set("Content-Type", "application/json; charset=UTF-8")
	request.Header.Set("Accept", "application/json; charset=UTF-8")

	if err := c.Client.RequestInterceptor(ctx, request, nil, res, c.do); err != nil {
		return err //nolint:wrapcheck
	}

	return nil
}
