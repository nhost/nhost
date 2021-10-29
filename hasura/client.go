package hasura

import (
	"bytes"
	"encoding/json"
	"net/http"

	"github.com/nhost/cli/nhost"
)

type RequestBody struct {
	Type    string      `json:"type"`
	Version uint        `json:"version,omitempty"`
	Args    interface{} `json:"args"`
}

type Client struct {
	Endpoint               string
	AdminSecret            string
	Client                 *http.Client
	CLI                    string
	CommonOptions          []string
	CommonOptionsWithoutDB []string
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

//  Initialize the client with supplied Hasura endpoint,
//  admin secret and a custom HTTP client.
func (c *Client) Init(endpoint, adminSecret string, client *http.Client) error {

	log.Debug("Initializing Hasura client")

	//  Prepare and load required binaries
	cli, err := Binary()
	if err != nil {
		return err
	}

	c.CLI = cli
	c.Endpoint = endpoint
	c.AdminSecret = adminSecret
	c.CommonOptions = []string{
		"--endpoint", c.Endpoint,
		"--admin-secret", c.AdminSecret,
		"--database-name", nhost.DATABASE,
		"--skip-update-check",
	}
	c.CommonOptionsWithoutDB = []string{
		"--endpoint", c.Endpoint,
		"--admin-secret", c.AdminSecret,
		"--skip-update-check",
	}

	if client == nil {
		c.Client = &http.Client{}
	} else {
		c.Client = client
	}

	return nil
}
