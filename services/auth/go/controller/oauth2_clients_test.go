package controller_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
)

func testOAuth2Client() sql.AuthOauth2Client {
	now := time.Now()

	return sql.AuthOauth2Client{
		ID:                       uuid.MustParse("a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
		ClientID:                 "nhost_abc123def456",
		ClientSecretHash:         pgtype.Text{String: "", Valid: false},
		ClientName:               "Test App",
		ClientUri:                pgtype.Text{String: "https://example.com", Valid: true},
		LogoUri:                  pgtype.Text{String: "", Valid: false},
		RedirectUris:             []string{"https://example.com/callback"},
		GrantTypes:               []string{"authorization_code"},
		ResponseTypes:            []string{"code"},
		Scopes:                   []string{"openid", "profile", "email"},
		IsPublic:                 true,
		TokenEndpointAuthMethod:  "none",
		IDTokenSignedResponseAlg: "RS256",
		AccessTokenLifetime:      900,
		RefreshTokenLifetime:     2592000,
		CreatedBy:                pgtype.UUID{},                              //nolint:exhaustruct
		CreatedAt:                pgtype.Timestamptz{Time: now, Valid: true}, //nolint:exhaustruct
		UpdatedAt:                pgtype.Timestamptz{Time: now, Valid: true}, //nolint:exhaustruct
	}
}

func TestOauth2ClientsList(t *testing.T) {
	t.Parallel()

	client := testOAuth2Client()

	accessTokenLifetime := int(client.AccessTokenLifetime)
	refreshTokenLifetime := int(client.RefreshTokenLifetime)
	isPublic := true
	authMethod := "none"
	clientURI := "https://example.com"

	cases := []testRequest[api.Oauth2ClientsListRequestObject, api.Oauth2ClientsListResponseObject]{
		{ //nolint:exhaustruct
			name:   "disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2ClientsListRequestObject{},
			expectedResponse: api.Oauth2ClientsListdefaultJSONResponse{
				StatusCode: http.StatusBadRequest,
				Body: api.ErrorResponse{
					Status:  http.StatusBadRequest,
					Error:   api.InvalidRequest,
					Message: "OAuth2 provider is disabled",
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "success - empty list",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().ListOAuth2Clients(gomock.Any()).
					Return([]sql.AuthOauth2Client{}, nil)

				return mock
			},
			request: api.Oauth2ClientsListRequestObject{},
			expectedResponse: api.Oauth2ClientsList200JSONResponse{
				Clients: []api.OAuth2ClientResponse{},
			},
		},
		{ //nolint:exhaustruct
			name:   "success - with clients",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().ListOAuth2Clients(gomock.Any()).
					Return([]sql.AuthOauth2Client{client}, nil)

				return mock
			},
			request: api.Oauth2ClientsListRequestObject{},
			expectedResponse: api.Oauth2ClientsList200JSONResponse{
				Clients: []api.OAuth2ClientResponse{
					{ //nolint:exhaustruct
						ClientId:                client.ClientID,
						ClientName:              client.ClientName,
						ClientUri:               &clientURI,
						RedirectUris:            client.RedirectUris,
						GrantTypes:              &client.GrantTypes,
						ResponseTypes:           &client.ResponseTypes,
						Scopes:                  &client.Scopes,
						IsPublic:                &isPublic,
						TokenEndpointAuthMethod: &authMethod,
						AccessTokenLifetime:     &accessTokenLifetime,
						RefreshTokenLifetime:    &refreshTokenLifetime,
						CreatedAt:               &client.CreatedAt.Time,
						UpdatedAt:               &client.UpdatedAt.Time,
					},
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
				context.Background(), t, c.Oauth2ClientsList,
				tc.request, tc.expectedResponse,
			)
		})
	}
}

func TestOauth2ClientsGet(t *testing.T) {
	t.Parallel()

	client := testOAuth2Client()

	cases := []testRequest[api.Oauth2ClientsGetRequestObject, api.Oauth2ClientsGetResponseObject]{
		{ //nolint:exhaustruct
			name:   "disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2ClientsGetRequestObject{
				ClientId: "nhost_abc123def456",
			},
			expectedResponse: api.Oauth2ClientsGetdefaultJSONResponse{
				StatusCode: http.StatusBadRequest,
				Body: api.ErrorResponse{
					Status:  http.StatusBadRequest,
					Error:   api.InvalidRequest,
					Message: "OAuth2 provider is disabled",
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "not found",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), "nhost_notexist").
					Return(sql.AuthOauth2Client{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			request: api.Oauth2ClientsGetRequestObject{
				ClientId: "nhost_notexist",
			},
			expectedResponse: api.Oauth2ClientsGetdefaultJSONResponse{
				StatusCode: http.StatusNotFound,
				Body: api.ErrorResponse{
					Status:  http.StatusNotFound,
					Error:   api.InvalidRequest,
					Message: "Client not found",
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "success",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), client.ClientID).
					Return(client, nil)

				return mock
			},
			request: api.Oauth2ClientsGetRequestObject{
				ClientId: client.ClientID,
			},
			expectedResponse: api.Oauth2ClientsGet200JSONResponse(clientToExpectedResponse(client)),
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, _ := getController(t, ctrl, tc.config, tc.db)

			assertRequest(
				context.Background(), t, c.Oauth2ClientsGet,
				tc.request, tc.expectedResponse,
			)
		})
	}
}

func TestOauth2ClientsDelete(t *testing.T) {
	t.Parallel()

	cases := []testRequest[api.Oauth2ClientsDeleteRequestObject, api.Oauth2ClientsDeleteResponseObject]{
		{ //nolint:exhaustruct
			name:   "disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2ClientsDeleteRequestObject{
				ClientId: "nhost_abc123def456",
			},
			expectedResponse: api.Oauth2ClientsDeletedefaultJSONResponse{
				StatusCode: http.StatusBadRequest,
				Body: api.ErrorResponse{
					Status:  http.StatusBadRequest,
					Error:   api.InvalidRequest,
					Message: "OAuth2 provider is disabled",
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "success",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().DeleteOAuth2Client(gomock.Any(), "nhost_abc123def456").
					Return(nil)

				return mock
			},
			request: api.Oauth2ClientsDeleteRequestObject{
				ClientId: "nhost_abc123def456",
			},
			expectedResponse: api.Oauth2ClientsDelete204Response{},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, _ := getController(t, ctrl, tc.config, tc.db)

			assertRequest(
				context.Background(), t, c.Oauth2ClientsDelete,
				tc.request, tc.expectedResponse,
			)
		})
	}
}

func TestOauth2ClientsCreate(t *testing.T) { //nolint:cyclop
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
				"exp": float64(time.Now().Add(900 * time.Second).Unix()),
				"https://hasura.io/jwt/claims": map[string]any{
					"x-hasura-allowed-roles":     []any{"user", "me"},
					"x-hasura-default-role":      "user",
					"x-hasura-user-id":           "db477732-48fa-4289-b694-2886a646b6eb",
					"x-hasura-user-is-anonymous": "false",
				},
				"iat": float64(time.Now().Unix()),
				"iss": "hasura-auth",
				"sub": "db477732-48fa-4289-b694-2886a646b6eb",
			},
			Signature: []byte{},
			Valid:     true,
		}
	}

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

		resp, err := c.Oauth2ClientsCreate(
			context.Background(),
			api.Oauth2ClientsCreateRequestObject{
				Body: &api.OAuth2CreateClientRequest{ //nolint:exhaustruct
					ClientName:   "Test App",
					RedirectUris: []string{"https://example.com/callback"},
				},
			},
		)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		defaultResp, ok := resp.(api.Oauth2ClientsCreatedefaultJSONResponse)
		if !ok {
			t.Fatalf("expected default JSON response, got %T", resp)
		}

		if defaultResp.StatusCode != http.StatusBadRequest {
			t.Errorf("expected status %d, got %d", http.StatusBadRequest, defaultResp.StatusCode)
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

		resp, err := c.Oauth2ClientsCreate(
			context.Background(),
			api.Oauth2ClientsCreateRequestObject{
				Body: &api.OAuth2CreateClientRequest{ //nolint:exhaustruct
					ClientName:   "Test App",
					RedirectUris: []string{"https://example.com/callback"},
				},
			},
		)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		defaultResp, ok := resp.(api.Oauth2ClientsCreatedefaultJSONResponse)
		if !ok {
			t.Fatalf("expected default JSON response, got %T", resp)
		}

		if defaultResp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected status %d, got %d", http.StatusUnauthorized, defaultResp.StatusCode)
		}
	})

	t.Run("missing body", func(t *testing.T) { //nolint:dupl
		t.Parallel()

		ctrl := gomock.NewController(t)

		db := mock.NewMockDBClient(ctrl)
		db.EXPECT().GetUser(gomock.Any(), userID).
			Return(sql.AuthUser{ //nolint:exhaustruct
				ID:    userID,
				Email: sql.Text("jane@acme.com"),
			}, nil)

		c, jwtGetter := getController(
			t, ctrl, getConfigOAuth2Enabled,
			func(_ *gomock.Controller) controller.DBClient { return db },
		)

		ctx := jwtGetter.ToContext(context.Background(), jwtTokenFn())

		resp, err := c.Oauth2ClientsCreate(ctx, api.Oauth2ClientsCreateRequestObject{Body: nil})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		defaultResp, ok := resp.(api.Oauth2ClientsCreatedefaultJSONResponse)
		if !ok {
			t.Fatalf("expected default JSON response, got %T", resp)
		}

		if defaultResp.StatusCode != http.StatusBadRequest {
			t.Errorf("expected status %d, got %d", http.StatusBadRequest, defaultResp.StatusCode)
		}
	})

	t.Run("success - public client", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		db := mock.NewMockDBClient(ctrl)
		db.EXPECT().GetUser(gomock.Any(), userID).
			Return(sql.AuthUser{ //nolint:exhaustruct
				ID:    userID,
				Email: sql.Text("jane@acme.com"),
			}, nil)
		db.EXPECT().InsertOAuth2Client(gomock.Any(), gomock.Any()).
			Return(testOAuth2Client(), nil)

		c, jwtGetter := getController(
			t, ctrl, getConfigOAuth2Enabled,
			func(_ *gomock.Controller) controller.DBClient { return db },
		)

		ctx := jwtGetter.ToContext(context.Background(), jwtTokenFn())

		isPublic := true

		resp, err := c.Oauth2ClientsCreate(ctx, api.Oauth2ClientsCreateRequestObject{
			Body: &api.OAuth2CreateClientRequest{ //nolint:exhaustruct
				ClientName:   "Test App",
				RedirectUris: []string{"https://example.com/callback"},
				IsPublic:     &isPublic,
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		createResp, ok := resp.(api.Oauth2ClientsCreate201JSONResponse)
		if !ok {
			t.Fatalf("expected 201 response, got %T: %+v", resp, resp)
		}

		if createResp.ClientSecret != nil {
			t.Error("expected no client_secret for public client")
		}
	})

	t.Run("success - confidential client", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		confidentialClient := testOAuth2Client()
		confidentialClient.IsPublic = false
		confidentialClient.TokenEndpointAuthMethod = "client_secret_post"
		confidentialClient.ClientSecretHash = sql.Text("$2a$10$hashedvalue")

		db := mock.NewMockDBClient(ctrl)
		db.EXPECT().GetUser(gomock.Any(), userID).
			Return(sql.AuthUser{ //nolint:exhaustruct
				ID:    userID,
				Email: sql.Text("jane@acme.com"),
			}, nil)
		db.EXPECT().InsertOAuth2Client(gomock.Any(), gomock.Any()).
			Return(confidentialClient, nil)

		c, jwtGetter := getController(
			t, ctrl, getConfigOAuth2Enabled,
			func(_ *gomock.Controller) controller.DBClient { return db },
		)

		ctx := jwtGetter.ToContext(context.Background(), jwtTokenFn())

		resp, err := c.Oauth2ClientsCreate(ctx, api.Oauth2ClientsCreateRequestObject{
			Body: &api.OAuth2CreateClientRequest{ //nolint:exhaustruct
				ClientName:   "Confidential App",
				RedirectUris: []string{"https://example.com/callback"},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		createResp, ok := resp.(api.Oauth2ClientsCreate201JSONResponse)
		if !ok {
			t.Fatalf("expected 201 response, got %T: %+v", resp, resp)
		}

		if createResp.ClientSecret == nil {
			t.Error("expected client_secret for confidential client")
		}
	})
}

func clientToExpectedResponse(c sql.AuthOauth2Client) api.OAuth2ClientResponse {
	accessTokenLifetime := int(c.AccessTokenLifetime)
	refreshTokenLifetime := int(c.RefreshTokenLifetime)

	resp := api.OAuth2ClientResponse{ //nolint:exhaustruct
		ClientId:                c.ClientID,
		ClientName:              c.ClientName,
		RedirectUris:            c.RedirectUris,
		GrantTypes:              &c.GrantTypes,
		ResponseTypes:           &c.ResponseTypes,
		Scopes:                  &c.Scopes,
		IsPublic:                &c.IsPublic,
		TokenEndpointAuthMethod: &c.TokenEndpointAuthMethod,
		AccessTokenLifetime:     &accessTokenLifetime,
		RefreshTokenLifetime:    &refreshTokenLifetime,
		CreatedAt:               &c.CreatedAt.Time,
		UpdatedAt:               &c.UpdatedAt.Time,
	}

	if c.ClientUri.Valid {
		resp.ClientUri = &c.ClientUri.String
	}

	if c.LogoUri.Valid {
		resp.LogoUri = &c.LogoUri.String
	}

	return resp
}
