package client

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"golang.org/x/net/context"
)

func (c *Client) DeleteFile(
	ctx context.Context,
	fileID string,
) error {
	req, err := http.NewRequestWithContext(ctx, "DELETE", c.baseURL+"/files/"+fileID, nil)
	if err != nil {
		return fmt.Errorf("problem creating request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.jwt)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("problem executing request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		b, err := io.ReadAll(resp.Body)
		if err != nil {
			return fmt.Errorf("api reported an error occurred but couldn't read response: %w", err)
		}
		resp := &APIResponseError{
			StatusCode: resp.StatusCode,
		}
		if err := json.Unmarshal(b, resp); err != nil {
			return fmt.Errorf("api reported an error occurred but couldn't unmarshal response: %w", err)
		}
		return resp
	}

	return nil
}
