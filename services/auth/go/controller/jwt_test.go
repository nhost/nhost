package controller_test

import (
	"context"
	"crypto"
	"errors"
	"log/slog"
	"maps"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/nhost/nhost/internal/lib/oapi"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/nhost/nhost/services/auth/go/tokenpurpose"
	"go.uber.org/mock/gomock"
)

//nolint:gochecknoglobals
var (
	jwtSecret = []byte(
		`{"type":"HS256", "key":"5152fa850c02dc222631cca898ed1485821a70912a6e3649c49076912daa3b62182ba013315915d64f40cddfbb8b58eb5bd11ba225336a6af45bbae07ca873f3"}`,
	)
	jwtSecretWithIssuer = []byte(
		`{"type":"HS256", "key":"5152fa850c02dc222631cca898ed1485821a70912a6e3649c49076912daa3b62182ba013315915d64f40cddfbb8b58eb5bd11ba225336a6af45bbae07ca873f3","issuer":"some-issuer"}`,
	)
	jwtSecretWithClaimsNamespace = []byte(
		`{"type":"HS256", "key":"5152fa850c02dc222631cca898ed1485821a70912a6e3649c49076912daa3b62182ba013315915d64f40cddfbb8b58eb5bd11ba225336a6af45bbae07ca873f3","claims_namespace":"some/namespace"}`,
	)
)

//nolint:maintidx // Broad pre-existing golden matrix also checks the two new session identifiers.
func TestGetJWTFunc(t *testing.T) {
	t.Parallel()

	userID := uuid.MustParse("585e21fc-3664-4d03-8539-69945342a4f4")

	cases := []struct {
		name          string
		key           []byte
		userID        uuid.UUID
		allowedRoles  []string
		defaultRole   string
		expiresIn     time.Duration
		expectedToken *jwt.Token
		customClaimer func(ctrl *gomock.Controller) *mock.MockCustomClaimer
	}{
		{
			name:         "with valid key",
			key:          jwtSecret,
			userID:       userID,
			allowedRoles: []string{"admin", "user", "project_manager", "anonymous"},
			defaultRole:  "user",
			expiresIn:    time.Hour,
			expectedToken: &jwt.Token{
				Raw:    "ignored",
				Method: &jwt.SigningMethodHMAC{Name: "HS256", Hash: crypto.SHA256},
				Header: map[string]any{"alg": string("HS256"), "typ": string("nhost-session+jwt")},
				Claims: jwt.MapClaims{
					"exp": float64(1.708103735e+09),
					"https://hasura.io/jwt/claims": map[string]any{
						"x-hasura-allowed-roles": []any{
							string("admin"),
							string("user"),
							string("project_manager"),
							string("anonymous"),
						},
						"x-hasura-default-role": string("user"),
						"x-hasura-user-id": string(
							"585e21fc-3664-4d03-8539-69945342a4f4",
						),
						"x-hasura-user-is-anonymous": string("false"),
					},
					"iat": float64(1.708100135e+09),
					"iss": string("hasura-auth"),
					"sub": string("585e21fc-3664-4d03-8539-69945342a4f4"),
					"sid": "ced6ca27-20ba-4149-af39-44a2c242e009",
				},
				Signature: []uint8{},
				Valid:     true,
			},
			customClaimer: nil,
		},

		{
			name:         "with valid key with issuer",
			key:          jwtSecretWithIssuer,
			userID:       userID,
			allowedRoles: []string{"admin", "user", "project_manager", "anonymous"},
			defaultRole:  "user",
			expiresIn:    time.Hour,
			expectedToken: &jwt.Token{
				Raw:    "ignored",
				Method: &jwt.SigningMethodHMAC{Name: "HS256", Hash: crypto.SHA256},
				Header: map[string]any{"alg": string("HS256"), "typ": string("nhost-session+jwt")},
				Claims: jwt.MapClaims{
					"exp": float64(1.708103735e+09),
					"https://hasura.io/jwt/claims": map[string]any{
						"x-hasura-allowed-roles": []any{
							string("admin"),
							string("user"),
							string("project_manager"),
							string("anonymous"),
						},
						"x-hasura-default-role": string("user"),
						"x-hasura-user-id": string(
							"585e21fc-3664-4d03-8539-69945342a4f4",
						),
						"x-hasura-user-is-anonymous": string("false"),
					},
					"iat": float64(1.708100135e+09),
					"iss": string("some-issuer"),
					"sub": string("585e21fc-3664-4d03-8539-69945342a4f4"),
					"sid": "ced6ca27-20ba-4149-af39-44a2c242e009",
				},
				Signature: []uint8{},
				Valid:     true,
			},
			customClaimer: nil,
		},

		{
			name:         "with valid key with claims namespace",
			key:          jwtSecretWithClaimsNamespace,
			userID:       userID,
			allowedRoles: []string{"admin", "user", "project_manager", "anonymous"},
			defaultRole:  "user",
			expiresIn:    time.Hour,
			expectedToken: &jwt.Token{
				Raw:    "ignored",
				Method: &jwt.SigningMethodHMAC{Name: "HS256", Hash: crypto.SHA256},
				Header: map[string]any{"alg": string("HS256"), "typ": string("nhost-session+jwt")},
				Claims: jwt.MapClaims{
					"exp": float64(1.708103735e+09),
					"some/namespace": map[string]any{
						"x-hasura-allowed-roles": []any{
							string("admin"),
							string("user"),
							string("project_manager"),
							string("anonymous"),
						},
						"x-hasura-default-role": string("user"),
						"x-hasura-user-id": string(
							"585e21fc-3664-4d03-8539-69945342a4f4",
						),
						"x-hasura-user-is-anonymous": string("false"),
					},
					"iat": float64(1.708100135e+09),
					"iss": string("hasura-auth"),
					"sub": string("585e21fc-3664-4d03-8539-69945342a4f4"),
					"sid": "ced6ca27-20ba-4149-af39-44a2c242e009",
				},
				Signature: []uint8{},
				Valid:     true,
			},
			customClaimer: nil,
		},

		{
			name:         "with custom claims",
			key:          jwtSecret,
			userID:       userID,
			allowedRoles: []string{"admin", "user", "project_manager", "anonymous"},
			defaultRole:  "user",
			expiresIn:    time.Hour,
			expectedToken: &jwt.Token{
				Raw:    "ignored",
				Method: &jwt.SigningMethodHMAC{Name: "HS256", Hash: crypto.SHA256},
				Header: map[string]any{"alg": string("HS256"), "typ": string("nhost-session+jwt")},
				Claims: jwt.MapClaims{
					"exp": 1.708103735e+09,
					"https://hasura.io/jwt/claims": map[string]any{
						"x-hasura-allowed-roles": []any{
							"admin",
							"user",
							"project_manager",
							"anonymous",
						},
						"x-hasura-default-role":      "user",
						"x-hasura-float":             "123.456",
						"x-hasura-user-id":           "585e21fc-3664-4d03-8539-69945342a4f4",
						"x-hasura-user-is-anonymous": "false",
						"x-hasura-custom-claim":      "custom-claim-value",
						"x-hasura-custom-claim-2":    "custom-claim-value-2",
						"x-hasura-map":               `{"k1":"v1","k2":"v2"}`,
						"x-hasura-number":            "123",
						"x-hasura-null":              "null",
						"x-hasura-slice":             `{"a","b","c"}`,
						"x-hasura-sliceempty":        "{}",
						"x-hasura-sliceofone":        `{"a"}`,
					},
					"iat": 1.708100135e+09,
					"iss": "hasura-auth",
					"sub": "585e21fc-3664-4d03-8539-69945342a4f4",
					"sid": "ced6ca27-20ba-4149-af39-44a2c242e009",
				},
				Signature: []uint8{},
				Valid:     true,
			},
			customClaimer: func(ctrl *gomock.Controller) *mock.MockCustomClaimer {
				mockCustomClaimer := mock.NewMockCustomClaimer(ctrl)
				mockCustomClaimer.EXPECT().GetClaims(
					gomock.Any(),
					"585e21fc-3664-4d03-8539-69945342a4f4",
				).Return(
					map[string]any{
						"custom-claim":   "custom-claim-value",
						"custom-claim-2": "custom-claim-value-2",
						"user-id":        "custom-claims-that-shadow-default-claims-are-ignored",
						"float":          123.456,
						"map": map[string]any{
							"k1": "v1",
							"k2": "v2",
						},
						"number":     123,
						"null":       nil,
						"slice":      []any{"a", "b", "c"},
						"sliceEmpty": []any{},
						"sliceOfOne": []any{"a"},
					}, nil,
				)

				return mockCustomClaimer
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			var customClaimer controller.CustomClaimer
			if tc.customClaimer != nil {
				customClaimer = tc.customClaimer(ctrl)
			}

			jwtGetter, err := controller.NewJWTGetter(
				tc.key,
				tc.expiresIn,
				customClaimer,
				controller.ElevationConfig{},
				nil,
				"hasura-auth",
				"",
			)
			if err != nil {
				t.Fatalf("GetJWTFunc() err = %v; want nil", err)
			}

			accessToken, _, err := jwtGetter.GetToken(
				t.Context(),
				tc.userID,
				uuid.MustParse("ced6ca27-20ba-4149-af39-44a2c242e009"),
				false,
				tc.allowedRoles,
				tc.defaultRole,
				nil,
				slog.Default(),
			)
			if err != nil {
				t.Fatalf("fn() err = %v; want nil", err)
			}

			decodedToken, err := jwtGetter.Validate(accessToken, tokenpurpose.Session)
			if err != nil {
				t.Fatalf("fn() err = %v; want nil", err)
			}

			claims, ok := decodedToken.Claims.(jwt.MapClaims)
			if !ok {
				t.Fatal("session claims are not MapClaims")
			}

			jti, ok := claims["jti"].(string)
			if !ok {
				t.Fatal("jti is not a string")
			}

			id, err := uuid.Parse(jti)
			if err != nil || id.Version() != 4 {
				t.Errorf("jti is not a UUID v4: %v", err)
			}

			delete(claims, "jti")

			cmpopts := []cmp.Option{
				cmpopts.IgnoreFields(jwt.Token{}, "Raw", "Signature"),
				cmpopts.IgnoreMapEntries(func(key string, _ any) bool {
					return key == "iat" || key == "exp"
				}),
			}
			if diff := cmp.Diff(decodedToken, tc.expectedToken, cmpopts...); diff != "" {
				t.Errorf("decodedToken mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func signTestToken(
	t *testing.T,
	jwtGetter *controller.JWTGetter,
	userID uuid.UUID,
	purpose tokenpurpose.Purpose,
	extraClaims map[string]any,
) string {
	t.Helper()

	claims := jwt.MapClaims{
		"sub": userID.String(),
		"https://hasura.io/jwt/claims": map[string]any{
			"x-hasura-allowed-roles":     []string{"me", "user", "editor"},
			"x-hasura-default-role":      "user",
			"x-hasura-user-id":           userID.String(),
			"x-hasura-user-is-anonymous": "false",
		},
	}

	maps.Copy(claims, extraClaims)

	token, err := jwtGetter.SignTokenWithClaims(claims, time.Now().Add(24*time.Hour), purpose)
	if err != nil {
		t.Fatalf("failed to sign test token: %v", err)
	}

	return token
}

func assertProviderStateRedirectAudience(
	t *testing.T, location string, getter *controller.JWTGetter, expected string,
) {
	t.Helper()

	redirect, err := url.Parse(location)
	if err != nil {
		t.Fatalf("parsing provider redirect: %v", err)
	}

	state := redirect.Query().Get("state")
	if state == "" {
		t.Fatal("provider redirect has no state")
	}

	token, err := getter.Validate(state, tokenpurpose.ProviderState)
	if err != nil {
		t.Fatalf("validating provider state: %v", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		t.Fatal("provider state claims are not MapClaims")
	}

	got, present := claims["aud"]
	if present != (expected != "") || present && got != expected {
		t.Errorf("state aud = %v, present = %t; want %q", got, present, expected)
	}
}

func TestProviderStateAudienceValidation(t *testing.T) {
	t.Parallel()

	const callbackAudience = "https://local.nhost.run/auth/provider-callback"

	cases := []struct {
		name      string
		audience  string
		claim     any
		include   bool
		wantValid bool
		clientID  string
	}{
		{"correct", "https://local.nhost.run/", callbackAudience, true, true, ""},
		{
			"array containing callback",
			"https://local.nhost.run",
			[]string{"other", callbackAudience},
			true,
			true,
			"",
		},
		{"missing during transition", "https://local.nhost.run", nil, false, true, ""},
		{
			"wrong callback",
			"https://local.nhost.run",
			"https://other.example/auth/provider-callback",
			true,
			false,
			"",
		},
		{
			"project audience is not callback audience",
			"https://local.nhost.run",
			"https://local.nhost.run",
			true,
			false,
			"",
		},
		{
			"own client ID is not exempt",
			"https://local.nhost.run",
			"some-client",
			true,
			false,
			"some-client",
		},
		{"null", "https://local.nhost.run", nil, true, false, ""},
		{"number", "https://local.nhost.run", 42, true, false, ""},
		{
			"non-string array",
			"https://local.nhost.run",
			[]any{callbackAudience, 42},
			true,
			false,
			"",
		},
		{"unset skips audience check", "", "https://other.example", true, true, ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			// The legacy signer does not add an audience; a configured validator
			// must still distinguish missing from malformed claims.
			signer := newAudienceGetter(t, "")

			claims := jwt.MapClaims{"flow": "signin"}
			if tc.include {
				claims["aud"] = tc.claim
			}

			if tc.clientID != "" {
				claims["client_id"] = tc.clientID
			}

			signed, err := signer.SignTokenWithClaims(
				claims, time.Now().Add(time.Minute), tokenpurpose.ProviderState,
			)
			if err != nil {
				t.Fatal(err)
			}

			validator := newAudienceGetter(t, tc.audience)

			_, err = validator.Validate(signed, tokenpurpose.ProviderState)
			if (err == nil) != tc.wantValid {
				t.Errorf("Validate() error = %v; want valid = %t", err, tc.wantValid)
			}
		})
	}
}

func TestLegacyProviderStateValidation(t *testing.T) {
	t.Parallel()

	userID := uuid.New()

	cases := []struct {
		name      string
		claims    jwt.MapClaims
		wantValid bool
	}{
		{
			name:      "legacy provider state",
			claims:    jwt.MapClaims{"flow": "signin", "options": map[string]any{}},
			wantValid: true,
		},
		{
			name:      "legacy-typed token without options",
			claims:    jwt.MapClaims{"flow": "signin"},
			wantValid: false,
		},
		{
			name: "legacy-typed token with an audience",
			claims: jwt.MapClaims{
				"flow": "signin", "options": map[string]any{}, "aud": "some-client",
			},
			wantValid: false,
		},
		{
			name: "legacy session token",
			claims: jwt.MapClaims{
				"sub": userID.String(),
				"https://hasura.io/jwt/claims": map[string]any{
					"x-hasura-user-id": userID.String(),
				},
			},
			wantValid: false,
		},
		{
			name: "legacy OAuth2 access token",
			claims: jwt.MapClaims{
				"sub": userID.String(), "aud": "some-client", "scope": "openid",
			},
			wantValid: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			getter := newAudienceGetter(t, "https://local.nhost.run")

			// State signed before provider state had its own type used the
			// default "JWT" type, the one OIDC ID tokens still carry.
			signed, err := getter.SignTokenWithClaims(
				tc.claims, time.Now().Add(time.Minute), tokenpurpose.OIDCIDToken,
			)
			if err != nil {
				t.Fatal(err)
			}

			_, err = getter.Validate(signed, tokenpurpose.ProviderState)
			if (err == nil) != tc.wantValid {
				t.Errorf("Validate() error = %v; want valid = %t", err, tc.wantValid)
			}
		})
	}
}

func TestMiddlewareFunc(t *testing.T) { //nolint:maintidx
	t.Parallel()

	userID := uuid.MustParse("f90782de-f0a3-41fe-b778-01e4f80c2413")

	signingGetter, err := controller.NewJWTGetter(
		jwtSecret, time.Hour, nil, controller.ElevationConfig{}, nil, "hasura-auth", "",
	)
	if err != nil {
		t.Fatalf("failed to create signing jwt getter: %v", err)
	}

	nonElevatedToken := signTestToken(t, signingGetter, userID, tokenpurpose.Session, nil)

	subjectlessToken, err := signingGetter.SignTokenWithClaims(
		jwt.MapClaims{},
		time.Now().Add(time.Minute),
		tokenpurpose.Session,
	)
	if err != nil {
		t.Fatalf("failed to sign subjectless token: %v", err)
	}

	elevatedToken := signTestToken(t, signingGetter, userID, tokenpurpose.Session, map[string]any{
		"https://hasura.io/jwt/claims": map[string]any{
			"x-hasura-allowed-roles":     []string{"me", "user", "editor"},
			"x-hasura-auth-elevated":     userID.String(),
			"x-hasura-default-role":      "user",
			"x-hasura-user-id":           userID.String(),
			"x-hasura-user-is-anonymous": "false",
		},
	})
	// An access token for a client granted the "graphql" scope also carries
	// the Hasura claims, which signTestToken adds to every token.
	oauth2AccessToken := signTestToken(
		t, signingGetter, userID, tokenpurpose.OAuth2AccessToken,
		map[string]any{"aud": "some-client", "scope": "openid graphql"},
	)
	oidcIDToken := signTestToken(
		t, signingGetter, userID, tokenpurpose.OIDCIDToken,
		map[string]any{"aud": "some-client"},
	)
	providerStateToken := signTestToken(
		t, signingGetter, userID, tokenpurpose.ProviderState, nil,
	)
	// Sessions signed before session tokens had their own type used the
	// default "JWT" type, the one OIDC ID tokens still carry.
	legacySessionToken := signTestToken(
		t, signingGetter, userID, tokenpurpose.OIDCIDToken, nil,
	)
	legacyOAuth2AccessToken := signTestToken(
		t, signingGetter, userID, tokenpurpose.OIDCIDToken,
		map[string]any{"aud": "some-client", "scope": "openid graphql"},
	)
	legacyTypeWithoutHasuraClaims := signTestToken(
		t, signingGetter, userID, tokenpurpose.OIDCIDToken,
		map[string]any{"https://hasura.io/jwt/claims": nil},
	)

	rejected := func(scheme string) error {
		return &oapi.AuthenticatorError{
			Scheme:  scheme,
			Code:    "unauthorized",
			Message: "invalid or expired token",
		}
	}

	cases := []struct {
		name       string
		elevation  controller.ElevationConfig
		db         func(ctrl *gomock.Controller) *mock.MockDBClient
		token      string
		scheme     string
		requestURL *url.URL
		routePath  string
		expectErr  error
	}{
		{
			name: "BearerAuth: elevated disabled",
			elevation: controller.ElevationConfig{
				Mode: "disabled", TOTPEnabled: true, WebauthnEnabled: true,
			},
			db:         mock.NewMockDBClient,
			token:      nonElevatedToken,
			scheme:     "BearerAuth",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name: "BearerAuth: elevated recommended, no security keys, claim not present",
			elevation: controller.ElevationConfig{
				Mode: "recommended", TOTPEnabled: true, WebauthnEnabled: true,
			},
			db:         mock.NewMockDBClient,
			token:      nonElevatedToken,
			scheme:     "BearerAuth",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name: "BearerAuth: elevated required, no security keys, claim not present",
			elevation: controller.ElevationConfig{
				Mode: "required", TOTPEnabled: true, WebauthnEnabled: true,
			},
			db:         mock.NewMockDBClient,
			token:      nonElevatedToken,
			scheme:     "BearerAuth",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name: "BearerAuthElevated: elevated recommended, token without a subject",
			elevation: controller.ElevationConfig{
				Mode: "recommended", TOTPEnabled: true, WebauthnEnabled: true,
			},
			// Even a correctly typed session token must have a subject to
			// satisfy elevated authentication.
			db:         mock.NewMockDBClient,
			token:      subjectlessToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr: &oapi.AuthenticatorError{
				Scheme:  "BearerAuthElevated",
				Code:    "unauthorized",
				Message: "error verifying elevated claim",
			},
		},

		{
			name: "BearerAuthElevated: elevated required, token without a subject",
			elevation: controller.ElevationConfig{
				Mode: "required", TOTPEnabled: true, WebauthnEnabled: true,
			},
			db:         mock.NewMockDBClient,
			token:      subjectlessToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr: &oapi.AuthenticatorError{
				Scheme:  "BearerAuthElevated",
				Code:    "unauthorized",
				Message: "error verifying elevated claim",
			},
		},

		{
			name: "BearerAuthElevated: elevated disabled",
			elevation: controller.ElevationConfig{
				Mode: "disabled", TOTPEnabled: true, WebauthnEnabled: true,
			},
			db:         mock.NewMockDBClient,
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name: "BearerAuthElevated: elevated recommended, no security keys, claim not present",
			elevation: controller.ElevationConfig{
				Mode: "recommended", TOTPEnabled: true, WebauthnEnabled: true,
			},
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(sql.AuthUser{}, nil)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name: "BearerAuthElevated: elevated recommended, security keys, claim not present",
			elevation: controller.ElevationConfig{
				Mode: "recommended", TOTPEnabled: true, WebauthnEnabled: true,
			},
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(1), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(sql.AuthUser{}, nil)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr: &oapi.AuthenticatorError{
				Scheme:  "BearerAuthElevated",
				Code:    "unauthorized",
				Message: "elevated claim required",
			},
		},

		{
			name: "BearerAuthElevated: elevated recommended, counting security keys fails",
			elevation: controller.ElevationConfig{
				Mode: "recommended", TOTPEnabled: true, WebauthnEnabled: true,
			},
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(
					int64(0), errors.New("database error"), //nolint:err113
				)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr: &oapi.AuthenticatorError{
				Scheme:  "BearerAuthElevated",
				Code:    "unauthorized",
				Message: "error verifying elevated claim",
			},
		},

		{
			name: "BearerAuthElevated: elevated required, no security keys, claim not present",
			elevation: controller.ElevationConfig{
				Mode: "required", TOTPEnabled: true, WebauthnEnabled: true,
			},
			db:         mock.NewMockDBClient,
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr: &oapi.AuthenticatorError{
				Scheme:  "BearerAuthElevated",
				Code:    "unauthorized",
				Message: "elevated claim required",
			},
		},

		{
			name: "BearerAuthElevated: elevated recommended, security keys, claim present",
			elevation: controller.ElevationConfig{
				Mode: "recommended", TOTPEnabled: true, WebauthnEnabled: true,
			},
			db:         mock.NewMockDBClient,
			token:      elevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name: "BearerAuthElevated: elevated required, security keys, claim present",
			elevation: controller.ElevationConfig{
				Mode: "required", TOTPEnabled: true, WebauthnEnabled: true,
			},
			db:         mock.NewMockDBClient,
			token:      elevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name: "BearerAuthElevated: elevated required, no security keys, add first security key",
			elevation: controller.ElevationConfig{
				Mode: "required", TOTPEnabled: true, WebauthnEnabled: true,
			},
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(sql.AuthUser{}, nil)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: &url.URL{Path: "/user/webauthn/add"},
			routePath:  "/user/webauthn/add",
			expectErr:  nil,
		},

		{
			name: "BearerAuthElevated: elevated required, no security keys, add first security key behind api prefix",
			elevation: controller.ElevationConfig{
				Mode: "required", TOTPEnabled: true, WebauthnEnabled: true,
			},
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				// With AUTH_API_PREFIX set the request URL carries the prefix
				// but the matched route path does not.
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(sql.AuthUser{}, nil)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: &url.URL{Path: "/v1/user/webauthn/add"},
			routePath:  "/user/webauthn/add",
			expectErr:  nil,
		},

		{
			name: "BearerAuthElevated: elevated required, no security keys, verify security key endpoint",
			elevation: controller.ElevationConfig{
				Mode: "required", TOTPEnabled: true, WebauthnEnabled: true,
			},
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(sql.AuthUser{}, nil)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: &url.URL{Path: "/user/webauthn/verify"},
			routePath:  "/user/webauthn/verify",
			expectErr:  nil,
		},

		{
			name: "BearerAuthElevated: elevated required, no factor, generate totp secret",
			elevation: controller.ElevationConfig{
				Mode: "required", TOTPEnabled: true, WebauthnEnabled: true,
			},
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				// Setting up a first factor is the one thing a user with none
				// must be able to do, or every guarded route stays unreachable.
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(sql.AuthUser{}, nil)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: &url.URL{Path: "/mfa/totp/generate"},
			routePath:  "/mfa/totp/generate",
			expectErr:  nil,
		},

		{
			name: "BearerAuthElevated: elevated required, security key, generate totp secret",
			elevation: controller.ElevationConfig{
				Mode: "required", TOTPEnabled: true, WebauthnEnabled: true,
			},
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				// A user who already has a factor must elevate with it before
				// enrolling another one.
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(1), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(sql.AuthUser{}, nil)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: &url.URL{Path: "/mfa/totp/generate"},
			routePath:  "/mfa/totp/generate",
			expectErr: &oapi.AuthenticatorError{
				Scheme:  "BearerAuthElevated",
				Code:    "unauthorized",
				Message: "elevated claim required",
			},
		},

		{
			name: "BearerAuthElevated: elevated recommended, no security keys, totp active, claim not present",
			elevation: controller.ElevationConfig{
				Mode: "recommended", TOTPEnabled: true, WebauthnEnabled: true,
			},
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(
					sql.AuthUser{
						ActiveMfaType: sql.Text("totp"),
						TotpSecret:    sql.Text("encrypted-secret"),
					}, nil,
				)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr: &oapi.AuthenticatorError{
				Scheme:  "BearerAuthElevated",
				Code:    "unauthorized",
				Message: "elevated claim required",
			},
		},

		{
			name: "BearerAuthElevated: elevated recommended, totp active but no secret",
			elevation: controller.ElevationConfig{
				Mode: "recommended", TOTPEnabled: true, WebauthnEnabled: true,
			},
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				// ElevateTotp refuses this user with no-totp-secret, so it is
				// not a factor and elevation must not be demanded over it.
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(
					sql.AuthUser{ActiveMfaType: sql.Text("totp")}, nil,
				)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name: "BearerAuthElevated: elevated recommended, no security keys, totp active, claim present",
			elevation: controller.ElevationConfig{
				Mode: "recommended", TOTPEnabled: true, WebauthnEnabled: true,
			},
			db:         mock.NewMockDBClient,
			token:      elevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name: "BearerAuthElevated: elevated recommended, no security keys, get user fails",
			elevation: controller.ElevationConfig{
				Mode: "recommended", TOTPEnabled: true, WebauthnEnabled: true,
			},
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(
					sql.AuthUser{}, errors.New("database error"), //nolint:err113
				)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr: &oapi.AuthenticatorError{
				Scheme:  "BearerAuthElevated",
				Code:    "unauthorized",
				Message: "error verifying elevated claim",
			},
		},

		{
			name: "BearerAuthElevated: elevated recommended, totp disabled, stale active_mfa_type",
			elevation: controller.ElevationConfig{
				Mode: "recommended", TOTPEnabled: false, WebauthnEnabled: true,
			},
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name:       "BearerAuth: rejects an OAuth2 access token",
			elevation:  controller.ElevationConfig{Mode: "disabled"},
			db:         mock.NewMockDBClient,
			token:      oauth2AccessToken,
			scheme:     "BearerAuth",
			requestURL: nil,
			expectErr:  rejected("BearerAuth"),
		},

		{
			name:       "BearerAuth: rejects an OIDC ID token",
			elevation:  controller.ElevationConfig{Mode: "disabled"},
			db:         mock.NewMockDBClient,
			token:      oidcIDToken,
			scheme:     "BearerAuth",
			requestURL: nil,
			expectErr:  rejected("BearerAuth"),
		},

		{
			name:       "BearerAuth: rejects a provider state token",
			elevation:  controller.ElevationConfig{Mode: "disabled"},
			db:         mock.NewMockDBClient,
			token:      providerStateToken,
			scheme:     "BearerAuth",
			requestURL: nil,
			expectErr:  rejected("BearerAuth"),
		},

		{
			name:       "BearerAuth: accepts a legacy session token",
			elevation:  controller.ElevationConfig{Mode: "disabled"},
			db:         mock.NewMockDBClient,
			token:      legacySessionToken,
			scheme:     "BearerAuth",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name:       "BearerAuth: rejects a legacy-typed token without Hasura claims",
			elevation:  controller.ElevationConfig{Mode: "disabled"},
			db:         mock.NewMockDBClient,
			token:      legacyTypeWithoutHasuraClaims,
			scheme:     "BearerAuth",
			requestURL: nil,
			expectErr:  rejected("BearerAuth"),
		},

		{
			name:       "BearerAuth: rejects a legacy OAuth2 access token",
			elevation:  controller.ElevationConfig{Mode: "disabled"},
			db:         mock.NewMockDBClient,
			token:      legacyOAuth2AccessToken,
			scheme:     "BearerAuth",
			requestURL: nil,
			expectErr:  rejected("BearerAuth"),
		},

		{
			name:       "BearerAuthElevated: elevated disabled, rejects a legacy OAuth2 access token",
			elevation:  controller.ElevationConfig{Mode: "disabled"},
			db:         mock.NewMockDBClient,
			token:      legacyOAuth2AccessToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr:  rejected("BearerAuthElevated"),
		},

		{
			name:       "BearerAuthElevated: elevated disabled, rejects an OAuth2 access token",
			elevation:  controller.ElevationConfig{Mode: "disabled"},
			db:         mock.NewMockDBClient,
			token:      oauth2AccessToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr:  rejected("BearerAuthElevated"),
		},

		{
			name:       "BearerAuthElevated: elevated disabled, rejects an OIDC ID token",
			elevation:  controller.ElevationConfig{Mode: "disabled"},
			db:         mock.NewMockDBClient,
			token:      oidcIDToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr:  rejected("BearerAuthElevated"),
		},

		{
			name:       "BearerAuthOAuth2: accepts an OAuth2 access token",
			elevation:  controller.ElevationConfig{Mode: "disabled"},
			db:         mock.NewMockDBClient,
			token:      oauth2AccessToken,
			scheme:     "BearerAuthOAuth2",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name:       "BearerAuthOAuth2: accepts a legacy OAuth2 access token",
			elevation:  controller.ElevationConfig{Mode: "disabled"},
			db:         mock.NewMockDBClient,
			token:      legacyOAuth2AccessToken,
			scheme:     "BearerAuthOAuth2",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name:       "BearerAuthOAuth2: rejects a session token",
			elevation:  controller.ElevationConfig{Mode: "disabled"},
			db:         mock.NewMockDBClient,
			token:      nonElevatedToken,
			scheme:     "BearerAuthOAuth2",
			requestURL: nil,
			expectErr:  rejected("BearerAuthOAuth2"),
		},

		{
			name:       "BearerAuthOAuth2: rejects a legacy session token",
			elevation:  controller.ElevationConfig{Mode: "disabled"},
			db:         mock.NewMockDBClient,
			token:      legacySessionToken,
			scheme:     "BearerAuthOAuth2",
			requestURL: nil,
			expectErr:  rejected("BearerAuthOAuth2"),
		},

		{
			name:       "BearerAuthOAuth2: rejects an OIDC ID token",
			elevation:  controller.ElevationConfig{Mode: "disabled"},
			db:         mock.NewMockDBClient,
			token:      oidcIDToken,
			scheme:     "BearerAuthOAuth2",
			requestURL: nil,
			expectErr:  rejected("BearerAuthOAuth2"),
		},

		{
			name:       "unknown scheme accepts no token",
			elevation:  controller.ElevationConfig{Mode: "disabled"},
			db:         mock.NewMockDBClient,
			token:      nonElevatedToken,
			scheme:     "SomeOtherScheme",
			requestURL: nil,
			expectErr: &oapi.AuthenticatorError{
				Scheme:  "SomeOtherScheme",
				Code:    "unauthorized",
				Message: "unsupported security scheme",
			},
		},

		{
			name: "BearerAuthElevated: elevated recommended, webauthn disabled, stale security keys",
			elevation: controller.ElevationConfig{
				Mode: "recommended", TOTPEnabled: false, WebauthnEnabled: false,
			},
			db:         mock.NewMockDBClient,
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name: "BearerAuthElevated: elevated recommended, webauthn disabled, totp active",
			elevation: controller.ElevationConfig{
				Mode: "recommended", TOTPEnabled: true, WebauthnEnabled: false,
			},
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(
					sql.AuthUser{
						ActiveMfaType: sql.Text("totp"),
						TotpSecret:    sql.Text("encrypted-secret"),
					}, nil,
				)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr: &oapi.AuthenticatorError{
				Scheme:  "BearerAuthElevated",
				Code:    "unauthorized",
				Message: "elevated claim required",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			jwtGetter, err := controller.NewJWTGetter(
				jwtSecret,
				time.Hour,
				nil,
				tc.elevation,
				tc.db(ctrl),
				"hasura-auth",
				"",
			)
			if err != nil {
				t.Fatalf("GetJWTFunc() err = %v; want nil", err)
			}

			request := &http.Request{
				Header: http.Header{
					"Authorization": []string{"Bearer " + tc.token},
				},
			}
			if tc.requestURL != nil {
				request.URL = tc.requestURL
			}

			input := &openapi3filter.AuthenticationInput{
				RequestValidationInput: &openapi3filter.RequestValidationInput{
					Request: request,
					Route:   &routers.Route{Path: tc.routePath},
				},
				SecuritySchemeName: tc.scheme,
			}

			ctx := context.WithValue(
				context.Background(),
				oapi.GinContextKey,
				&gin.Context{},
			)

			mwErr := jwtGetter.MiddlewareFunc(ctx, input)
			if diff := cmp.Diff(mwErr, tc.expectErr); diff != "" {
				t.Errorf("err mismatch (-want +got):\n%s", diff)
			}

			got, _ := jwtGetter.FromContext(ctx)

			if tc.expectErr != nil {
				if got != nil {
					t.Error("expected no token in context when error is expected")
				}

				return
			}

			if got == nil {
				t.Fatal("expected token in context")
			}

			gotUserID, uidErr := jwtGetter.GetUserID(got)
			if uidErr != nil {
				t.Fatalf("failed to get user ID from token: %v", uidErr)
			}

			if gotUserID != userID {
				t.Errorf("unexpected user ID: got %s, want %s", gotUserID, userID)
			}
		})
	}
}
