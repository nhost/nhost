package controller_test

import (
	"net/url"
	"testing"

	"github.com/nhost/hasura-auth/go/controller"
)

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
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

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
