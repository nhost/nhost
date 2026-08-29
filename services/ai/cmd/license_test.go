package cmd_test

import (
	"errors"
	"testing"

	"github.com/golang-jwt/jwt/v5"
	"github.com/nhost/nhost/services/ai/cmd"
)

const (
	testLicensePublicKey = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEANsad780GEMqsf51JRTSp5SQgxZXjIajE64RGNy2Fl8Y=
-----END PUBLIC KEY-----`
)

func TestVerifyLicense(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		license string
		err     error
	}{
		{
			name: "incorrect software",

			license: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJmYWtlIiwiZXhwIjoxNzAzOTUwMDQ3LCJodHRwczovL25ob3N0LmlvL2p3dC9jbGFpbXMvbGljZW5zZSI6eyJjcmVhdGVkX2J5IjoiMTExMS0xMTExIn0sImlhdCI6MTcwMzM0NTI0NywiaXNzIjoiaHR0cHM6Ly9uaG9zdC5pbyIsInN1YiI6InF3ZXF3ZS5ncmFwaGl0ZS5ldS1jZW50cmFsLTEubmhvc3QucnVuIn0.9RLq2xtCB4Pu29ThVBiS__7xCHAEaAfC0uTg05oo8FLsSuaPj0gb8hVEamP3eI6GI6tdT2-euuv_8cmezcLKCA",
			err:     jwt.ErrTokenInvalidAudience,
		},
		{
			name: "iat is in the future",

			license: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJHUkFQSElURSIsImV4cCI6MjE3Njk5MDEwMywiaHR0cHM6Ly9uaG9zdC5pby9qd3QvY2xhaW1zL2xpY2Vuc2UiOnsiY3JlYXRlZF9ieSI6IjExMTEtMTExMSJ9LCJpYXQiOjIxNzYzODUzMDMsImlzcyI6Imh0dHBzOi8vbmhvc3QuaW8iLCJzdWIiOiJxd2Vxd2UuZ3JhcGhpdGUuZXUtY2VudHJhbC0xLm5ob3N0LnJ1biJ9.wx_1GrihYNPXh3Wq9v8SWu8rVPbLZOaKShJA5NaW0pckLNecsJTwQ8T3jqh7EHQMzHKAc-DNVIUP1C9iAMwUDQ",
			err:     jwt.ErrTokenUsedBeforeIssued,
		},
		{
			name: "exp is missing",

			license: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJHUkFQSElURSIsImh0dHBzOi8vbmhvc3QuaW8vand0L2NsYWltcy9saWNlbnNlIjp7ImNyZWF0ZWRfYnkiOiIxMTExLTExMTEifSwiaWF0IjoxMjMwMzA1MzQxLCJpc3MiOiJodHRwczovL25ob3N0LmlvIiwic3ViIjoicXdlcXdlLmdyYXBoaXRlLmV1LWNlbnRyYWwtMS5uaG9zdC5ydW4ifQ.kCd7Pf5C1B1MadezoW5-2z_RkLdiOVkwpvpUyG2cyL91RJQvHfan-Wssk4h2vZ6H23yU9hb1cx6I-pCcEGqSCQ",
			err:     jwt.ErrTokenRequiredClaimMissing,
		},
		{
			name: "exp is in the past",

			license: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJHUkFQSElURSIsImV4cCI6MTIzMDkxMDEyMCwiaHR0cHM6Ly9uaG9zdC5pby9qd3QvY2xhaW1zL2xpY2Vuc2UiOnsiY3JlYXRlZF9ieSI6IjExMTEtMTExMSJ9LCJpYXQiOjEyMzAzMDUzMjAsImlzcyI6Imh0dHBzOi8vbmhvc3QuaW8iLCJzdWIiOiJxd2Vxd2UuZ3JhcGhpdGUuZXUtY2VudHJhbC0xLm5ob3N0LnJ1biJ9.jKs2O0c_BXsoD3pzeT-gskWe_CzdilNVfxmD2jJbACuKJ66M9sLIiQSI4hZ3zZhgvqIPXHlVBSmJ9L_DUu75BQ",
			err:     jwt.ErrTokenExpired,
		},
		{
			name: "wrong issuer",

			license: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJHUkFQSElURSIsImV4cCI6MTcwMzk1MDE3NSwiaHR0cHM6Ly9uaG9zdC5pby9qd3QvY2xhaW1zL2xpY2Vuc2UiOnsiY3JlYXRlZF9ieSI6IjExMTEtMTExMSJ9LCJpYXQiOjE3MDMzNDUzNzUsImlzcyI6Imh0dHBzOi8vZmFrZS5pbyIsInN1YiI6InF3ZXF3ZS5ncmFwaGl0ZS5ldS1jZW50cmFsLTEubmhvc3QucnVuIn0.o839n6WAKi2d5N9zpNZojgx02Ay2yQ3rLzmzmFliZHItShFx00uRKNQ_1s4_Z5qwuRZFtOQMkTj5InOe9B2SCQ",
			err:     jwt.ErrTokenInvalidIssuer,
		},
		{
			name: "wrong key",

			license: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJHUkFQSElURSIsImV4cCI6MTcwMzk1MDAxNSwiaHR0cHM6Ly9uaG9zdC5pby9qd3QvY2xhaW1zL2xpY2Vuc2UiOnsiY3JlYXRlZF9ieSI6IjExMTEtMTExMSJ9LCJpYXQiOjE3MDMzNDUyMTUsImlzcyI6Imh0dHBzOi8vbmhvc3QuaW8iLCJzdWIiOiJxd2Vxd2UuZ3JhcGhpdGUuZXUtY2VudHJhbC0xLm5ob3N0LnJ1biJ9.RZqvNbcLYMTf1BgsUtccKX2LI3vyw1iNMYQ34rOglWT-xjP_PYTnin2YIJx6nizg-7LOpIq7wCEyQnUeMtRtBw",
			err:     jwt.ErrTokenSignatureInvalid,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			err := cmd.VerifyLicense([]byte(testLicensePublicKey), tc.license)
			if !errors.Is(err, tc.err) {
				t.Errorf("expected error %v, got %v", tc.err, err)
			}
		})
	}
}
