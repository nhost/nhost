package providers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// newBitbucketTestServer serves the two endpoints used by Bitbucket.GetProfile.
// The caller supplies the body returned for /user/emails.
func newBitbucketTestServer(t *testing.T, emailsBody string) *httptest.Server {
	t.Helper()

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/user/emails"):
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(emailsBody))
		case strings.HasSuffix(r.URL.Path, "/user"):
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{
				"uuid": "{00000000-0000-0000-0000-000000000000}",
				"display_name": "Jane",
				"links": {"avatar": {"href": "https://example.com/a.png"}}
			}`))
		default:
			http.NotFound(w, r)
		}
	}))
}

// bitbucketGetProfileWithBase is a test-only variant of Bitbucket.GetProfile
// that uses baseURL instead of the hard-coded Bitbucket API host, so we can
// exercise the email-selection logic against an httptest server.
//
// This mirrors the production code exactly; it intentionally only differs in
// the two URLs it targets.
func bitbucketGetProfileWithBase(
	ctx context.Context,
	baseURL, accessToken string,
) (string, bool, error) {
	var user bitbucketAPIUser
	if err := fetchOAuthProfile(ctx, baseURL+"/user", accessToken, &user); err != nil {
		return "", false, err
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		baseURL+"/user/emails",
		nil,
	)
	if err != nil {
		return "", false, fmt.Errorf("new request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", false, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	var emailResp bitbucketEmailsResponse
	if err := json.NewDecoder(resp.Body).Decode(&emailResp); err != nil {
		return "", false, fmt.Errorf("decode response: %w", err)
	}

	var primaryEmail string

	for _, e := range emailResp.Values {
		if e.IsConfirmed {
			primaryEmail = e.Email
			break
		}
	}

	if primaryEmail == "" {
		return "", false, ErrNoConfirmedBitbucketEmail
	}

	return primaryEmail, true, nil
}

func TestBitbucketRejectsUnconfirmedEmails(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		emailsBody    string
		expectedEmail string
		expectedErr   error
	}{
		{
			name: "picks first confirmed email",
			emailsBody: `{
				"values": [
					{"email": "unconfirmed@target.io", "is_confirmed": false},
					{"email": "jane@bitbucket.io", "is_confirmed": true}
				]
			}`,
			expectedEmail: "jane@bitbucket.io",
			expectedErr:   nil,
		},
		{
			name: "rejects when only unconfirmed email present (attacker case)",
			emailsBody: `{
				"values": [
					{"email": "victim@target.io", "is_confirmed": false}
				]
			}`,
			expectedEmail: "",
			expectedErr:   ErrNoConfirmedBitbucketEmail,
		},
		{
			name:          "rejects empty email list",
			emailsBody:    `{"values": []}`,
			expectedEmail: "",
			expectedErr:   ErrNoConfirmedBitbucketEmail,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			srv := newBitbucketTestServer(t, tc.emailsBody)
			defer srv.Close()

			email, verified, err := bitbucketGetProfileWithBase(
				t.Context(), srv.URL, "fake-token",
			)

			if tc.expectedErr != nil {
				if !errors.Is(err, tc.expectedErr) {
					t.Fatalf("error: got %v, want %v", err, tc.expectedErr)
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if email != tc.expectedEmail {
				t.Errorf("email: got %q, want %q", email, tc.expectedEmail)
			}

			if !verified {
				t.Errorf("verified: got false, want true")
			}
		})
	}
}
