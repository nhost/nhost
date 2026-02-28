package controller_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
)

func TestOauth2Introspect(t *testing.T) { //nolint:maintidx
	t.Parallel()

	clientID := "nhost_abc123def456"
	unknownClientID := "nhost_unknown"
	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
	now := time.Now()
	hint := api.OAuth2IntrospectRequestTokenTypeHintRefreshToken

	publicClient := sql.AuthOauth2Client{ //nolint:exhaustruct
		ClientID: clientID,
	}

	rt := sql.AuthOauth2RefreshToken{
		ID:            uuid.MustParse("33333333-3333-3333-3333-333333333333"),
		TokenHash:     "somehash",
		AuthRequestID: pgtype.UUID{Valid: false}, //nolint:exhaustruct
		ClientID:      clientID,
		UserID:        userID,
		Scopes:        []string{"openid", "profile"},
		CreatedAt: pgtype.Timestamptz{ //nolint:exhaustruct
			Time:  now,
			Valid: true,
		},
		ExpiresAt: pgtype.Timestamptz{ //nolint:exhaustruct
			Time:  now.Add(24 * time.Hour),
			Valid: true,
		},
	}

	otherClientID := "nhost_other_client"

	rtCrossClient := sql.AuthOauth2RefreshToken{
		ID:            uuid.MustParse("33333333-3333-3333-3333-333333333333"),
		TokenHash:     "somehash",
		AuthRequestID: pgtype.UUID{Valid: false}, //nolint:exhaustruct
		ClientID:      otherClientID,
		UserID:        userID,
		Scopes:        []string{"openid", "profile"},
		CreatedAt: pgtype.Timestamptz{ //nolint:exhaustruct
			Time:  now,
			Valid: true,
		},
		ExpiresAt: pgtype.Timestamptz{ //nolint:exhaustruct
			Time:  now.Add(24 * time.Hour),
			Valid: true,
		},
	}

	scope := strings.Join(rt.Scopes, " ")
	sub := userID.String()
	exp := int(rt.ExpiresAt.Time.Unix())
	iat := int(rt.CreatedAt.Time.Unix())
	tokenType := "refresh_token"
	iss := "https://local.auth.nhost.run"

	cases := []testRequest[api.Oauth2IntrospectRequestObject, api.Oauth2IntrospectResponseObject]{
		{ //nolint:exhaustruct
			name:   "disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2IntrospectRequestObject{
				Body: &api.OAuth2IntrospectRequest{ //nolint:exhaustruct
					Token: "some-token",
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
			request: api.Oauth2IntrospectRequestObject{
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
			name:   "missing client_id",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2IntrospectRequestObject{
				Body: &api.OAuth2IntrospectRequest{ //nolint:exhaustruct
					Token: "some-token",
				},
			},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusUnauthorized,
				Body: api.OAuth2ErrorResponse{
					Error:            "invalid_client",
					ErrorDescription: ptr("Client ID is required"),
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "unknown client",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), unknownClientID).
					Return(sql.AuthOauth2Client{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			request: api.Oauth2IntrospectRequestObject{
				Body: &api.OAuth2IntrospectRequest{ //nolint:exhaustruct
					Token:    "some-token",
					ClientId: &unknownClientID,
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
			name:   "refresh token - active",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(publicClient, nil)
				mock.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), gomock.Any()).
					Return(rt, nil)

				return mock
			},
			request: api.Oauth2IntrospectRequestObject{
				Body: &api.OAuth2IntrospectRequest{ //nolint:exhaustruct
					Token:         "some-refresh-token",
					TokenTypeHint: &hint,
					ClientId:      &clientID,
				},
			},
			expectedResponse: api.Oauth2Introspect200JSONResponse{
				Active:    true,
				ClientId:  &clientID,
				Sub:       &sub,
				Scope:     &scope,
				Exp:       &exp,
				Iat:       &iat,
				Iss:       &iss,
				TokenType: &tokenType,
			},
		},
		{ //nolint:exhaustruct
			name:   "refresh token - cross-client returns inactive",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(publicClient, nil)
				mock.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), gomock.Any()).
					Return(rtCrossClient, nil)

				return mock
			},
			request: api.Oauth2IntrospectRequestObject{
				Body: &api.OAuth2IntrospectRequest{ //nolint:exhaustruct
					Token:         "some-refresh-token",
					TokenTypeHint: &hint,
					ClientId:      &clientID,
				},
			},
			expectedResponse: api.Oauth2Introspect200JSONResponse{ //nolint:exhaustruct
				Active: false,
			},
		},
		{ //nolint:exhaustruct
			name:   "unknown refresh token - inactive",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(publicClient, nil)
				mock.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2RefreshToken{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			request: api.Oauth2IntrospectRequestObject{
				Body: &api.OAuth2IntrospectRequest{ //nolint:exhaustruct
					Token:         "unknown-token",
					TokenTypeHint: &hint,
					ClientId:      &clientID,
				},
			},
			expectedResponse: api.Oauth2Introspect200JSONResponse{ //nolint:exhaustruct
				Active: false,
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, _ := getController(t, ctrl, tc.config, tc.db)

			assertRequest(
				context.Background(), t, c.Oauth2Introspect,
				tc.request, tc.expectedResponse,
			)
		})
	}

	t.Run("dual credentials", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		c, _ := getController(
			t,
			ctrl,
			getConfigOAuth2Enabled,
			func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
		)

		bodyClientID := "body-client-id"

		w := httptest.NewRecorder()
		ginCtx, _ := gin.CreateTestContext(w)
		ginCtx.Request = httptest.NewRequest(
			http.MethodPost, "/oauth2/introspect", nil,
		)
		ginCtx.Request.SetBasicAuth("header-client-id", "header-client-secret")

		assertRequest[api.Oauth2IntrospectRequestObject, api.Oauth2IntrospectResponseObject](
			ginCtx, t, c.Oauth2Introspect,
			api.Oauth2IntrospectRequestObject{
				Body: &api.OAuth2IntrospectRequest{ //nolint:exhaustruct
					Token:    "some-token",
					ClientId: &bodyClientID,
				},
			},
			controller.OAuth2ErrorResponse{
				StatusCode: http.StatusBadRequest,
				Body: api.OAuth2ErrorResponse{
					Error: "invalid_request",
					ErrorDescription: ptr(
						"client credentials MUST NOT be provided in " +
							"both the Authorization header and the request body",
					),
				},
			},
		)
	})
}
