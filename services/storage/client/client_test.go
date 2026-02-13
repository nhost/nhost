package client_test

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
)

const testBaseURL = "http://localhost:8000/v1"

const accessTokenValidUser = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjIwNjg0NDA4NTEsImh0dHBzOi8vaGFzdXJhLmlvL2p3dC9jbGFpbXMiOnsieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJhZG1pbiJdLCJ4LWhhc3VyYS1kZWZhdWx0LXJvbGUiOiJhZG1pbiIsIngtaGFzdXJhLXVzZXItaWQiOiJhYjViYTU4ZS05MzJhLTQwZGMtODdlOC03MzM5OTg3OTRlYzIiLCJ4LWhhc3VyYS11c2VyLWlzQW5vbnltb3VzIjoiZmFsc2UifSwiaWF0IjoxNzUzMDgwODUxLCJpc3MiOiJoYXN1cmEtYXV0aCIsInN1YiI6ImFiNWJhNThlLTkzMmEtNDBkYy04N2U4LTczMzk5ODc5NGVjMiJ9.jxx_ve7Ikw1eZrcxYzEuARqkKwiuAhTgCxc2VPvnONY` //nolint:gosec,lll

const eicarTestFile = `X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`

func WithAccessToken(accessToken string) func(ctx context.Context, req *http.Request) error {
	return func(_ context.Context, req *http.Request) error {
		req.Header.Set("Authorization", "Bearer "+accessToken)
		return nil
	}
}

func WithHeaders(headers http.Header) func(ctx context.Context, req *http.Request) error {
	return func(_ context.Context, req *http.Request) error {
		for key, values := range headers {
			for _, value := range values {
				req.Header.Add(key, value)
			}
		}

		return nil
	}
}

func IgnoreResponseHeaders() cmp.Option {
	return cmpopts.IgnoreMapEntries(func(key string, _ []string) bool {
		return key == "Date" || key == "Surrogate-Key" || key == "Last-Modified" ||
			strings.HasPrefix(key, "X-B3-")
	})
}
