package controller_test

import (
	"net/url"
	"testing"

	"github.com/nhost/hasura-auth/go/controller"
)

func TestGravatarTest(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		enabled  bool
		email    string
		def      string
		rating   string
		expected string
	}{
		{
			name:     "enabled",
			enabled:  true,
			email:    "test@example.com",
			def:      "retro",
			rating:   "g",
			expected: "https://www.gravatar.com/avatar/55502f40dc8b7c769880b10874abc9d0?d=retro&r=g",
		},
		{
			name:     "disabled",
			enabled:  false,
			email:    "test@example.com",
			def:      "retro",
			rating:   "g",
			expected: "",
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			tc := tc

			got := controller.GravatarURLFunc(tc.enabled, tc.def, tc.rating)(tc.email)
			if got != tc.expected {
				t.Errorf("expected %s, got %s", tc.expected, got)
			}
		})
	}
}

func TestGenLink(t *testing.T) {
	t.Parallel()

	urlWithPath, err := url.Parse("http://serverURL.com/v1")
	if err != nil {
		t.Fatalf("problem creating initial url: %s", err)
	}

	cases := []struct {
		name       string
		serverURL  url.URL
		typ        controller.LinkType
		ticket     string
		redirectTo string
		expected   string
	}{
		{
			name:       "with redirectTo",
			serverURL:  *urlWithPath,
			typ:        controller.LinkTypeEmailVerify,
			ticket:     "1234324324",
			redirectTo: "http://asdasdasd.com/as2q3asd?a=123&b=asdqwe",
			expected:   "http://serverURL.com/v1/verify?redirectTo=http%3A%2F%2Fasdasdasd.com%2Fas2q3asd%3Fa%3D123%26b%3Dasdqwe&ticket=1234324324&type=emailVerify", //nolint:lll
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			tc := tc

			got, err := controller.GenLink(tc.serverURL, tc.typ, tc.ticket, tc.redirectTo)
			if err != nil {
				t.Fatalf("got unexpected error: %s", err)
			}

			if got != tc.expected {
				t.Errorf("expected %s, got %s", tc.expected, got)
			}
		})
	}
}
