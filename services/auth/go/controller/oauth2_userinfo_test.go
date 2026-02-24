package controller_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
)

func TestOauth2UserinfoGet(t *testing.T) { //nolint:dupl
	t.Parallel()

	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")

	jwtTokenFn := func() *jwt.Token {
		return &jwt.Token{
			Raw:    "",
			Method: jwt.SigningMethodHS256,
			Header: map[string]any{
				"alg": "HS256",
				"typ": "JWT",
			},
			Claims: jwt.MapClaims{
				"exp":   float64(time.Now().Add(900 * time.Second).Unix()),
				"iat":   float64(time.Now().Unix()),
				"iss":   "hasura-auth",
				"sub":   userID.String(),
				"scope": "openid profile email",
				"https://hasura.io/jwt/claims": map[string]any{
					"x-hasura-allowed-roles":     []any{"user", "me"},
					"x-hasura-default-role":      "user",
					"x-hasura-user-id":           userID.String(),
					"x-hasura-user-is-anonymous": "false",
				},
			},
			Signature: []byte{},
			Valid:     true,
		}
	}

	cases := []testRequest[api.Oauth2UserinfoGetRequestObject, api.Oauth2UserinfoGetResponseObject]{
		{ //nolint:exhaustruct
			name:   "disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2UserinfoGetRequestObject{},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusInternalServerError,
				Body: api.OAuth2ErrorResponse{
					Error:            "server_error",
					ErrorDescription: ptr("OAuth2 provider is disabled"),
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "no jwt in context",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2UserinfoGetRequestObject{},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusUnauthorized,
				Body: api.OAuth2ErrorResponse{
					Error:            "invalid_token",
					ErrorDescription: ptr("Invalid access token"),
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "success",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetUser(gomock.Any(), userID).
					Return(getSigninUser(userID), nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request:    api.Oauth2UserinfoGetRequestObject{},
			expectedResponse: api.Oauth2UserinfoGet200JSONResponse{
				Sub:                  userID.String(),
				Email:                ptr("jane@acme.com"),
				EmailVerified:        ptr(true),
				Name:                 ptr("Jane Doe"),
				Picture:              nil,
				Locale:               ptr("en"),
				PhoneNumber:          nil,
				PhoneNumberVerified:  nil,
				AdditionalProperties: nil,
			},
		},
		{ //nolint:exhaustruct
			name:   "success - graphql scope",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetUser(gomock.Any(), userID).
					Return(getSigninUser(userID), nil)
				mock.EXPECT().GetUserRoles(gomock.Any(), userID).
					Return([]sql.AuthUserRole{
						{Role: "user"},   //nolint:exhaustruct
						{Role: "editor"}, //nolint:exhaustruct
					}, nil)

				return mock
			},
			jwtTokenFn: func() *jwt.Token {
				return &jwt.Token{
					Raw:    "",
					Method: jwt.SigningMethodHS256,
					Header: map[string]any{
						"alg": "HS256",
						"typ": "JWT",
					},
					Claims: jwt.MapClaims{
						"exp":   float64(time.Now().Add(900 * time.Second).Unix()),
						"iat":   float64(time.Now().Unix()),
						"iss":   "hasura-auth",
						"sub":   userID.String(),
						"scope": "openid graphql",
					},
					Signature: []byte{},
					Valid:     true,
				}
			},
			request: api.Oauth2UserinfoGetRequestObject{},
			expectedResponse: api.Oauth2UserinfoGet200JSONResponse{
				Sub:                 userID.String(),
				Email:               nil,
				EmailVerified:       nil,
				Name:                nil,
				Picture:             nil,
				Locale:              nil,
				PhoneNumber:         nil,
				PhoneNumberVerified: nil,
				AdditionalProperties: map[string]any{
					"https://hasura.io/jwt/claims": map[string]any{
						"x-hasura-user-id":           userID.String(),
						"x-hasura-default-role":      "user",
						"x-hasura-allowed-roles":     []string{"user", "editor"},
						"x-hasura-user-is-anonymous": false,
					},
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "success - graphql with profile and email scopes",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetUser(gomock.Any(), userID).
					Return(getSigninUser(userID), nil)
				mock.EXPECT().GetUserRoles(gomock.Any(), userID).
					Return([]sql.AuthUserRole{
						{Role: "user"},   //nolint:exhaustruct
						{Role: "editor"}, //nolint:exhaustruct
					}, nil)

				return mock
			},
			jwtTokenFn: func() *jwt.Token {
				return &jwt.Token{
					Raw:    "",
					Method: jwt.SigningMethodHS256,
					Header: map[string]any{
						"alg": "HS256",
						"typ": "JWT",
					},
					Claims: jwt.MapClaims{
						"exp":   float64(time.Now().Add(900 * time.Second).Unix()),
						"iat":   float64(time.Now().Unix()),
						"iss":   "hasura-auth",
						"sub":   userID.String(),
						"scope": "openid profile email graphql",
					},
					Signature: []byte{},
					Valid:     true,
				}
			},
			request: api.Oauth2UserinfoGetRequestObject{},
			expectedResponse: api.Oauth2UserinfoGet200JSONResponse{
				Sub:                 userID.String(),
				Email:               ptr("jane@acme.com"),
				EmailVerified:       ptr(true),
				Name:                ptr("Jane Doe"),
				Picture:             nil,
				Locale:              ptr("en"),
				PhoneNumber:         nil,
				PhoneNumberVerified: nil,
				AdditionalProperties: map[string]any{
					"https://hasura.io/jwt/claims": map[string]any{
						"x-hasura-user-id":           userID.String(),
						"x-hasura-default-role":      "user",
						"x-hasura-allowed-roles":     []string{"user", "editor"},
						"x-hasura-user-is-anonymous": false,
					},
				},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db)

			var ctx context.Context
			if tc.jwtTokenFn != nil {
				ctx = jwtGetter.ToContext(t.Context(), tc.jwtTokenFn())
			} else {
				ctx = context.Background()
			}

			assertRequest(
				ctx, t, c.Oauth2UserinfoGet,
				tc.request, tc.expectedResponse,
			)
		})
	}
}

func TestOauth2UserinfoPost(t *testing.T) { //nolint:dupl
	t.Parallel()

	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")

	jwtTokenFn := func() *jwt.Token {
		return &jwt.Token{
			Raw:    "",
			Method: jwt.SigningMethodHS256,
			Header: map[string]any{
				"alg": "HS256",
				"typ": "JWT",
			},
			Claims: jwt.MapClaims{
				"exp":   float64(time.Now().Add(900 * time.Second).Unix()),
				"iat":   float64(time.Now().Unix()),
				"iss":   "hasura-auth",
				"sub":   userID.String(),
				"scope": "openid profile email",
				"https://hasura.io/jwt/claims": map[string]any{
					"x-hasura-allowed-roles":     []any{"user", "me"},
					"x-hasura-default-role":      "user",
					"x-hasura-user-id":           userID.String(),
					"x-hasura-user-is-anonymous": "false",
				},
			},
			Signature: []byte{},
			Valid:     true,
		}
	}

	cases := []testRequest[api.Oauth2UserinfoPostRequestObject, api.Oauth2UserinfoPostResponseObject]{
		{ //nolint:exhaustruct
			name:   "disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2UserinfoPostRequestObject{},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusInternalServerError,
				Body: api.OAuth2ErrorResponse{
					Error:            "server_error",
					ErrorDescription: ptr("OAuth2 provider is disabled"),
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "no jwt in context",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2UserinfoPostRequestObject{},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusUnauthorized,
				Body: api.OAuth2ErrorResponse{
					Error:            "invalid_token",
					ErrorDescription: ptr("Invalid access token"),
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "success",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetUser(gomock.Any(), userID).
					Return(getSigninUser(userID), nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request:    api.Oauth2UserinfoPostRequestObject{},
			expectedResponse: api.Oauth2UserinfoPost200JSONResponse{
				Sub:                  userID.String(),
				Email:                ptr("jane@acme.com"),
				EmailVerified:        ptr(true),
				Name:                 ptr("Jane Doe"),
				Picture:              nil,
				Locale:               ptr("en"),
				PhoneNumber:          nil,
				PhoneNumberVerified:  nil,
				AdditionalProperties: nil,
			},
		},
		{ //nolint:exhaustruct
			name:   "success - graphql scope",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetUser(gomock.Any(), userID).
					Return(getSigninUser(userID), nil)
				mock.EXPECT().GetUserRoles(gomock.Any(), userID).
					Return([]sql.AuthUserRole{
						{Role: "user"},   //nolint:exhaustruct
						{Role: "editor"}, //nolint:exhaustruct
					}, nil)

				return mock
			},
			jwtTokenFn: func() *jwt.Token {
				return &jwt.Token{
					Raw:    "",
					Method: jwt.SigningMethodHS256,
					Header: map[string]any{
						"alg": "HS256",
						"typ": "JWT",
					},
					Claims: jwt.MapClaims{
						"exp":   float64(time.Now().Add(900 * time.Second).Unix()),
						"iat":   float64(time.Now().Unix()),
						"iss":   "hasura-auth",
						"sub":   userID.String(),
						"scope": "openid graphql",
					},
					Signature: []byte{},
					Valid:     true,
				}
			},
			request: api.Oauth2UserinfoPostRequestObject{},
			expectedResponse: api.Oauth2UserinfoPost200JSONResponse{
				Sub:                 userID.String(),
				Email:               nil,
				EmailVerified:       nil,
				Name:                nil,
				Picture:             nil,
				Locale:              nil,
				PhoneNumber:         nil,
				PhoneNumberVerified: nil,
				AdditionalProperties: map[string]any{
					"https://hasura.io/jwt/claims": map[string]any{
						"x-hasura-user-id":           userID.String(),
						"x-hasura-default-role":      "user",
						"x-hasura-allowed-roles":     []string{"user", "editor"},
						"x-hasura-user-is-anonymous": false,
					},
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "success - graphql with profile and email scopes",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetUser(gomock.Any(), userID).
					Return(getSigninUser(userID), nil)
				mock.EXPECT().GetUserRoles(gomock.Any(), userID).
					Return([]sql.AuthUserRole{
						{Role: "user"},   //nolint:exhaustruct
						{Role: "editor"}, //nolint:exhaustruct
					}, nil)

				return mock
			},
			jwtTokenFn: func() *jwt.Token {
				return &jwt.Token{
					Raw:    "",
					Method: jwt.SigningMethodHS256,
					Header: map[string]any{
						"alg": "HS256",
						"typ": "JWT",
					},
					Claims: jwt.MapClaims{
						"exp":   float64(time.Now().Add(900 * time.Second).Unix()),
						"iat":   float64(time.Now().Unix()),
						"iss":   "hasura-auth",
						"sub":   userID.String(),
						"scope": "openid profile email graphql",
					},
					Signature: []byte{},
					Valid:     true,
				}
			},
			request: api.Oauth2UserinfoPostRequestObject{},
			expectedResponse: api.Oauth2UserinfoPost200JSONResponse{
				Sub:                 userID.String(),
				Email:               ptr("jane@acme.com"),
				EmailVerified:       ptr(true),
				Name:                ptr("Jane Doe"),
				Picture:             nil,
				Locale:              ptr("en"),
				PhoneNumber:         nil,
				PhoneNumberVerified: nil,
				AdditionalProperties: map[string]any{
					"https://hasura.io/jwt/claims": map[string]any{
						"x-hasura-user-id":           userID.String(),
						"x-hasura-default-role":      "user",
						"x-hasura-allowed-roles":     []string{"user", "editor"},
						"x-hasura-user-is-anonymous": false,
					},
				},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db)

			var ctx context.Context
			if tc.jwtTokenFn != nil {
				ctx = jwtGetter.ToContext(t.Context(), tc.jwtTokenFn())
			} else {
				ctx = context.Background()
			}

			assertRequest(
				ctx, t, c.Oauth2UserinfoPost,
				tc.request, tc.expectedResponse,
			)
		})
	}
}
