/*
Package nhostclient provides functionality to interact with the Nhost API.
*/
package nhostclient

import (
	"fmt"
	"net/http"

	"github.com/Yamashou/gqlgenc/clientv2"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
)

const (
	retryerMaxAttempts = 3
	retryerBaseDelay   = 2
)

type Client struct {
	*graphql.Client

	baseURL string
	client  *http.Client
	retryer BasicRetryer
}

type RequestError struct {
	Status    int    `json:"status"`
	ErrorCode string `json:"error"`
	Message   string `json:"message"`
}

func (e *RequestError) Error() string {
	return fmt.Sprintf("status: %d, error: %s, message: %s", e.Status, e.ErrorCode, e.Message)
}

func New(authURL, graphqlURL string, interceptors ...clientv2.RequestInterceptor) *Client {
	return &Client{
		baseURL: authURL,
		client:  &http.Client{}, //nolint:exhaustruct
		Client: graphql.NewClient(
			&http.Client{}, //nolint:exhaustruct
			graphqlURL,
			&clientv2.Options{}, //nolint:exhaustruct
			interceptors...,
		),
		retryer: NewBasicRetryer(retryerMaxAttempts, retryerBaseDelay),
	}
}
