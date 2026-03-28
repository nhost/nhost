package oauth2_test

import (
	"crypto/sha256"
	"encoding/base64"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/oauth2"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func s256Challenge(verifier string) string {
	h := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(h[:])
}

func TestValidatePKCE(t *testing.T) {
	t.Parallel()

	verifier := "test-code-verifier"
	challenge := s256Challenge(verifier)

	cases := []struct {
		name        string
		authReq     sql.AuthOauth2AuthRequest
		verifier    *string
		isPublic    bool
		expectedErr *oauth2.Error
	}{
		{
			name: "success - valid S256 with default method",
			authReq: sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
				CodeChallenge: pgtype.Text{String: challenge, Valid: true},
			},
			verifier:    &verifier,
			isPublic:    false,
			expectedErr: nil,
		},
		{
			name: "success - valid S256 with explicit method",
			authReq: sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
				CodeChallenge:       pgtype.Text{String: challenge, Valid: true},
				CodeChallengeMethod: pgtype.Text{String: "S256", Valid: true},
			},
			verifier:    &verifier,
			isPublic:    false,
			expectedErr: nil,
		},
		{
			name: "success - no challenge for confidential client",
			authReq: sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
				CodeChallenge: pgtype.Text{}, //nolint:exhaustruct
			},
			verifier:    nil,
			isPublic:    false,
			expectedErr: nil,
		},
		{
			name: "success - empty challenge string for confidential client",
			authReq: sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
				CodeChallenge: pgtype.Text{String: "", Valid: true},
			},
			verifier:    nil,
			isPublic:    false,
			expectedErr: nil,
		},
		{
			name: "error - no challenge for public client",
			authReq: sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
				CodeChallenge: pgtype.Text{}, //nolint:exhaustruct
			},
			verifier: nil,
			isPublic: true,
			expectedErr: &oauth2.Error{
				Err:         "invalid_request",
				Description: "PKCE code_challenge is required for public clients",
			},
		},
		{
			name: "error - empty challenge string for public client",
			authReq: sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
				CodeChallenge: pgtype.Text{String: "", Valid: true},
			},
			verifier: nil,
			isPublic: true,
			expectedErr: &oauth2.Error{
				Err:         "invalid_request",
				Description: "PKCE code_challenge is required for public clients",
			},
		},
		{
			name: "error - nil code_verifier",
			authReq: sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
				CodeChallenge: pgtype.Text{String: challenge, Valid: true},
			},
			verifier: nil,
			isPublic: false,
			expectedErr: &oauth2.Error{
				Err:         "invalid_grant",
				Description: "Missing code_verifier",
			},
		},
		{
			name: "error - empty code_verifier",
			authReq: sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
				CodeChallenge: pgtype.Text{String: challenge, Valid: true},
			},
			verifier: new(string),
			isPublic: false,
			expectedErr: &oauth2.Error{
				Err:         "invalid_grant",
				Description: "Missing code_verifier",
			},
		},
		{
			name: "error - unsupported code_challenge_method",
			authReq: sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
				CodeChallenge:       pgtype.Text{String: challenge, Valid: true},
				CodeChallengeMethod: pgtype.Text{String: "plain", Valid: true},
			},
			verifier: &verifier,
			isPublic: false,
			expectedErr: &oauth2.Error{
				Err:         "invalid_request",
				Description: "Unsupported code_challenge_method, only S256 is supported",
			},
		},
		{
			name: "error - wrong code_verifier",
			authReq: sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
				CodeChallenge: pgtype.Text{String: challenge, Valid: true},
			},
			verifier: func() *string { s := "wrong-verifier"; return &s }(),
			isPublic: false,
			expectedErr: &oauth2.Error{
				Err:         "invalid_grant",
				Description: "Invalid code_verifier",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			gotErr := oauth2.ValidatePKCE(tc.authReq, tc.verifier, tc.isPublic)

			if diff := cmp.Diff(tc.expectedErr, gotErr); diff != "" {
				t.Errorf("error mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
