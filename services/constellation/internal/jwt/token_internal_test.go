package jwt

import (
	"net/http"
	"testing"
)

func TestExtractFromAuthorizationHeader(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		headers http.Header
		want    string
	}{
		{
			name:    "bearer token lowercase scheme",
			headers: http.Header{"Authorization": {"bearer abc.def.ghi"}},
			want:    "abc.def.ghi",
		},
		{
			name:    "bearer token mixed case scheme",
			headers: http.Header{"Authorization": {"BeArEr abc.def.ghi"}},
			want:    "abc.def.ghi",
		},
		{
			name:    "bearer token uppercase scheme",
			headers: http.Header{"Authorization": {"Bearer abc.def.ghi"}},
			want:    "abc.def.ghi",
		},
		{
			name:    "missing header",
			headers: http.Header{},
			want:    "",
		},
		{
			name:    "non-bearer scheme",
			headers: http.Header{"Authorization": {"Basic dXNlcjpwYXNz"}},
			want:    "",
		},
		{
			name:    "bearer without token",
			headers: http.Header{"Authorization": {"Bearer "}},
			want:    "",
		},
		{
			name:    "bearer with trailing space token",
			headers: http.Header{"Authorization": {"Bearer  spaced"}},
			want:    " spaced",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := extractFromAuthorizationHeader(tc.headers); got != tc.want {
				t.Errorf("extractFromAuthorizationHeader = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestExtractFromCookie(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		headers http.Header
		cookie  string
		want    string
	}{
		{
			name:    "cookie present",
			headers: http.Header{"Cookie": {"session=tokenval; other=ignored"}},
			cookie:  "session",
			want:    "tokenval",
		},
		{
			name:    "cookie not in header",
			headers: http.Header{"Cookie": {"other=value"}},
			cookie:  "session",
			want:    "",
		},
		{
			name:    "missing cookie header",
			headers: http.Header{},
			cookie:  "session",
			want:    "",
		},
		{
			name:    "malformed cookie header",
			headers: http.Header{"Cookie": {"@@@bad"}},
			cookie:  "session",
			want:    "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := extractFromCookie(tc.headers, tc.cookie); got != tc.want {
				t.Errorf("extractFromCookie = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestExtractFromCustomHeader(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		headers http.Header
		header  string
		want    string
	}{
		{
			name:    "header present",
			headers: http.Header{"X-Token": {"tokenval"}},
			header:  "X-Token",
			want:    "tokenval",
		},
		{
			name:    "header missing",
			headers: http.Header{},
			header:  "X-Token",
			want:    "",
		},
		{
			name:    "case-insensitive lookup",
			headers: http.Header{"X-Token": {"tokenval"}},
			header:  "x-token",
			want:    "tokenval",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := extractFromCustomHeader(tc.headers, tc.header); got != tc.want {
				t.Errorf("extractFromCustomHeader = %q, want %q", got, tc.want)
			}
		})
	}
}
