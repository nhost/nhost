package controller_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	oauth2provider "github.com/nhost/nhost/services/auth/go/oauth2"
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
)

func TestOauth2Authorize(t *testing.T) {
	t.Parallel()

	clientID := "nhost_abc123def456"
	redirectURI := "https://example.com/callback"
	state := "test-state"
	responseType := "code"
	issuer := "https://local.auth.nhost.run"

	client := testOAuth2Client()
	client.ClientID = clientID

	cases := []testRequest[api.Oauth2AuthorizeRequestObject, api.Oauth2AuthorizeResponseObject]{
		{ //nolint:exhaustruct
			name:   "disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2AuthorizeRequestObject{
				Params: api.Oauth2AuthorizeParams{ //nolint:exhaustruct
					ClientId:     clientID,
					RedirectUri:  redirectURI,
					ResponseType: responseType,
					State:        &state,
				},
			},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusInternalServerError,
				Body: api.OAuth2ErrorResponse{
					Error:            "server_error",
					ErrorDescription: ptr("OAuth2 provider is disabled"),
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "success",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				db := mock.NewMockDBClient(ctrl)
				db.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(client, nil)
				db.EXPECT().InsertOAuth2AuthRequest(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
						ID:          uuid.MustParse("22222222-2222-2222-2222-222222222222"),
						ClientID:    clientID,
						RedirectUri: redirectURI,
						CreatedAt: pgtype.Timestamptz{ //nolint:exhaustruct
							Time:  time.Now(),
							Valid: true,
						},
						ExpiresAt: pgtype.Timestamptz{ //nolint:exhaustruct
							Time:  time.Now().Add(10 * time.Minute),
							Valid: true,
						},
					}, nil)

				return db
			},
			request: api.Oauth2AuthorizeRequestObject{
				Params: api.Oauth2AuthorizeParams{ //nolint:exhaustruct
					ClientId:            clientID,
					RedirectUri:         redirectURI,
					ResponseType:        responseType,
					State:               &state,
					CodeChallenge:       ptr("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"),
					CodeChallengeMethod: ptr(api.S256),
				},
			},
			expectedResponse: api.Oauth2Authorize302Response{
				Headers: api.Oauth2Authorize302ResponseHeaders{
					Location: "https://auth.example.com/oauth2/consent" +
						"?request_id=22222222-2222-2222-2222-222222222222",
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "invalid client",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				db := mock.NewMockDBClient(ctrl)
				db.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), "unknown_client").
					Return(sql.AuthOauth2Client{}, pgx.ErrNoRows) //nolint:exhaustruct

				return db
			},
			request: api.Oauth2AuthorizeRequestObject{
				Params: api.Oauth2AuthorizeParams{ //nolint:exhaustruct
					ClientId:     "unknown_client",
					RedirectUri:  redirectURI,
					ResponseType: responseType,
					State:        &state,
				},
			},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusUnauthorized,
				Body: api.OAuth2ErrorResponse{
					Error:            "invalid_client",
					ErrorDescription: ptr("Unknown client"),
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "empty response_type redirects",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				db := mock.NewMockDBClient(ctrl)
				db.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(client, nil)

				return db
			},
			request: api.Oauth2AuthorizeRequestObject{
				Params: api.Oauth2AuthorizeParams{ //nolint:exhaustruct
					ClientId:     clientID,
					RedirectUri:  redirectURI,
					ResponseType: "",
					State:        &state,
				},
			},
			expectedResponse: api.Oauth2Authorize302Response{
				Headers: api.Oauth2Authorize302ResponseHeaders{
					Location: oauth2provider.ErrorRedirectURL(
						redirectURI, state, issuer,
						&oauth2provider.Error{
							Err:         "unsupported_response_type",
							Description: "Only response_type=code is supported",
						},
					),
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "empty response_type without state",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				db := mock.NewMockDBClient(ctrl)
				db.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(client, nil)

				return db
			},
			request: api.Oauth2AuthorizeRequestObject{
				Params: api.Oauth2AuthorizeParams{ //nolint:exhaustruct
					ClientId:     clientID,
					RedirectUri:  redirectURI,
					ResponseType: "",
					State:        nil,
				},
			},
			expectedResponse: api.Oauth2Authorize302Response{
				Headers: api.Oauth2Authorize302ResponseHeaders{
					Location: oauth2provider.ErrorRedirectURL(
						redirectURI, "", issuer,
						&oauth2provider.Error{
							Err:         "unsupported_response_type",
							Description: "Only response_type=code is supported",
						},
					),
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "unsupported response_type redirects",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				db := mock.NewMockDBClient(ctrl)
				db.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(client, nil)

				return db
			},
			request: api.Oauth2AuthorizeRequestObject{
				Params: api.Oauth2AuthorizeParams{ //nolint:exhaustruct
					ClientId:     clientID,
					RedirectUri:  redirectURI,
					ResponseType: "token",
					State:        &state,
				},
			},
			expectedResponse: api.Oauth2Authorize302Response{
				Headers: api.Oauth2Authorize302ResponseHeaders{
					Location: oauth2provider.ErrorRedirectURL(
						redirectURI, state, issuer,
						&oauth2provider.Error{
							Err:         "unsupported_response_type",
							Description: "Only response_type=code is supported",
						},
					),
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "public client without PKCE redirects with error",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				db := mock.NewMockDBClient(ctrl)
				db.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(client, nil)

				return db
			},
			request: api.Oauth2AuthorizeRequestObject{
				Params: api.Oauth2AuthorizeParams{ //nolint:exhaustruct
					ClientId:     clientID,
					RedirectUri:  redirectURI,
					ResponseType: responseType,
					State:        &state,
				},
			},
			expectedResponse: api.Oauth2Authorize302Response{
				Headers: api.Oauth2Authorize302ResponseHeaders{
					Location: oauth2provider.ErrorRedirectURL(
						redirectURI, state, issuer,
						&oauth2provider.Error{
							Err:         "invalid_request",
							Description: "PKCE code_challenge is required for public clients",
						},
					),
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "invalid scope redirects",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				db := mock.NewMockDBClient(ctrl)
				db.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(client, nil)

				return db
			},
			request: api.Oauth2AuthorizeRequestObject{
				Params: api.Oauth2AuthorizeParams{ //nolint:exhaustruct
					ClientId:     clientID,
					RedirectUri:  redirectURI,
					ResponseType: responseType,
					Scope:        ptr("openid invalid_scope"),
					State:        &state,
				},
			},
			expectedResponse: api.Oauth2Authorize302Response{
				Headers: api.Oauth2Authorize302ResponseHeaders{
					Location: oauth2provider.ErrorRedirectURL(
						redirectURI, state, issuer,
						&oauth2provider.Error{
							Err:         "invalid_scope",
							Description: `Scope "invalid_scope" not allowed for this client`,
						},
					),
				},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, _ := getController(t, ctrl, tc.config, tc.db)

			assertRequest(
				context.Background(), t, c.Oauth2Authorize,
				tc.request, tc.expectedResponse,
			)
		})
	}
}

func TestOauth2AuthorizePost(t *testing.T) {
	t.Parallel()

	clientID := "nhost_abc123def456"
	redirectURI := "https://example.com/callback"
	state := "test-state"
	issuer := "https://local.auth.nhost.run"

	client := testOAuth2Client()
	client.ClientID = clientID

	cases := []testRequest[api.Oauth2AuthorizePostRequestObject, api.Oauth2AuthorizePostResponseObject]{
		{ //nolint:exhaustruct
			name:   "disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2AuthorizePostRequestObject{
				Body: &api.Oauth2AuthorizePostFormdataRequestBody{ //nolint:exhaustruct
					ClientId:     clientID,
					RedirectUri:  redirectURI,
					ResponseType: "code",
					State:        &state,
				},
			},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusInternalServerError,
				Body: api.OAuth2ErrorResponse{
					Error:            "server_error",
					ErrorDescription: ptr("OAuth2 provider is disabled"),
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "missing body",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2AuthorizePostRequestObject{
				Body: nil,
			},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusBadRequest,
				Body: api.OAuth2ErrorResponse{
					Error:            "invalid_request",
					ErrorDescription: ptr("Missing request body"),
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "invalid client",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				db := mock.NewMockDBClient(ctrl)
				db.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), "unknown_client").
					Return(sql.AuthOauth2Client{}, pgx.ErrNoRows) //nolint:exhaustruct

				return db
			},
			request: api.Oauth2AuthorizePostRequestObject{
				Body: &api.Oauth2AuthorizePostFormdataRequestBody{ //nolint:exhaustruct
					ClientId:     "unknown_client",
					RedirectUri:  redirectURI,
					ResponseType: "code",
					State:        &state,
				},
			},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusUnauthorized,
				Body: api.OAuth2ErrorResponse{
					Error:            "invalid_client",
					ErrorDescription: ptr("Unknown client"),
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "unsupported response_type redirects",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				db := mock.NewMockDBClient(ctrl)
				db.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(client, nil)

				return db
			},
			request: api.Oauth2AuthorizePostRequestObject{
				Body: &api.Oauth2AuthorizePostFormdataRequestBody{ //nolint:exhaustruct
					ClientId:     clientID,
					RedirectUri:  redirectURI,
					ResponseType: "token",
					State:        &state,
				},
			},
			expectedResponse: api.Oauth2AuthorizePost302Response{
				Headers: api.Oauth2AuthorizePost302ResponseHeaders{
					Location: oauth2provider.ErrorRedirectURL(
						redirectURI, state, issuer,
						&oauth2provider.Error{
							Err:         "unsupported_response_type",
							Description: "Only response_type=code is supported",
						},
					),
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "success",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				db := mock.NewMockDBClient(ctrl)
				db.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(client, nil)
				db.EXPECT().InsertOAuth2AuthRequest(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
						ID:          uuid.MustParse("22222222-2222-2222-2222-222222222222"),
						ClientID:    clientID,
						RedirectUri: redirectURI,
						CreatedAt: pgtype.Timestamptz{ //nolint:exhaustruct
							Time:  time.Now(),
							Valid: true,
						},
						ExpiresAt: pgtype.Timestamptz{ //nolint:exhaustruct
							Time:  time.Now().Add(10 * time.Minute),
							Valid: true,
						},
					}, nil)

				return db
			},
			request: api.Oauth2AuthorizePostRequestObject{
				Body: &api.Oauth2AuthorizePostFormdataRequestBody{ //nolint:exhaustruct
					ClientId:            clientID,
					RedirectUri:         redirectURI,
					ResponseType:        "code",
					State:               &state,
					CodeChallenge:       ptr("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"),
					CodeChallengeMethod: ptr("S256"),
				},
			},
			expectedResponse: api.Oauth2AuthorizePost302Response{
				Headers: api.Oauth2AuthorizePost302ResponseHeaders{
					Location: "https://auth.example.com/oauth2/consent" +
						"?request_id=22222222-2222-2222-2222-222222222222",
				},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, _ := getController(t, ctrl, tc.config, tc.db)

			assertRequest(
				context.Background(), t, c.Oauth2AuthorizePost,
				tc.request, tc.expectedResponse,
			)
		})
	}
}
