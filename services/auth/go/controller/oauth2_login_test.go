package controller_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
)

func TestOauth2LoginGet(t *testing.T) {
	t.Parallel()

	requestID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	clientID := "nhost_abc123def456"

	authReq := sql.AuthOauth2AuthRequest{
		ID:                  requestID,
		ClientID:            clientID,
		Scopes:              []string{"openid", "profile"},
		RedirectUri:         "https://example.com/callback",
		State:               pgtype.Text{String: "test-state", Valid: true},
		Nonce:               pgtype.Text{String: "", Valid: false},
		ResponseType:        "code",
		CodeChallenge:       pgtype.Text{String: "", Valid: false},
		CodeChallengeMethod: pgtype.Text{String: "", Valid: false},
		Resource:            pgtype.Text{String: "", Valid: false},
		UserID:              pgtype.UUID{Valid: false}, //nolint:exhaustruct
		Done:                false,
		AuthTime:            pgtype.Timestamptz{Valid: false},                  //nolint:exhaustruct
		CreatedAt:           pgtype.Timestamptz{Time: time.Now(), Valid: true}, //nolint:exhaustruct
		ExpiresAt: pgtype.Timestamptz{ //nolint:exhaustruct
			Time:  time.Now().Add(10 * time.Minute),
			Valid: true,
		},
	}

	client := testOAuth2Client()
	client.ClientID = clientID

	scopes := []string{"openid", "profile"}

	cases := []testRequest[api.Oauth2LoginGetRequestObject, api.Oauth2LoginGetResponseObject]{
		{ //nolint:exhaustruct
			name:   "disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2LoginGetRequestObject{
				Params: api.Oauth2LoginGetParams{
					RequestId: requestID,
				},
			},
			expectedResponse: api.Oauth2LoginGetdefaultJSONResponse{
				StatusCode: http.StatusBadRequest,
				Body: api.ErrorResponse{
					Status:  http.StatusBadRequest,
					Error:   api.DisabledEndpoint,
					Message: "OAuth2 provider is disabled",
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "request not found",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetOAuth2AuthRequest(gomock.Any(), requestID).
					Return(sql.AuthOauth2AuthRequest{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			request: api.Oauth2LoginGetRequestObject{
				Params: api.Oauth2LoginGetParams{
					RequestId: requestID,
				},
			},
			expectedResponse: api.Oauth2LoginGetdefaultJSONResponse{
				StatusCode: http.StatusBadRequest,
				Body: api.ErrorResponse{
					Status:  http.StatusBadRequest,
					Error:   api.InvalidRequest,
					Message: "Unknown authorization request",
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "success",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetOAuth2AuthRequest(gomock.Any(), requestID).
					Return(authReq, nil)
				mock.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(client, nil)

				return mock
			},
			request: api.Oauth2LoginGetRequestObject{
				Params: api.Oauth2LoginGetParams{
					RequestId: requestID,
				},
			},
			expectedResponse: api.Oauth2LoginGet200JSONResponse{
				RequestId:   requestID,
				ClientId:    clientID,
				RedirectUri: "https://example.com/callback",
				Scopes:      scopes,
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, _ := getController(t, ctrl, tc.config, tc.db)

			assertRequest(
				context.Background(), t, c.Oauth2LoginGet,
				tc.request, tc.expectedResponse,
			)
		})
	}
}

func TestOauth2LoginPost(t *testing.T) {
	t.Parallel()

	requestID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
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
				"exp": float64(time.Now().Add(900 * time.Second).Unix()),
				"https://hasura.io/jwt/claims": map[string]any{
					"x-hasura-allowed-roles":     []any{"user", "me"},
					"x-hasura-default-role":      "user",
					"x-hasura-user-id":           userID.String(),
					"x-hasura-user-is-anonymous": "false",
				},
				"iat": float64(time.Now().Unix()),
				"iss": "hasura-auth",
				"sub": userID.String(),
			},
			Signature: []byte{},
			Valid:     true,
		}
	}

	cases := []testRequest[api.Oauth2LoginPostRequestObject, api.Oauth2LoginPostResponseObject]{
		{ //nolint:exhaustruct
			name:   "disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2LoginPostRequestObject{
				Body: &api.OAuth2LoginRequest{
					RequestId: requestID,
				},
			},
			expectedResponse: api.Oauth2LoginPostdefaultJSONResponse{
				StatusCode: http.StatusBadRequest,
				Body: api.ErrorResponse{
					Status:  http.StatusBadRequest,
					Error:   api.DisabledEndpoint,
					Message: "OAuth2 provider is disabled",
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "missing body",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2LoginPostRequestObject{
				Body: nil,
			},
			expectedResponse: api.Oauth2LoginPostdefaultJSONResponse{
				StatusCode: http.StatusBadRequest,
				Body: api.ErrorResponse{
					Status:  http.StatusBadRequest,
					Error:   api.InvalidRequest,
					Message: "Missing request body",
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "unauthenticated",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2LoginPostRequestObject{
				Body: &api.OAuth2LoginRequest{
					RequestId: requestID,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Status:  http.StatusBadRequest,
				Error:   api.InvalidRequest,
				Message: "The request payload is incorrect",
			},
		},
		{ //nolint:exhaustruct
			name:   "complete login request not found",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetUser(gomock.Any(), userID).
					Return(getSigninUser(userID), nil)
				mock.EXPECT().GetOAuth2AuthRequest(gomock.Any(), requestID).
					Return(sql.AuthOauth2AuthRequest{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.Oauth2LoginPostRequestObject{
				Body: &api.OAuth2LoginRequest{
					RequestId: requestID,
				},
			},
			expectedResponse: api.Oauth2LoginPostdefaultJSONResponse{
				StatusCode: http.StatusBadRequest,
				Body: api.ErrorResponse{
					Status:  http.StatusBadRequest,
					Error:   api.InvalidRequest,
					Message: "Unknown authorization request",
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "success",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				authReq := sql.AuthOauth2AuthRequest{
					ID:                  requestID,
					ClientID:            "nhost_abc123def456",
					Scopes:              []string{"openid", "profile"},
					RedirectUri:         "https://example.com/callback",
					State:               pgtype.Text{String: "test-state", Valid: true},
					Nonce:               pgtype.Text{String: "", Valid: false},
					ResponseType:        "code",
					CodeChallenge:       pgtype.Text{String: "", Valid: false},
					CodeChallengeMethod: pgtype.Text{String: "", Valid: false},
					Resource:            pgtype.Text{String: "", Valid: false},
					UserID:              pgtype.UUID{Valid: false}, //nolint:exhaustruct
					Done:                false,
					AuthTime: pgtype.Timestamptz{ //nolint:exhaustruct
						Valid: false,
					},
					CreatedAt: pgtype.Timestamptz{ //nolint:exhaustruct
						Time:  time.Now(),
						Valid: true,
					},
					ExpiresAt: pgtype.Timestamptz{ //nolint:exhaustruct
						Time:  time.Now().Add(10 * time.Minute),
						Valid: true,
					},
				}

				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetUser(gomock.Any(), userID).
					Return(getSigninUser(userID), nil)
				mock.EXPECT().GetOAuth2AuthRequest(gomock.Any(), requestID).
					Return(authReq, nil)
				mock.EXPECT().CompleteOAuth2LoginAndInsertCode(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2AuthorizationCode{}, nil) //nolint:exhaustruct

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.Oauth2LoginPostRequestObject{
				Body: &api.OAuth2LoginRequest{
					RequestId: requestID,
				},
			},
			expectedResponse: api.Oauth2LoginPost200JSONResponse{
				RedirectUri: "", // dynamic - checked via cmp option
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
				ctx, t, c.Oauth2LoginPost,
				tc.request, tc.expectedResponse,
				cmpopts.IgnoreFields(
					api.Oauth2LoginPost200JSONResponse{}, "RedirectUri", //nolint:exhaustruct
				),
				cmp.FilterPath(
					func(p cmp.Path) bool {
						return p.Last().String() == ".RedirectUri"
					},
					cmp.Ignore(),
				),
			)
		})
	}
}
