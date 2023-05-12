/*
This package provides functionality to interact with the Nhost API.
*/
package nhostclient

import (
	"fmt"
	"net/http"

	"github.com/Yamashou/gqlgenc/clientv2"
	"github.com/nhost/cli/v2/nhostclient/graphql"
)

const (
	retryerMaxAttempts = 3
	retryerBaseDelay   = 2
)

type Client struct {
	baseURL string
	client  *http.Client
	*graphql.Client
	retryer BasicRetryer
}

func New(domain string) *Client {
	return &Client{
		baseURL: fmt.Sprintf("https://%s/v1/auth", domain),
		client:  &http.Client{}, //nolint:exhaustruct
		Client: graphql.NewClient(
			&http.Client{}, //nolint:exhaustruct
			fmt.Sprintf("https://%s/v1/graphql", domain),
			&clientv2.Options{}, //nolint:exhaustruct
		),
		retryer: NewBasicRetryer(retryerMaxAttempts, retryerBaseDelay),
	}
}
