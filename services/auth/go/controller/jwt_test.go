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
				controller.ElevationConfig{},
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
		jwtSecret, time.Hour, nil, controller.ElevationConfig{}, nil, "hasura-auth",
	)
	if err != nil {
		t.Fatalf("failed to create signing jwt getter: %v", err)
	}

	nonElevatedToken := signTestToken(t, signingGetter, userID, nil)

	subjectlessToken, err := signingGetter.SignTokenWithClaims(
		jwt.MapClaims{"flow": "signin", "state": "abc"},
		time.Now().Add(time.Minute),
	)
	if err != nil {
		t.Fatalf("failed to sign subjectless token: %v", err)
	}

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
		name       string
		elevation  controller.ElevationConfig
		db         func(ctrl *gomock.Controller) *mock.MockDBClient
		token      string
		scheme     string
		requestURL *url.URL
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
			// A provider state token is signed by this service and carries no
			// sub, so an empty subject must never satisfy the elevated claim.
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

		{
			name: "BearerAuthElevated: elevated recommended, no security keys, otp email enabled, user has email, claim not present",
			elevation: controller.ElevationConfig{
				Mode: "recommended", WebauthnEnabled: true, OTPEmailEnabled: true,
			},
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(
					sql.AuthUser{Email: sql.Text("jane@acme.com")}, nil,
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
			name: "BearerAuthElevated: elevated recommended, otp email enabled, user has email, claim present",
			elevation: controller.ElevationConfig{
				Mode: "recommended", WebauthnEnabled: true, OTPEmailEnabled: true,
			},
			db:         mock.NewMockDBClient,
			token:      elevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name: "BearerAuthElevated: elevated recommended, no security keys, otp email enabled, user has no email, no totp",
			elevation: controller.ElevationConfig{
				Mode:        "recommended",
				TOTPEnabled: true, WebauthnEnabled: true, OTPEmailEnabled: true,
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
			name: "BearerAuthElevated: elevated recommended, otp email disabled, user has email",
			elevation: controller.ElevationConfig{
				Mode: "recommended", WebauthnEnabled: true, OTPEmailEnabled: false,
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
			name: "BearerAuthElevated: elevated recommended, no security keys, otp sms enabled, user has a verified phone, claim not present",
			elevation: controller.ElevationConfig{
				Mode: "recommended", WebauthnEnabled: true, OTPSmsEnabled: true,
			},
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(
					sql.AuthUser{
						PhoneNumber:         sql.Text("+1234567890"),
						PhoneNumberVerified: true,
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
			name: "BearerAuthElevated: elevated recommended, otp sms enabled, user has an unverified phone",
			elevation: controller.ElevationConfig{
				Mode: "recommended", WebauthnEnabled: true, OTPSmsEnabled: true,
			},
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(
					sql.AuthUser{PhoneNumber: sql.Text("+1234567890")}, nil,
				)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name: "BearerAuthElevated: elevated recommended, otp sms disabled, user has a verified phone",
			elevation: controller.ElevationConfig{
				Mode: "recommended", WebauthnEnabled: true, OTPSmsEnabled: false,
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
