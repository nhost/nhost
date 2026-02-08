package controller_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
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
				ClientName:  client.ClientName,
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

	t.Run("disabled", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		c, _ := getController(
			t,
			ctrl,
			getConfig,
			func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
		)

		resp, err := c.Oauth2LoginPost(context.Background(), api.Oauth2LoginPostRequestObject{
			Body: &api.OAuth2LoginRequest{
				RequestId: requestID,
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		expected := api.Oauth2LoginPostdefaultJSONResponse{
			StatusCode: http.StatusBadRequest,
			Body: api.ErrorResponse{
				Status:  http.StatusBadRequest,
				Error:   api.DisabledEndpoint,
				Message: "OAuth2 provider is disabled",
			},
		}

		if diff := cmp.Diff(expected, resp); diff != "" {
			t.Errorf("unexpected response (-want +got):\n%s", diff)
		}
	})

	t.Run("missing body", func(t *testing.T) {
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

		resp, err := c.Oauth2LoginPost(context.Background(), api.Oauth2LoginPostRequestObject{
			Body: nil,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		expected := api.Oauth2LoginPostdefaultJSONResponse{
			StatusCode: http.StatusBadRequest,
			Body: api.ErrorResponse{
				Status:  http.StatusBadRequest,
				Error:   api.InvalidRequest,
				Message: "Missing request body",
			},
		}

		if diff := cmp.Diff(expected, resp); diff != "" {
			t.Errorf("unexpected response (-want +got):\n%s", diff)
		}
	})

	t.Run("unauthenticated", func(t *testing.T) {
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

		resp, err := c.Oauth2LoginPost(context.Background(), api.Oauth2LoginPostRequestObject{
			Body: &api.OAuth2LoginRequest{
				RequestId: requestID,
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		expected := api.Oauth2LoginPostdefaultJSONResponse{
			StatusCode: http.StatusUnauthorized,
			Body: api.ErrorResponse{
				Status:  http.StatusUnauthorized,
				Error:   api.InvalidRequest,
				Message: "Authentication required",
			},
		}

		if diff := cmp.Diff(expected, resp); diff != "" {
			t.Errorf("unexpected response (-want +got):\n%s", diff)
		}
	})

	t.Run("success", func(t *testing.T) {
		t.Parallel()

		userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
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

		ctrl := gomock.NewController(t)

		db := mock.NewMockDBClient(ctrl)
		db.EXPECT().GetOAuth2AuthRequest(gomock.Any(), requestID).
			Return(authReq, nil)
		db.EXPECT().UpdateOAuth2AuthRequestSetUser(gomock.Any(), gomock.Any()).
			Return(authReq, nil)
		db.EXPECT().InsertOAuth2AuthorizationCode(gomock.Any(), gomock.Any()).
			Return(sql.AuthOauth2AuthorizationCode{}, nil) //nolint:exhaustruct

		c, jwtGetter := getController(
			t,
			ctrl,
			getConfigOAuth2Enabled,
			func(_ *gomock.Controller) controller.DBClient {
				return db
			},
		)

		jwtToken := &jwt.Token{
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

		ctx := jwtGetter.ToContext(context.Background(), jwtToken)

		resp, err := c.Oauth2LoginPost(ctx, api.Oauth2LoginPostRequestObject{
			Body: &api.OAuth2LoginRequest{
				RequestId: requestID,
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		successResp, ok := resp.(api.Oauth2LoginPost200JSONResponse)
		if !ok {
			t.Fatalf("expected 200 response, got %T: %+v", resp, resp)
		}

		if successResp.RedirectUri == "" {
			t.Error("expected non-empty redirect URI")
		}
	})
}
