package providers

import "testing"

func TestLinkedInProfileDecoding(t *testing.T) {
	t.Parallel()

	runProfileDecodingCases(
		t,
		[]profileDecodingCase{
			{
				name: "verified email",
				body: `{
					"sub": "123",
					"email": "jane@example.com",
					"email_verified": true,
					"given_name": "Jane",
					"family_name": "Doe"
				}`,
				expectedEmail:    "jane@example.com",
				expectedVerified: true,
			},
			{
				name: "unverified email must not be marked verified",
				body: `{
					"sub": "123",
					"email": "victim@target.io",
					"email_verified": false
				}`,
				expectedEmail:    "victim@target.io",
				expectedVerified: false,
			},
			{
				name: "missing email_verified defaults to false (safe)",
				body: `{
					"sub": "123",
					"email": "victim@target.io"
				}`,
				expectedEmail:    "victim@target.io",
				expectedVerified: false,
			},
		},
		func(p linkedInUserInfoProfile) string { return p.Email },
		func(p linkedInUserInfoProfile) bool { return p.EmailVerified },
	)
}
