package oidc_test

import (
	"strings"
	"testing"

	"github.com/nhost/nhost/services/auth/go/oidc"
)

func TestValidProviderSlug(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		slug  string
		valid bool
	}{
		{name: "minimum", slug: "ab", valid: true},
		{name: "hyphen and digits", slug: "idp-01", valid: true},
		{name: "maximum", slug: strings.Repeat("a", 40), valid: true},
		{name: "empty", slug: "", valid: false},
		{name: "too short", slug: "a", valid: false},
		{name: "too long", slug: strings.Repeat("a", 41), valid: false},
		{name: "uppercase", slug: "OIDC", valid: false},
		{name: "leading hyphen", slug: "-idp", valid: false},
		{name: "trailing hyphen", slug: "idp-", valid: false},
		{name: "slash", slug: "idp/", valid: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := oidc.ValidProviderSlug(tt.slug); got != tt.valid {
				t.Errorf("ValidProviderSlug() = %t, want %t", got, tt.valid)
			}
		})
	}
}
