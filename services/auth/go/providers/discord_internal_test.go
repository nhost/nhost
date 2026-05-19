package providers

import "testing"

func TestDiscordProfileDecoding(t *testing.T) {
	t.Parallel()

	runProfileDecodingCases(
		t,
		[]profileDecodingCase{
			{
				name: "verified account",
				body: `{
					"id": "80351110224678912",
					"username": "Nelly",
					"discriminator": "1337",
					"email": "nelly@discord.com",
					"verified": true,
					"avatar": "8342729096ea3675442027381ff50dfe"
				}`,
				expectedEmail:    "nelly@discord.com",
				expectedVerified: true,
			},
			{
				name: "unverified account must not be marked verified",
				body: `{
					"id": "80351110224678912",
					"username": "Nelly",
					"discriminator": "1337",
					"email": "victim@target.io",
					"verified": false
				}`,
				expectedEmail:    "victim@target.io",
				expectedVerified: false,
			},
			{
				name: "missing verified field defaults to false (safe)",
				body: `{
					"id": "80351110224678912",
					"username": "Nelly",
					"email": "victim@target.io"
				}`,
				expectedEmail:    "victim@target.io",
				expectedVerified: false,
			},
		},
		func(p discordUserProfile) string { return p.Email },
		func(p discordUserProfile) bool { return p.Verified },
	)
}
