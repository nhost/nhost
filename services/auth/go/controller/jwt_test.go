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
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/nhost/nhost/internal/lib/oapi"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
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

func TestGetJWTFunc(t *testing.T) { //nolint:maintidx
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
				Header: map[string]any{"alg": string("HS256"), "typ": string("JWT")},
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
				Header: map[string]any{"alg": string("HS256"), "typ": string("JWT")},
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
				Header: map[string]any{"alg": string("HS256"), "typ": string("JWT")},
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
				Header: map[string]any{"alg": string("HS256"), "typ": string("JWT")},
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
				controller.ElevationConfig{
					Mode:                     "",
					MFAEnabled:               false,
					OTPEmailEnabled:          false,
					RequireEmailVerification: false,
					SMSPasswordlessEnabled:   false,
					WebauthnEnabled:          false,
				},
				nil,
				"hasura-auth",
			)
			if err != nil {
				t.Fatalf("GetJWTFunc() err = %v; want nil", err)
			}

			accessToken, _, err := jwtGetter.GetToken(
				t.Context(),
				tc.userID,
				false,
				tc.allowedRoles,
				tc.defaultRole,
				nil,
				slog.Default(),
			)
			if err != nil {
				t.Fatalf("fn() err = %v; want nil", err)
			}

			t.Logf("token = %v", accessToken)

			decodedToken, err := jwtGetter.Validate(accessToken)
			if err != nil {
				t.Fatalf("fn() err = %v; want nil", err)
			}

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

	token, err := jwtGetter.SignTokenWithClaims(claims, time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("failed to sign test token: %v", err)
	}

	return token
}

func TestMiddlewareFunc(t *testing.T) { //nolint:maintidx
	t.Parallel()

	userID := uuid.MustParse("f90782de-f0a3-41fe-b778-01e4f80c2413")

	signingGetter, err := controller.NewJWTGetter(
		jwtSecret, time.Hour, nil,
		controller.ElevationConfig{
			Mode:                     "",
			MFAEnabled:               false,
			OTPEmailEnabled:          false,
			RequireEmailVerification: false,
			SMSPasswordlessEnabled:   false,
			WebauthnEnabled:          false,
		},
		nil, "hasura-auth",
	)
	if err != nil {
		t.Fatalf("failed to create signing jwt getter: %v", err)
	}

	nonElevatedToken := signTestToken(t, signingGetter, userID, nil)
	elevatedToken := signTestToken(t, signingGetter, userID, map[string]any{
		"https://hasura.io/jwt/claims": map[string]any{
			"x-hasura-allowed-roles":     []string{"me", "user", "editor"},
			"x-hasura-auth-elevated":     userID.String(),
			"x-hasura-default-role":      "user",
			"x-hasura-user-id":           userID.String(),
			"x-hasura-user-is-anonymous": "false",
		},
	})

	cases := []struct {
		name                     string
		elevatedMode             string
		mfaEnabled               bool
		otpEmailEnabled          bool
		requireEmailVerification bool
		smsPasswordlessEnabled   bool
		webauthnEnabled          bool
		db                       func(ctrl *gomock.Controller) *mock.MockDBClient
		token                    string
		scheme                   string
		requestURL               *url.URL
		expectErr                error
	}{
		{
			name:            "BearerAuth: elevated disabled",
			elevatedMode:    "disabled",
			mfaEnabled:      true,
			otpEmailEnabled: false,
			db:              mock.NewMockDBClient,
			token:           nonElevatedToken,
			scheme:          "BearerAuth",
			requestURL:      nil,
			expectErr:       nil,
		},

		{
			name:            "BearerAuth: elevated recommended, no security keys, claim not present",
			elevatedMode:    "recommended",
			mfaEnabled:      true,
			otpEmailEnabled: false,
			db:              mock.NewMockDBClient,
			token:           nonElevatedToken,
			scheme:          "BearerAuth",
			requestURL:      nil,
			expectErr:       nil,
		},

		{
			name:            "BearerAuth: elevated required, no security keys, claim not present",
			elevatedMode:    "required",
			mfaEnabled:      true,
			otpEmailEnabled: false,
			db:              mock.NewMockDBClient,
			token:           nonElevatedToken,
			scheme:          "BearerAuth",
			requestURL:      nil,
			expectErr:       nil,
		},

		{
			name:            "BearerAuthElevated: elevated disabled",
			elevatedMode:    "disabled",
			mfaEnabled:      true,
			otpEmailEnabled: false,
			db:              mock.NewMockDBClient,
			token:           nonElevatedToken,
			scheme:          "BearerAuthElevated",
			requestURL:      nil,
			expectErr:       nil,
		},

		{
			name:            "BearerAuthElevated: elevated recommended, no security keys, claim not present",
			elevatedMode:    "recommended",
			mfaEnabled:      true,
			otpEmailEnabled: false,
			webauthnEnabled: true,
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
			name:            "BearerAuthElevated: elevated recommended, WebAuthn disabled ignores stored security keys",
			elevatedMode:    "recommended",
			webauthnEnabled: false,
			db:              mock.NewMockDBClient,
			token:           nonElevatedToken,
			scheme:          "BearerAuthElevated",
			requestURL:      nil,
			expectErr:       nil,
		},

		{
			name:            "BearerAuthElevated: elevated recommended, WebAuthn enabled with stored security key",
			elevatedMode:    "recommended",
			webauthnEnabled: true,
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().
					CountSecurityKeysUser(gomock.Any(), userID).
					Return(int64(1), nil).
					Times(1)

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
			name:            "BearerAuthElevated: elevated required, no security keys, claim not present",
			elevatedMode:    "required",
			mfaEnabled:      true,
			otpEmailEnabled: false,
			db:              mock.NewMockDBClient,
			token:           nonElevatedToken,
			scheme:          "BearerAuthElevated",
			requestURL:      nil,
			expectErr: &oapi.AuthenticatorError{
				Scheme:  "BearerAuthElevated",
				Code:    "unauthorized",
				Message: "elevated claim required",
			},
		},

		{
			name:                   "BearerAuthElevated: elevated recommended, matching elevated claim makes no DB calls",
			elevatedMode:           "recommended",
			mfaEnabled:             true,
			otpEmailEnabled:        true,
			smsPasswordlessEnabled: true,
			db:                     mock.NewMockDBClient,
			token:                  elevatedToken,
			scheme:                 "BearerAuthElevated",
			requestURL:             nil,
			expectErr:              nil,
		},

		{
			name:            "BearerAuthElevated: elevated required, security keys, claim present",
			elevatedMode:    "required",
			mfaEnabled:      true,
			otpEmailEnabled: false,
			db:              mock.NewMockDBClient,
			token:           elevatedToken,
			scheme:          "BearerAuthElevated",
			requestURL:      nil,
			expectErr:       nil,
		},

		{
			name:            "BearerAuthElevated: elevated required, no security keys, add first security key",
			elevatedMode:    "required",
			mfaEnabled:      true,
			otpEmailEnabled: false,
			webauthnEnabled: true,
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(sql.AuthUser{}, nil)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: &url.URL{Path: "/user/webauthn/add"},
			expectErr:  nil,
		},

		{
			name:            "BearerAuthElevated: elevated required, no security keys, verify security key endpoint",
			elevatedMode:    "required",
			mfaEnabled:      true,
			otpEmailEnabled: false,
			webauthnEnabled: true,
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(sql.AuthUser{}, nil)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: &url.URL{Path: "/user/webauthn/verify"},
			expectErr:  nil,
		},

		{
			name:                   "BearerAuthElevated: elevated recommended, SMS enabled with unusable phone, TOTP usable, claim not present",
			elevatedMode:           "recommended",
			mfaEnabled:             true,
			otpEmailEnabled:        false,
			smsPasswordlessEnabled: true,
			webauthnEnabled:        true,
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(sql.AuthUser{
					ActiveMfaType: sql.Text("totp"),
					TotpSecret:    sql.Text("encrypted-totp-secret"),
				}, nil)

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
			name:            "BearerAuthElevated: elevated recommended, TOTP active with empty secret",
			elevatedMode:    "recommended",
			mfaEnabled:      true,
			otpEmailEnabled: false,
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(sql.AuthUser{
					ActiveMfaType: sql.Text("totp"),
					TotpSecret:    sql.Text(""),
				}, nil)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name:                   "BearerAuthElevated: elevated recommended, MFA disabled with usable TOTP row",
			elevatedMode:           "recommended",
			mfaEnabled:             false,
			otpEmailEnabled:        false,
			smsPasswordlessEnabled: true,
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(sql.AuthUser{
					ActiveMfaType: sql.Text("totp"),
					TotpSecret:    sql.Text("encrypted-totp-secret"),
				}, nil)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name:            "BearerAuthElevated: elevated recommended, no security keys, totp active, claim present",
			elevatedMode:    "recommended",
			mfaEnabled:      true,
			otpEmailEnabled: false,
			db:              mock.NewMockDBClient,
			token:           elevatedToken,
			scheme:          "BearerAuthElevated",
			requestURL:      nil,
			expectErr:       nil,
		},

		{
			name:            "BearerAuthElevated: elevated recommended, no security keys, get user fails",
			elevatedMode:    "recommended",
			mfaEnabled:      true,
			otpEmailEnabled: false,
			webauthnEnabled: true,
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
			name:                   "BearerAuthElevated: elevated recommended, all row-dependent factors disabled skips user lookup",
			elevatedMode:           "recommended",
			mfaEnabled:             false,
			otpEmailEnabled:        false,
			smsPasswordlessEnabled: false,
			webauthnEnabled:        true,
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				// With MFA, email OTP, and SMS disabled the user row is never
				// fetched: stale row factors cannot require an elevation whose
				// endpoint is disabled server-wide.
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().
					CountSecurityKeysUser(gomock.Any(), userID).
					Return(int64(0), nil).
					Times(1)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name:                     "BearerAuthElevated: elevated recommended, unverified email with verification required",
			elevatedMode:             "recommended",
			mfaEnabled:               false,
			otpEmailEnabled:          true,
			requireEmailVerification: true,
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(sql.AuthUser{
					Email:         sql.Text("jane@acme.com"),
					EmailVerified: false,
				}, nil)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name:                   "BearerAuthElevated: elevated recommended, email OTP disabled with usable email row",
			elevatedMode:           "recommended",
			mfaEnabled:             true,
			otpEmailEnabled:        false,
			smsPasswordlessEnabled: false,
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(sql.AuthUser{
					Email:         sql.Text("jane@acme.com"),
					EmailVerified: true,
				}, nil)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name:                   "BearerAuthElevated: elevated recommended, SMS enabled with unusable phone, email OTP usable, claim not present",
			elevatedMode:           "recommended",
			mfaEnabled:             false,
			otpEmailEnabled:        true,
			smsPasswordlessEnabled: true,
			webauthnEnabled:        true,
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(sql.AuthUser{
					Email:         sql.Text("jane@acme.com"),
					EmailVerified: true,
				}, nil)

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
			name:            "BearerAuthElevated: elevated recommended, otp email enabled, user has email, claim present",
			elevatedMode:    "recommended",
			mfaEnabled:      false,
			otpEmailEnabled: true,
			db:              mock.NewMockDBClient,
			token:           elevatedToken,
			scheme:          "BearerAuthElevated",
			requestURL:      nil,
			expectErr:       nil,
		},

		{
			name:                   "BearerAuthElevated: elevated recommended, SMS enabled, verified non-empty phone, claim not present",
			elevatedMode:           "recommended",
			mfaEnabled:             false,
			otpEmailEnabled:        false,
			smsPasswordlessEnabled: true,
			webauthnEnabled:        true,
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(sql.AuthUser{
					PhoneNumber:         sql.Text("+15550000000"),
					PhoneNumberVerified: true,
				}, nil)

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
			name:                   "BearerAuthElevated: elevated recommended, SMS enabled, unverified phone, claim not present",
			elevatedMode:           "recommended",
			mfaEnabled:             false,
			otpEmailEnabled:        false,
			smsPasswordlessEnabled: true,
			webauthnEnabled:        true,
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(sql.AuthUser{
					PhoneNumber: sql.Text("+15550000000"),
				}, nil)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name:                   "BearerAuthElevated: elevated recommended, SMS enabled, empty verified phone, claim not present",
			elevatedMode:           "recommended",
			mfaEnabled:             false,
			otpEmailEnabled:        false,
			smsPasswordlessEnabled: true,
			webauthnEnabled:        true,
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(sql.AuthUser{
					PhoneNumber:         sql.Text(""),
					PhoneNumberVerified: true,
				}, nil)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name:                   "BearerAuthElevated: elevated recommended, SMS enabled, NULL verified phone, claim not present",
			elevatedMode:           "recommended",
			mfaEnabled:             false,
			otpEmailEnabled:        false,
			smsPasswordlessEnabled: true,
			webauthnEnabled:        true,
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(sql.AuthUser{
					PhoneNumberVerified: true,
				}, nil)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name:                   "BearerAuthElevated: elevated recommended, SMS disabled, verified phone, claim not present",
			elevatedMode:           "recommended",
			mfaEnabled:             true,
			otpEmailEnabled:        false,
			smsPasswordlessEnabled: false,
			webauthnEnabled:        true,
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(sql.AuthUser{
					PhoneNumber:         sql.Text("+15550000000"),
					PhoneNumberVerified: true,
				}, nil)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name:                   "BearerAuthElevated: elevated recommended, all row-dependent factors enabled but unusable, claim not present",
			elevatedMode:           "recommended",
			mfaEnabled:             true,
			otpEmailEnabled:        true,
			smsPasswordlessEnabled: true,
			webauthnEnabled:        true,
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
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			jwtGetter, err := controller.NewJWTGetter(
				jwtSecret,
				time.Hour,
				nil,
				controller.ElevationConfig{
					Mode:                     tc.elevatedMode,
					MFAEnabled:               tc.mfaEnabled,
					OTPEmailEnabled:          tc.otpEmailEnabled,
					RequireEmailVerification: tc.requireEmailVerification,
					SMSPasswordlessEnabled:   tc.smsPasswordlessEnabled,
					WebauthnEnabled:          tc.webauthnEnabled,
				},
				tc.db(ctrl),
				"hasura-auth",
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
