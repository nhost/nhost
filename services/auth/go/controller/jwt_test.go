package controller_test

import (
	"context"
	"crypto"
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
	"go.uber.org/mock/gomock"
)

//nolint:lll,gochecknoglobals
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
				"",
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
				cmpopts.IgnoreFields(jwt.Token{}, "Raw", "Signature"), //nolint:exhaustruct
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

func TestMiddlewareFunc(t *testing.T) { //nolint:cyclop
	t.Parallel()

	userID := uuid.MustParse("f90782de-f0a3-41fe-b778-01e4f80c2413")

	signingGetter, err := controller.NewJWTGetter(jwtSecret, time.Hour, nil, "", nil, "hasura-auth")
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
		name         string
		elevatedMode string
		db           func(ctrl *gomock.Controller) *mock.MockDBClient
		token        string
		scheme       string
		requestURL   *url.URL
		expectErr    error
	}{
		{
			name:         "BearerAuth: elevated disabled",
			elevatedMode: "disabled",
			db:           mock.NewMockDBClient,
			token:        nonElevatedToken,
			scheme:       "BearerAuth",
			requestURL:   nil,
			expectErr:    nil,
		},

		{
			name:         "BearerAuth: elevated recommended, no security keys, claim not present",
			elevatedMode: "recommended",
			db:           mock.NewMockDBClient,
			token:        nonElevatedToken,
			scheme:       "BearerAuth",
			requestURL:   nil,
			expectErr:    nil,
		},

		{
			name:         "BearerAuth: elevated required, no security keys, claim not present",
			elevatedMode: "required",
			db:           mock.NewMockDBClient,
			token:        nonElevatedToken,
			scheme:       "BearerAuth",
			requestURL:   nil,
			expectErr:    nil,
		},

		{
			name:         "BearerAuthElevated: elevated disabled",
			elevatedMode: "disabled",
			db:           mock.NewMockDBClient,
			token:        nonElevatedToken,
			scheme:       "BearerAuthElevated",
			requestURL:   nil,
			expectErr:    nil,
		},

		{
			name:         "BearerAuthElevated: elevated recommended, no security keys, claim not present",
			elevatedMode: "recommended",
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
			name:         "BearerAuthElevated: elevated recommended, security keys, claim not present",
			elevatedMode: "recommended",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(1), nil)

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
			name:         "BearerAuthElevated: elevated required, no security keys, claim not present",
			elevatedMode: "required",
			db:           mock.NewMockDBClient,
			token:        nonElevatedToken,
			scheme:       "BearerAuthElevated",
			requestURL:   nil,
			expectErr: &oapi.AuthenticatorError{
				Scheme:  "BearerAuthElevated",
				Code:    "unauthorized",
				Message: "elevated claim required",
			},
		},

		{
			name:         "BearerAuthElevated: elevated recommended, security keys, claim present",
			elevatedMode: "recommended",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(1), nil)

				return mock
			},
			token:      elevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: nil,
			expectErr:  nil,
		},

		{
			name:         "BearerAuthElevated: elevated required, security keys, claim present",
			elevatedMode: "required",
			db:           mock.NewMockDBClient,
			token:        elevatedToken,
			scheme:       "BearerAuthElevated",
			requestURL:   nil,
			expectErr:    nil,
		},

		{
			name:         "BearerAuthElevated: elevated required, no security keys, add first security key",
			elevatedMode: "required",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: &url.URL{Path: "/user/webauthn/add"}, //nolint:exhaustruct
			expectErr:  nil,
		},

		{
			name:         "BearerAuthElevated: elevated required, no security keys, verify security key endpoint",
			elevatedMode: "required",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)

				return mock
			},
			token:      nonElevatedToken,
			scheme:     "BearerAuthElevated",
			requestURL: &url.URL{Path: "/user/webauthn/verify"}, //nolint:exhaustruct
			expectErr:  nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			jwtGetter, err := controller.NewJWTGetter(
				jwtSecret, time.Hour, nil, tc.elevatedMode, tc.db(ctrl), "hasura-auth",
			)
			if err != nil {
				t.Fatalf("GetJWTFunc() err = %v; want nil", err)
			}

			//nolint:exhaustruct
			request := &http.Request{
				Header: http.Header{
					"Authorization": []string{"Bearer " + tc.token},
				},
			}
			if tc.requestURL != nil {
				request.URL = tc.requestURL
			}

			//nolint:exhaustruct
			input := &openapi3filter.AuthenticationInput{
				RequestValidationInput: &openapi3filter.RequestValidationInput{
					Request: request,
				},
				SecuritySchemeName: tc.scheme,
			}

			//nolint
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
