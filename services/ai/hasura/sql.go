package hasura

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

//nolint:tagliatelle
type RunSQLResponse struct {
	ResultType string  `json:"result_type"`
	Result     [][]any `json:"result"`
}

func (c *Client) RunSQL(ctx context.Context, query string, readOnly bool) (*RunSQLResponse, error) {
	uri, err := url.Parse(c.Client.BaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse url: %w", err)
	}

	uri = uri.JoinPath("..", "..", "/v2", "query")

	req := &SQLRequest{
		Type: "run_sql",
		Args: SQLRequestArgs{
			SQL:      query,
			Source:   "default",
			ReadOnly: readOnly,
		},
	}

	b, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		uri.String(),
		bytes.NewBuffer(b),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	request.Header.Set("Content-Type", "application/json; charset=UTF-8")

	var t RunSQLResponse
	if err := c.Client.RequestInterceptor(ctx, request, nil, &t, c.do); err != nil {
		return nil, err //nolint:wrapcheck
	}

	return &t, nil
}
