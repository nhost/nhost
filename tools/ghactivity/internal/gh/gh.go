// Package gh is a thin wrapper around the `gh` CLI so the rest of the tool
// can issue GraphQL and REST requests without dealing with auth or HTTP.
package gh

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os/exec"
	"strings"
)

// Sentinel errors returned by Client. Wrap with %w when adding call-site context.
var (
	ErrEmptyData     = errors.New("graphql response had no data")
	ErrGraphQL       = errors.New("graphql request returned errors")
	ErrNoLogin       = errors.New("gh api user returned an empty login")
	ErrGhInvocation  = errors.New("invoking gh failed")
	ErrDecodeJSON    = errors.New("decoding gh response failed")
	ErrEncodeRequest = errors.New("encoding graphql request failed")
	ErrMissingScope  = errors.New("gh token is missing a required OAuth scope")
)

// Client invokes the `gh` CLI binary on the user's PATH.
type Client struct {
	Bin string
}

// New returns a client that uses the `gh` binary from PATH.
func New() *Client {
	return &Client{Bin: "gh"}
}

// GraphQL executes a GraphQL query against api.github.com and decodes the
// `data` field of the response into out.
func (c *Client) GraphQL(
	ctx context.Context,
	query string,
	vars map[string]any,
	out any,
) error {
	body, err := json.Marshal(map[string]any{
		"query":     query,
		"variables": vars,
	})
	if err != nil {
		return fmt.Errorf("%w: %w", ErrEncodeRequest, err)
	}

	//nolint:gosec // c.Bin is intentionally configurable (defaults to "gh"); not user input.
	cmd := exec.CommandContext(ctx, c.Bin, "api", "graphql", "--input", "-")
	cmd.Stdin = bytes.NewReader(body)

	var stdout, stderr bytes.Buffer

	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		stderrStr := stderr.String()
		if strings.Contains(stderrStr, "has not been granted the required scopes") {
			return fmt.Errorf("%w: %s", ErrMissingScope, stderrStr)
		}

		return fmt.Errorf("%w: gh api graphql: %w: %s", ErrGhInvocation, err, stderrStr)
	}

	var envelope struct {
		Data   json.RawMessage `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.Unmarshal(stdout.Bytes(), &envelope); err != nil {
		return fmt.Errorf("%w: graphql envelope: %w", ErrDecodeJSON, err)
	}

	if len(envelope.Errors) > 0 {
		msgs := make([]string, 0, len(envelope.Errors))
		for _, e := range envelope.Errors {
			msgs = append(msgs, e.Message)
		}

		return fmt.Errorf("%w: %s", ErrGraphQL, strings.Join(msgs, "; "))
	}

	if len(envelope.Data) == 0 {
		return ErrEmptyData
	}

	if err := json.Unmarshal(envelope.Data, out); err != nil {
		return fmt.Errorf("%w: graphql data: %w", ErrDecodeJSON, err)
	}

	return nil
}

// APIJSON runs `gh api PATH` and decodes the JSON response into out.
func (c *Client) APIJSON(ctx context.Context, path string, out any) error {
	//nolint:gosec // c.Bin and path are operator-controlled, not user-supplied web input.
	cmd := exec.CommandContext(ctx, c.Bin, "api", path)

	var stdout, stderr bytes.Buffer

	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("%w: gh api %s: %w: %s", ErrGhInvocation, path, err, stderr.String())
	}

	if err := json.Unmarshal(stdout.Bytes(), out); err != nil {
		return fmt.Errorf("%w: gh api %s: %w", ErrDecodeJSON, path, err)
	}

	return nil
}

// AuthenticatedLogin returns the login of the user that `gh` is authenticated as.
func (c *Client) AuthenticatedLogin(ctx context.Context) (string, error) {
	var resp struct {
		Login string `json:"login"`
	}
	if err := c.APIJSON(ctx, "user", &resp); err != nil {
		return "", err
	}

	if resp.Login == "" {
		return "", ErrNoLogin
	}

	return resp.Login, nil
}
