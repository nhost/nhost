package providers

import (
	"encoding/json"
	"testing"
)

// profileDecodingCase describes a JSON → provider-struct decoding assertion
// used by the per-provider verified-email decoding tests. Shared to avoid
// line-for-line duplication across adapters.
type profileDecodingCase struct {
	name             string
	body             string
	expectedEmail    string
	expectedVerified bool
}

// runProfileDecodingCases unmarshals each case's body into a freshly-constructed
// T and asserts the expected email/verified extracted via the supplied
// accessors. Designed for provider adapters where the raw JSON struct carries
// both an email field and an explicit verification flag.
func runProfileDecodingCases[T any](
	t *testing.T,
	tests []profileDecodingCase,
	emailOf func(T) string,
	verifiedOf func(T) bool,
) {
	t.Helper()

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var profile T
			if err := json.Unmarshal([]byte(tc.body), &profile); err != nil {
				t.Fatalf("unmarshal failed: %v", err)
			}

			if got := emailOf(profile); got != tc.expectedEmail {
				t.Errorf("email: got %q, want %q", got, tc.expectedEmail)
			}

			if got := verifiedOf(profile); got != tc.expectedVerified {
				t.Errorf("verified: got %v, want %v", got, tc.expectedVerified)
			}
		})
	}
}
