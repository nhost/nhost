package providers

import "testing"

func TestEntraIDProfileDecoding(t *testing.T) {
	t.Parallel()

	runProfileDecodingCases(
		t,
		[]profileDecodingCase{
			{
				name: "verified email",
				body: `{
					"sub": "00000000-0000-0000-66f3-3332eca7ea81",
					"givenname": "Jane",
					"familyname": "Doe",
					"email": "jane@contoso.com",
					"email_verified": true
				}`,
				expectedEmail:    "jane@contoso.com",
				expectedVerified: true,
			},
			{
				name: "email present but not verified must be rejected",
				body: `{
					"sub": "00000000-0000-0000-66f3-3332eca7ea81",
					"email": "victim@target.io",
					"email_verified": false
				}`,
				expectedEmail:    "victim@target.io",
				expectedVerified: false,
			},
			{
				name: "missing email_verified defaults to false (safe)",
				body: `{
					"sub": "00000000-0000-0000-66f3-3332eca7ea81",
					"email": "victim@target.io"
				}`,
				expectedEmail:    "victim@target.io",
				expectedVerified: false,
			},
		},
		func(p entraidUser) string { return p.Email },
		func(p entraidUser) bool { return p.EmailVerified },
	)
}
