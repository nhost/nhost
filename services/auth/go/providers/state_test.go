package providers_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/providers"
)

// TestStateRoundTrip pins Encode and Decode as exact mirrors. They are the
// only writer and the only reader of the state JWT's claim names, and a drift
// between them is silent: Decode unmarshals into the struct, so a missing or
// misspelled claim yields the zero value rather than an error. Nonce is where
// that matters — a nil nonce is not forwarded to GetProfile, and a custom
// OIDC sign-in then fails at profile-fetch time on one flow only.
func TestStateRoundTrip(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		state providers.State
	}{
		{
			name: "all fields populated",
			state: providers.State{
				Connect: new("connect-jwt"),
				Options: &api.SignUpOptions{
					AllowedRoles: &[]string{"user", "me"},
					DefaultRole:  new("user"),
					DisplayName:  new("Jane"),
					Locale:       new("en"),
					Metadata:     &map[string]any{"key": "value"},
					RedirectTo:   new("http://localhost:3000"),
				},
				State:         new("opaque-state"),
				Flow:          providers.FlowSignin,
				CodeChallenge: new("challenge"),
				Nonce:         new("raw-nonce"),
			},
		},
		{
			// The rolling-deploy shape: a state minted by a binary that did
			// not carry a nonce must decode to nil, not error.
			name: "optional fields absent",
			state: providers.State{
				Connect:       nil,
				Options:       nil,
				State:         nil,
				Flow:          providers.FlowSignup,
				CodeChallenge: nil,
				Nonce:         nil,
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var got providers.State
			if err := got.Decode(tc.state.Encode()); err != nil {
				t.Fatalf("unexpected decode error: %v", err)
			}

			if diff := cmp.Diff(tc.state, got); diff != "" {
				t.Errorf("state did not round-trip (-want +got):\n%s", diff)
			}
		})
	}
}

// TestStateDecodeRejectsUnknownFlow keeps the flow claim a closed set: a state
// minted for one flow must not be reinterpretable as the other.
func TestStateDecodeRejectsUnknownFlow(t *testing.T) {
	t.Parallel()

	state := providers.State{
		Connect:       nil,
		Options:       nil,
		State:         nil,
		Flow:          "something-else",
		CodeChallenge: nil,
		Nonce:         nil,
	}

	var got providers.State
	if err := got.Decode(state.Encode()); err == nil {
		t.Fatal("expected an unknown flow to be rejected")
	}
}
