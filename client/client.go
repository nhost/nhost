package client

import (
	"net/http"
)

type Client struct {
	baseURL    string
	jwt        string
	httpCliebt *http.Client
}

func New(baseURL, jwt string) *Client {
	return &Client{
		baseURL:    baseURL,
		jwt:        jwt,
		httpCliebt: &http.Client{},
	}
}
