package oauth1

import "errors"

var (
	ErrHTTPRequestFailed = errors.New("HTTP request failed")
	ErrInvalidResponse   = errors.New("invalid response from server")
)
