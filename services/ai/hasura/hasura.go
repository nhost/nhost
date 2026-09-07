package hasura

import (
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/Yamashou/gqlgenc/clientv2"
)

func WithAdminSecret(adminSecret string) clientv2.RequestInterceptor {
	return func(ctx context.Context,
		req *http.Request,
		gqlInfo *clientv2.GQLRequestInfo,
		res any,
		next clientv2.RequestInterceptorFunc,
	) error {
		req.Header.Add("X-Hasura-Admin-Secret", adminSecret)
		return next(ctx, req, gqlInfo, res)
	}
}

type SQLRequest struct {
	Type string         `json:"type"`
	Args SQLRequestArgs `json:"args"`
}

//nolint:tagliatelle
type SQLRequestArgs struct {
	SQL      string `json:"sql"`
	Source   string `json:"source"`
	ReadOnly bool   `json:"read_only"`
}

type RequestError struct {
	StatusCode int
	Body       []byte
}

func (e *RequestError) Error() string {
	return fmt.Sprintf("request failed with status %d: %s", e.StatusCode, string(e.Body))
}

type GraphqlError struct {
	Errors []Errors `json:"errors"`
}

func (e *GraphqlError) Error() string {
	b, _ := json.Marshal(e) //nolint:errchkjson
	return string(b)
}

type Extensions struct {
	Code string `json:"code"`
	Path string `json:"path"`
}
type Errors struct {
	Extensions Extensions `json:"extensions"`
	Message    string     `json:"message"`
}

func (c *Client) do(
	_ context.Context,
	req *http.Request,
	_ *clientv2.GQLRequestInfo,
	res any,
) error {
	resp, err := c.Client.Client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.Header.Get("Content-Encoding") == "gzip" {
		resp.Body, err = gzip.NewReader(resp.Body)
		if err != nil {
			return fmt.Errorf("gzip decode failed: %w", err)
		}
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return &RequestError{
			StatusCode: resp.StatusCode,
			Body:       body,
		}
	}

	// we see if there are graphql errors
	var gqlErr GraphqlError
	if err := json.Unmarshal(body, &gqlErr); err != nil {
		return fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if len(gqlErr.Errors) > 0 {
		return &gqlErr
	}

	if err := json.Unmarshal(body, res); err != nil {
		return fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return nil
}
