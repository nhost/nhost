package providers

import (
	"encoding/json"
	"testing"
)

// TestAzureADProfileIgnoresUPNAndPreferredUsername verifies that the Azure AD
// user profile struct no longer deserializes the `upn` or `preferred_username`
// claims. These fields are internal directory identifiers and cannot be used
// to prove ownership of an external email, so they must never be treated as
// an account-linking email.
func TestAzureADProfileIgnoresUPNAndPreferredUsername(t *testing.T) {
	t.Parallel()

	body := `{
		"oid": "00000000-0000-0000-66f3-3332eca7ea81",
		"name": "Jane",
		"email": "",
		"upn": "attacker@tenant.onmicrosoft.com",
		"preferred_username": "ceo@target-company.com"
	}`

	var profile azureUser
	if err := json.Unmarshal([]byte(body), &profile); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	if profile.Email != "" {
		t.Errorf("email should be empty when the claim is empty, got %q", profile.Email)
	}
}

func TestAzureADProfileUsesEmailOnly(t *testing.T) {
	t.Parallel()

	body := `{
		"oid": "00000000-0000-0000-66f3-3332eca7ea81",
		"name": "Jane",
		"email": "jane@contoso.com"
	}`

	var profile azureUser
	if err := json.Unmarshal([]byte(body), &profile); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	if profile.Email != "jane@contoso.com" {
		t.Errorf("email: got %q, want %q", profile.Email, "jane@contoso.com")
	}
}
