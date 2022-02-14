package client

import (
	"net/http"
)

type Client struct {
	baseURL    string
	jwt        string
	httpClient *http.Client
}

func New(baseURL, jwt string) *Client {
	return &Client{
		baseURL:    baseURL,
		jwt:        jwt,
		httpClient: &http.Client{},
	}
}
