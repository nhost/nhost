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

func TestElevationOperationsRequireBearerAuth(t *testing.T) {
	t.Parallel()

	swagger, err := api.GetSwagger()
	if err != nil {
		t.Fatalf("failed to load swagger spec: %v", err)
	}

	paths := []string{
		"/elevate/webauthn",
		"/elevate/webauthn/verify",
		"/elevate/totp",
		"/elevate/otp/email",
		"/elevate/otp/email/verify",
		"/elevate/otp/sms",
		"/elevate/otp/sms/verify",
	}

	for _, path := range paths {
		t.Run(path, func(t *testing.T) {
			t.Parallel()

			item := swagger.Paths.Find(path)
			if item == nil || item.Post == nil {
				t.Fatalf("POST %s not found in spec", path)
			}

			if item.Post.Security == nil {
				t.Fatalf("POST %s has no security requirement", path)
			}

			security := *item.Post.Security
			if len(security) != 1 {
				t.Fatalf("POST %s must have exactly one security requirement: %v", path, security)
			}

			requirement := security[0]

			scopes, ok := requirement["BearerAuth"]
			if !ok || len(requirement) != 1 || len(scopes) != 0 {
				t.Errorf("POST %s security must be exactly BearerAuth: []: %v", path, security)
			}
		})
	}
}
