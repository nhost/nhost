package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/cli/go-gh/v2/pkg/auth"
)

// RESTClient wraps methods for the different types of
// API requests that are supported by the server.
type RESTClient struct {
	client *http.Client
	host   string
}

func DefaultRESTClient() (*RESTClient, error) {
	return NewRESTClient(ClientOptions{})
}

// NewRESTClient builds a client to send requests to GitHub REST API endpoints.
//
// As part of the configuration a hostname, auth token, default set of headers,
// and unix domain socket are resolved from the gh environment configuration.
// These behaviors can be overridden using the opts argument.
func NewRESTClient(opts ClientOptions) (*RESTClient, error) {
	if optionsNeedResolution(opts) {
		var err error
		opts, err = resolveOptions(opts)
		if err != nil {
			return nil, err
		}
	}

	client, err := NewHTTPClient(opts)
	if err != nil {
		return nil, err
	}

	return &RESTClient{
		client: client,
		host:   opts.Host,
	}, nil
}

// RequestWithContext issues a request with type specified by method to the
// specified path with the specified body.
// The response is returned rather than being populated
// into a response argument.
func (c *RESTClient) RequestWithContext(ctx context.Context, method string, path string, body io.Reader) (*http.Response, error) {
	url := restURL(c.host, path)
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, err
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}

	success := resp.StatusCode >= 200 && resp.StatusCode < 300
	if !success {
		defer resp.Body.Close()
		return nil, HandleHTTPError(resp)
	}

	return resp, err
}

// Request wraps RequestWithContext with context.Background.
func (c *RESTClient) Request(method string, path string, body io.Reader) (*http.Response, error) {
	return c.RequestWithContext(context.Background(), method, path, body)
}

// DoWithContext issues a request with type specified by method to the
// specified path with the specified body.
// The response is populated into the response argument.
func (c *RESTClient) DoWithContext(ctx context.Context, method string, path string, body io.Reader, response interface{}) error {
	url := restURL(c.host, path)
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return err
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}

	success := resp.StatusCode >= 200 && resp.StatusCode < 300
	if !success {
		defer resp.Body.Close()
		return HandleHTTPError(resp)
	}

	if resp.StatusCode == http.StatusNoContent {
		return nil
	}

	if resp.StatusCode == http.StatusResetContent {
		return nil
	}

	defer resp.Body.Close()

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	err = json.Unmarshal(b, &response)
	if err != nil {
		return err
	}

	return nil
}

// Do wraps DoWithContext with context.Background.
func (c *RESTClient) Do(method string, path string, body io.Reader, response interface{}) error {
	return c.DoWithContext(context.Background(), method, path, body, response)
}

// Delete issues a DELETE request to the specified path.
// The response is populated into the response argument.
func (c *RESTClient) Delete(path string, resp interface{}) error {
	return c.Do(http.MethodDelete, path, nil, resp)
}

// Get issues a GET request to the specified path.
// The response is populated into the response argument.
func (c *RESTClient) Get(path string, resp interface{}) error {
	return c.Do(http.MethodGet, path, nil, resp)
}

// Patch issues a PATCH request to the specified path with the specified body.
// The response is populated into the response argument.
func (c *RESTClient) Patch(path string, body io.Reader, resp interface{}) error {
	return c.Do(http.MethodPatch, path, body, resp)
}

// Post issues a POST request to the specified path with the specified body.
// The response is populated into the response argument.
func (c *RESTClient) Post(path string, body io.Reader, resp interface{}) error {
	return c.Do(http.MethodPost, path, body, resp)
}

// Put issues a PUT request to the specified path with the specified body.
// The response is populated into the response argument.
func (c *RESTClient) Put(path string, body io.Reader, resp interface{}) error {
	return c.Do(http.MethodPut, path, body, resp)
}

func restURL(hostname string, pathOrURL string) string {
	if strings.HasPrefix(pathOrURL, "https://") || strings.HasPrefix(pathOrURL, "http://") {
		return pathOrURL
	}
	return restPrefix(hostname) + pathOrURL
}

func restPrefix(hostname string) string {
	if isGarage(hostname) {
		return fmt.Sprintf("https://%s/api/v3/", hostname)
	}
	hostname = auth.NormalizeHostname(hostname)
	if auth.IsEnterprise(hostname) {
		return fmt.Sprintf("https://%s/api/v3/", hostname)
	}
	if strings.EqualFold(hostname, localhost) {
		return fmt.Sprintf("http://api.%s/", hostname)
	}
	return fmt.Sprintf("https://api.%s/", hostname)
}
