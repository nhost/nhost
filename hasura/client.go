package hasura

import (
	"bytes"
	"encoding/json"
	"net/http"
)

type RequestBody struct {
	Type    string      `json:"type"`
	Version uint        `json:"version,omitempty"`
	Args    interface{} `json:"args"`
}

type Client struct {
	Endpoint    string
	AdminSecret string
	Client      *http.Client
	CLI         string
}

func (r *RequestBody) Marshal() ([]byte, error) {
	return json.Marshal(r)
}

func (c *Client) Request(body []byte, path string) (*http.Response, error) {

	req, err := http.NewRequest(
		http.MethodPost,
		c.Endpoint+path,
		bytes.NewBuffer(body),
	)
	if err != nil {
		return nil, err
	}

	req.Header.Set("X-Hasura-Admin-Secret", c.AdminSecret)

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	return c.Client.Do(req)
}

// Initialize the client with supplied Hasura endpoint,
// admin secret and a custom HTTP client.
func (c *Client) Init(endpoint, adminSecret string, client *http.Client) error {

	// Prepare and load required binaries
	cli, err := Binary()
	if err != nil {
		return err
	}

	c.CLI = cli
	c.Endpoint = endpoint
	c.AdminSecret = adminSecret

	if client == nil {
		c.Client = &http.Client{}
	} else {
		c.Client = client
	}

	return nil
}
