package api_test

import (
	"testing"

	"github.com/nhost/nhost/services/auth/go/api"
)

// TestGenerateTotpRequiresElevatedAuth guards the fix that gates TOTP secret
// generation behind elevated permissions. Generating a secret is the only
// request-reachable way to write auth.users.totp_secret, so a token-only
// attacker who can call it can enable MFA (durable account takeover) or
// overwrite a live secret to defeat the deactivation code check. The endpoint
// must therefore require BearerAuthElevated and must not accept plain
// BearerAuth. The requirement lives in the embedded OpenAPI spec, so this test
// fails loudly if a future regeneration reverts it.
func TestGenerateTotpRequiresElevatedAuth(t *testing.T) {
	t.Parallel()

	swagger, err := api.GetSwagger()
	if err != nil {
		t.Fatalf("failed to load swagger spec: %v", err)
	}

	item := swagger.Paths.Find("/mfa/totp/generate")
	if item == nil || item.Get == nil {
		t.Fatal("GET /mfa/totp/generate not found in spec")
	}

	if item.Get.Security == nil {
		t.Fatal("GET /mfa/totp/generate has no security requirement")
	}

	requiresElevated := false
	for _, requirement := range *item.Get.Security {
		if _, ok := requirement["BearerAuth"]; ok {
			t.Error("GET /mfa/totp/generate must not accept non-elevated BearerAuth")
		}

		if _, ok := requirement["BearerAuthElevated"]; ok {
			requiresElevated = true
		}
	}

	if !requiresElevated {
		t.Error("GET /mfa/totp/generate must require BearerAuthElevated")
	}
}
