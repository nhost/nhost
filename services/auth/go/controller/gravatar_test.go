package controller_test

import (
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
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := controller.GravatarURLFunc(tc.enabled, tc.def, tc.rating)(tc.email)
			if got != tc.expected {
				t.Errorf("expected %s, got %s", tc.expected, got)
			}
		})
	}
}
