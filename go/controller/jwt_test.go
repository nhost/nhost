package controller_test

import (
	"context"
	"crypto"
	"errors"
	"log/slog"
	"net/http"
	"testing"
	"time"

	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/controller/mock"
	ginmiddleware "github.com/oapi-codegen/gin-middleware"
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
				Header: map[string]interface{}{"alg": string("HS256"), "typ": string("JWT")},
				Claims: jwt.MapClaims{
					"exp": float64(1.708103735e+09),
					"https://hasura.io/jwt/claims": map[string]interface{}{
						"x-hasura-allowed-roles": []interface{}{
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
				Header: map[string]interface{}{"alg": string("HS256"), "typ": string("JWT")},
				Claims: jwt.MapClaims{
					"exp": float64(1.708103735e+09),
					"https://hasura.io/jwt/claims": map[string]interface{}{
						"x-hasura-allowed-roles": []interface{}{
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
				Header: map[string]interface{}{"alg": string("HS256"), "typ": string("JWT")},
				Claims: jwt.MapClaims{
					"exp": float64(1.708103735e+09),
					"some/namespace": map[string]interface{}{
						"x-hasura-allowed-roles": []interface{}{
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
				Header: map[string]interface{}{"alg": string("HS256"), "typ": string("JWT")},
				Claims: jwt.MapClaims{
					"exp": 1.708103735e+09,
					"https://hasura.io/jwt/claims": map[string]interface{}{
						"x-hasura-allowed-roles": []interface{}{
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
			jwtGetter, err := controller.NewJWTGetter(tc.key, tc.expiresIn, customClaimer, "", nil)
			if err != nil {
				t.Fatalf("GetJWTFunc() err = %v; want nil", err)
			}

			accessToken, _, err := jwtGetter.GetToken(
				context.Background(),
				tc.userID,
				false,
				tc.allowedRoles,
				tc.defaultRole,
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
				cmpopts.IgnoreMapEntries(func(key string, _ interface{}) bool {
					return key == "iat" || key == "exp"
				}),
			}
			if diff := cmp.Diff(decodedToken, tc.expectedToken, cmpopts...); diff != "" {
				t.Errorf("decodedToken mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

//nolint:dupl
func TestMiddlewareFunc(t *testing.T) { //nolint:maintidx
	t.Parallel()

	userID := uuid.MustParse("f90782de-f0a3-41fe-b778-01e4f80c2413")

	//nolint:lll,gosec
	nonElevatedToken := `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjEwNzExMTE4MDI0LCJodHRwczovL2hhc3VyYS5pby9qd3QvY2xhaW1zIjp7IngtaGFzdXJhLWFsbG93ZWQtcm9sZXMiOlsibWUiLCJ1c2VyIiwiZWRpdG9yIl0sIngtaGFzdXJhLWRlZmF1bHQtcm9sZSI6InVzZXIiLCJ4LWhhc3VyYS11c2VyLWlkIjoiZjkwNzgyZGUtZjBhMy00MWZlLWI3NzgtMDFlNGY4MGMyNDEzIiwieC1oYXN1cmEtdXNlci1pcy1hbm9ueW1vdXMiOiJmYWxzZSJ9LCJpYXQiOjE3MTExMTgwMjQsImlzcyI6Imhhc3VyYS1hdXRoIiwic3ViIjoiZjkwNzgyZGUtZjBhMy00MWZlLWI3NzgtMDFlNGY4MGMyNDEzIn0.wms_3kNeVVeqxQvSMcM2l7By1BTz4uteKSAGmVgafYY`
	//nolint:lll
	elevatedToken := `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjEwNzExMTE4MDc2LCJodHRwczovL2hhc3VyYS5pby9qd3QvY2xhaW1zIjp7IngtaGFzdXJhLWFsbG93ZWQtcm9sZXMiOlsibWUiLCJ1c2VyIiwiZWRpdG9yIl0sIngtaGFzdXJhLWF1dGgtZWxldmF0ZWQiOiJmOTA3ODJkZS1mMGEzLTQxZmUtYjc3OC0wMWU0ZjgwYzI0MTMiLCJ4LWhhc3VyYS1kZWZhdWx0LXJvbGUiOiJ1c2VyIiwieC1oYXN1cmEtdXNlci1pZCI6ImY5MDc4MmRlLWYwYTMtNDFmZS1iNzc4LTAxZTRmODBjMjQxMyIsIngtaGFzdXJhLXVzZXItaXMtYW5vbnltb3VzIjoiZmFsc2UifSwiaWF0IjoxNzExMTE4MDc2LCJpc3MiOiJoYXN1cmEtYXV0aCIsInN1YiI6ImY5MDc4MmRlLWYwYTMtNDFmZS1iNzc4LTAxZTRmODBjMjQxMyJ9.hxnECqwk1ZO64kZtA4g71GyYGFIeidGw-u9HUmBC7Xk` //nolint:gosec

	cases := []struct {
		name         string
		elevatedMode string
		db           func(ctrl *gomock.Controller) *mock.MockDBClient
		request      *openapi3filter.AuthenticationInput
		expected     *jwt.Token
		expectedErr  error
	}{
		{
			name:         "BearerAuth: elevated disabled",
			elevatedMode: "disabled",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			//nolint:exhaustruct
			request: &openapi3filter.AuthenticationInput{
				RequestValidationInput: &openapi3filter.RequestValidationInput{
					Request: &http.Request{
						Header: http.Header{
							"Authorization": []string{"Bearer " + nonElevatedToken},
						},
					},
				},
				SecuritySchemeName: "BearerAuth",
				SecurityScheme:     nil,
				Scopes:             []string{},
			},
			expected: &jwt.Token{
				Raw:    nonElevatedToken,
				Method: jwt.SigningMethodHS256,
				Header: map[string]any{"alg": string("HS256"), "typ": string("JWT")},
				Claims: jwt.MapClaims{
					"exp": float64(1.0711118024e+10),
					"https://hasura.io/jwt/claims": map[string]any{
						"x-hasura-allowed-roles": []any{"me", "user", "editor"},
						"x-hasura-default-role":  string("user"),
						"x-hasura-user-id": string(
							"f90782de-f0a3-41fe-b778-01e4f80c2413",
						),
						"x-hasura-user-is-anonymous": string("false"),
					},
					"iat": float64(1.711118024e+09),
					"iss": string("hasura-auth"),
					"sub": string("f90782de-f0a3-41fe-b778-01e4f80c2413"),
				},
				Signature: []uint8{},
				Valid:     true,
			},
			expectedErr: nil,
		},

		{
			name:         "BearerAuth: elevated recommended, no security keys, claim not present",
			elevatedMode: "recommended",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			//nolint:exhaustruct
			request: &openapi3filter.AuthenticationInput{
				RequestValidationInput: &openapi3filter.RequestValidationInput{
					Request: &http.Request{
						Header: http.Header{
							"Authorization": []string{"Bearer " + nonElevatedToken},
						},
					},
				},
				SecuritySchemeName: "BearerAuth",
				SecurityScheme:     nil,
				Scopes:             []string{},
			},
			expected: &jwt.Token{
				Raw:    nonElevatedToken,
				Method: jwt.SigningMethodHS256,
				Header: map[string]any{"alg": string("HS256"), "typ": string("JWT")},
				Claims: jwt.MapClaims{
					"exp": float64(1.0711118024e+10),
					"https://hasura.io/jwt/claims": map[string]any{
						"x-hasura-allowed-roles": []any{"me", "user", "editor"},
						"x-hasura-default-role":  string("user"),
						"x-hasura-user-id": string(
							"f90782de-f0a3-41fe-b778-01e4f80c2413",
						),
						"x-hasura-user-is-anonymous": string("false"),
					},
					"iat": float64(1.711118024e+09),
					"iss": string("hasura-auth"),
					"sub": string("f90782de-f0a3-41fe-b778-01e4f80c2413"),
				},
				Signature: []uint8{},
				Valid:     true,
			},
			expectedErr: nil,
		},

		{
			name:         "BearerAuth: elevated required, no security keys, claim not present",
			elevatedMode: "required",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			//nolint:exhaustruct
			request: &openapi3filter.AuthenticationInput{
				RequestValidationInput: &openapi3filter.RequestValidationInput{
					Request: &http.Request{
						Header: http.Header{
							"Authorization": []string{"Bearer " + nonElevatedToken},
						},
					},
				},
				SecuritySchemeName: "BearerAuth",
				SecurityScheme:     nil,
				Scopes:             []string{},
			},
			expected: &jwt.Token{
				Raw:    nonElevatedToken,
				Method: jwt.SigningMethodHS256,
				Header: map[string]any{"alg": string("HS256"), "typ": string("JWT")},
				Claims: jwt.MapClaims{
					"exp": float64(1.0711118024e+10),
					"https://hasura.io/jwt/claims": map[string]any{
						"x-hasura-allowed-roles": []any{"me", "user", "editor"},
						"x-hasura-default-role":  string("user"),
						"x-hasura-user-id": string(
							"f90782de-f0a3-41fe-b778-01e4f80c2413",
						),
						"x-hasura-user-is-anonymous": string("false"),
					},
					"iat": float64(1.711118024e+09),
					"iss": string("hasura-auth"),
					"sub": string("f90782de-f0a3-41fe-b778-01e4f80c2413"),
				},
				Signature: []uint8{},
				Valid:     true,
			},
			expectedErr: nil,
		},

		{
			name:         "BearerAuthElevated: elevated disabled",
			elevatedMode: "disabled",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			//nolint:exhaustruct
			request: &openapi3filter.AuthenticationInput{
				RequestValidationInput: &openapi3filter.RequestValidationInput{
					Request: &http.Request{
						Header: http.Header{
							"Authorization": []string{"Bearer " + nonElevatedToken},
						},
					},
				},
				SecuritySchemeName: "BearerAuthElevated",
				SecurityScheme:     nil,
				Scopes:             []string{},
			},
			expected: &jwt.Token{
				Raw:    nonElevatedToken,
				Method: jwt.SigningMethodHS256,
				Header: map[string]any{"alg": string("HS256"), "typ": string("JWT")},
				Claims: jwt.MapClaims{
					"exp": float64(1.0711118024e+10),
					"https://hasura.io/jwt/claims": map[string]any{
						"x-hasura-allowed-roles": []any{"me", "user", "editor"},
						"x-hasura-default-role":  string("user"),
						"x-hasura-user-id": string(
							"f90782de-f0a3-41fe-b778-01e4f80c2413",
						),
						"x-hasura-user-is-anonymous": string("false"),
					},
					"iat": float64(1.711118024e+09),
					"iss": string("hasura-auth"),
					"sub": string("f90782de-f0a3-41fe-b778-01e4f80c2413"),
				},
				Signature: []uint8{},
				Valid:     true,
			},
			expectedErr: nil,
		},

		{
			name:         "BearerAuthElevated: elevated recommended, no security keys, claim not present",
			elevatedMode: "recommended",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				return mock
			},
			//nolint:exhaustruct
			request: &openapi3filter.AuthenticationInput{
				RequestValidationInput: &openapi3filter.RequestValidationInput{
					Request: &http.Request{
						Header: http.Header{
							"Authorization": []string{"Bearer " + nonElevatedToken},
						},
					},
				},
				SecuritySchemeName: "BearerAuthElevated",
				SecurityScheme:     nil,
				Scopes:             []string{},
			},
			expected: &jwt.Token{
				Raw:    nonElevatedToken,
				Method: jwt.SigningMethodHS256,
				Header: map[string]any{"alg": string("HS256"), "typ": string("JWT")},
				Claims: jwt.MapClaims{
					"exp": float64(1.0711118024e+10),
					"https://hasura.io/jwt/claims": map[string]any{
						"x-hasura-allowed-roles": []any{"me", "user", "editor"},
						"x-hasura-default-role":  string("user"),
						"x-hasura-user-id": string(
							"f90782de-f0a3-41fe-b778-01e4f80c2413",
						),
						"x-hasura-user-is-anonymous": string("false"),
					},
					"iat": float64(1.711118024e+09),
					"iss": string("hasura-auth"),
					"sub": string("f90782de-f0a3-41fe-b778-01e4f80c2413"),
				},
				Signature: []uint8{},
				Valid:     true,
			},
			expectedErr: nil,
		},

		{
			name:         "BearerAuthElevated: elevated recommended, security keys, claim not present",
			elevatedMode: "recommended",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(1), nil)
				return mock
			},
			//nolint:exhaustruct
			request: &openapi3filter.AuthenticationInput{
				RequestValidationInput: &openapi3filter.RequestValidationInput{
					Request: &http.Request{
						Header: http.Header{
							"Authorization": []string{"Bearer " + nonElevatedToken},
						},
					},
				},
				SecuritySchemeName: "BearerAuthElevated",
				SecurityScheme:     nil,
				Scopes:             []string{},
			},
			expected:    nil,
			expectedErr: controller.ErrElevatedClaimRequired,
		},

		{
			name:         "BearerAuthElevated: elevated required, no security keys, claim not present",
			elevatedMode: "required",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			//nolint:exhaustruct
			request: &openapi3filter.AuthenticationInput{
				RequestValidationInput: &openapi3filter.RequestValidationInput{
					Request: &http.Request{
						Header: http.Header{
							"Authorization": []string{"Bearer " + nonElevatedToken},
						},
					},
				},
				SecuritySchemeName: "BearerAuthElevated",
				SecurityScheme:     nil,
				Scopes:             []string{},
			},
			expected:    nil,
			expectedErr: controller.ErrElevatedClaimRequired,
		},

		{
			name:         "BearerAuthElevated: elevated recommended, security keys, claim present",
			elevatedMode: "recommended",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(1), nil)
				return mock
			},
			//nolint:exhaustruct
			request: &openapi3filter.AuthenticationInput{
				RequestValidationInput: &openapi3filter.RequestValidationInput{
					Request: &http.Request{
						Header: http.Header{
							"Authorization": []string{"Bearer " + elevatedToken},
						},
					},
				},
				SecuritySchemeName: "BearerAuthElevated",
				SecurityScheme:     nil,
				Scopes:             []string{},
			},
			expected: &jwt.Token{
				Raw:    elevatedToken,
				Method: jwt.SigningMethodHS256,
				Header: map[string]any{"alg": string("HS256"), "typ": string("JWT")},
				Claims: jwt.MapClaims{
					"exp": float64(1.0711118076e+10),
					"https://hasura.io/jwt/claims": map[string]any{
						"x-hasura-allowed-roles": []any{"me", "user", "editor"},
						"x-hasura-auth-elevated": string(
							"f90782de-f0a3-41fe-b778-01e4f80c2413",
						),
						"x-hasura-default-role": string("user"),
						"x-hasura-user-id": string(
							"f90782de-f0a3-41fe-b778-01e4f80c2413",
						),
						"x-hasura-user-is-anonymous": string("false"),
					},
					"iat": float64(1.711118076e+09),
					"iss": string("hasura-auth"),
					"sub": string("f90782de-f0a3-41fe-b778-01e4f80c2413"),
				},
				Signature: []uint8{},
				Valid:     true,
			},
			expectedErr: nil,
		},

		{
			name:         "BearerAuthElevated: elevated required, security keys, claim present",
			elevatedMode: "required",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			//nolint:exhaustruct
			request: &openapi3filter.AuthenticationInput{
				RequestValidationInput: &openapi3filter.RequestValidationInput{
					Request: &http.Request{
						Header: http.Header{
							"Authorization": []string{"Bearer " + elevatedToken},
						},
					},
				},
				SecuritySchemeName: "BearerAuthElevated",
				SecurityScheme:     nil,
				Scopes:             []string{},
			},
			expected: &jwt.Token{
				Raw:    elevatedToken,
				Method: jwt.SigningMethodHS256,
				Header: map[string]any{"alg": string("HS256"), "typ": string("JWT")},
				Claims: jwt.MapClaims{
					"exp": float64(1.0711118076e+10),
					"https://hasura.io/jwt/claims": map[string]any{
						"x-hasura-allowed-roles": []any{"me", "user", "editor"},
						"x-hasura-auth-elevated": string(
							"f90782de-f0a3-41fe-b778-01e4f80c2413",
						),
						"x-hasura-default-role": string("user"),
						"x-hasura-user-id": string(
							"f90782de-f0a3-41fe-b778-01e4f80c2413",
						),
						"x-hasura-user-is-anonymous": string("false"),
					},
					"iat": float64(1.711118076e+09),
					"iss": string("hasura-auth"),
					"sub": string("f90782de-f0a3-41fe-b778-01e4f80c2413"),
				},
				Signature: []uint8{},
				Valid:     true,
			},
			expectedErr: nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			jwtGetter, err := controller.NewJWTGetter(
				jwtSecret, time.Hour, nil, tc.elevatedMode, tc.db(ctrl),
			)
			if err != nil {
				t.Fatalf("GetJWTFunc() err = %v; want nil", err)
			}

			//nolint
			ctx := context.WithValue(
				context.Background(),
				ginmiddleware.GinContextKey,
				&gin.Context{},
			)
			err = jwtGetter.MiddlewareFunc(ctx, tc.request)
			if !errors.Is(err, tc.expectedErr) {
				t.Errorf("err = %v; want %v", err, tc.expectedErr)
			}

			got, _ := jwtGetter.FromContext(ctx)

			cmpopts := []cmp.Option{
				cmpopts.IgnoreFields(jwt.Token{}, "Signature"), //nolint:exhaustruct
			}
			if diff := cmp.Diff(got, tc.expected, cmpopts...); diff != "" {
				t.Errorf("got mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
