package controller_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
)

func getConfigOAuth2DCREnabled() *controller.Config {
	config := getConfigOAuth2Enabled()
	config.OAuth2ProviderDCREnabled = true

	return config
}

func getConfigOAuth2DCRMaxClients(limit int) func() *controller.Config {
	return func() *controller.Config {
		config := getConfigOAuth2DCREnabled()
		config.OAuth2ProviderDCRMaxClientsPerUser = limit

		return config
	}
}

func TestOauth2Register(t *testing.T) { //nolint:cyclop,gocognit,maintidx
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

	t.Run("oauth2 provider disabled", func(t *testing.T) {
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

		resp, err := c.Oauth2Register(context.Background(), api.Oauth2RegisterRequestObject{
			Body: &api.OAuth2RegisterRequest{ //nolint:exhaustruct
				ClientName:   "Test App",
				RedirectUris: []string{"https://example.com/callback"},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		defaultResp, ok := resp.(api.Oauth2RegisterdefaultJSONResponse)
		if !ok {
			t.Fatalf("expected default JSON response, got %T", resp)
		}

		if defaultResp.StatusCode != http.StatusInternalServerError {
			t.Errorf(
				"expected status %d, got %d",
				http.StatusInternalServerError,
				defaultResp.StatusCode,
			)
		}
	})

	t.Run("DCR disabled", func(t *testing.T) {
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

		resp, err := c.Oauth2Register(context.Background(), api.Oauth2RegisterRequestObject{
			Body: &api.OAuth2RegisterRequest{ //nolint:exhaustruct
				ClientName:   "Test App",
				RedirectUris: []string{"https://example.com/callback"},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		defaultResp, ok := resp.(api.Oauth2RegisterdefaultJSONResponse)
		if !ok {
			t.Fatalf("expected default JSON response, got %T", resp)
		}

		if defaultResp.StatusCode != http.StatusInternalServerError {
			t.Errorf(
				"expected status %d, got %d",
				http.StatusInternalServerError,
				defaultResp.StatusCode,
			)
		}
	})

	t.Run("unauthenticated", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		c, _ := getController(
			t,
			ctrl,
			getConfigOAuth2DCREnabled,
			func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
		)

		resp, err := c.Oauth2Register(context.Background(), api.Oauth2RegisterRequestObject{
			Body: &api.OAuth2RegisterRequest{ //nolint:exhaustruct
				ClientName:   "Test App",
				RedirectUris: []string{"https://example.com/callback"},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		defaultResp, ok := resp.(api.Oauth2RegisterdefaultJSONResponse)
		if !ok {
			t.Fatalf("expected default JSON response, got %T", resp)
		}

		if defaultResp.StatusCode != http.StatusUnauthorized {
			t.Errorf(
				"expected status %d, got %d",
				http.StatusUnauthorized,
				defaultResp.StatusCode,
			)
		}
	})

	t.Run("missing body", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		db := mock.NewMockDBClient(ctrl)
		db.EXPECT().GetUser(gomock.Any(), userID).
			Return(sql.AuthUser{ //nolint:exhaustruct
				ID:    userID,
				Email: sql.Text("jane@acme.com"),
			}, nil)

		c, jwtGetter := getController(
			t,
			ctrl,
			getConfigOAuth2DCREnabled,
			func(_ *gomock.Controller) controller.DBClient {
				return db
			},
		)

		ctx := jwtGetter.ToContext(context.Background(), jwtTokenFn())

		resp, err := c.Oauth2Register(ctx, api.Oauth2RegisterRequestObject{
			Body: nil,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		defaultResp, ok := resp.(api.Oauth2RegisterdefaultJSONResponse)
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
			t,
			ctrl,
			getConfigOAuth2DCREnabled,
			func(_ *gomock.Controller) controller.DBClient {
				return db
			},
		)

		ctx := jwtGetter.ToContext(context.Background(), jwtTokenFn())

		authMethod := api.OAuth2RegisterRequestTokenEndpointAuthMethod("none")

		resp, err := c.Oauth2Register(ctx, api.Oauth2RegisterRequestObject{
			Body: &api.OAuth2RegisterRequest{ //nolint:exhaustruct
				ClientName:              "Test App",
				RedirectUris:            []string{"https://example.com/callback"},
				TokenEndpointAuthMethod: &authMethod,
				GrantTypes:              &[]string{"authorization_code"},
				ResponseTypes:           &[]string{"code"},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		_, ok := resp.(api.Oauth2Register201JSONResponse)
		if !ok {
			t.Fatalf("expected 201 response, got %T: %+v", resp, resp)
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
			t,
			ctrl,
			getConfigOAuth2DCREnabled,
			func(_ *gomock.Controller) controller.DBClient {
				return db
			},
		)

		ctx := jwtGetter.ToContext(context.Background(), jwtTokenFn())

		resp, err := c.Oauth2Register(ctx, api.Oauth2RegisterRequestObject{
			Body: &api.OAuth2RegisterRequest{ //nolint:exhaustruct
				ClientName:   "Confidential App",
				RedirectUris: []string{"https://example.com/callback"},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		registerResp, ok := resp.(api.Oauth2Register201JSONResponse)
		if !ok {
			t.Fatalf("expected 201 response, got %T: %+v", resp, resp)
		}

		if registerResp.ClientSecret == nil {
			t.Error("expected client_secret for confidential client")
		}

		if registerResp.ClientSecretExpiresAt == nil {
			t.Error("expected client_secret_expires_at for confidential client")
		} else if *registerResp.ClientSecretExpiresAt != 0 {
			t.Errorf(
				"expected client_secret_expires_at=0, got %d",
				*registerResp.ClientSecretExpiresAt,
			)
		}
	})

	t.Run("public client has no secret_expires_at", func(t *testing.T) {
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
			t,
			ctrl,
			getConfigOAuth2DCREnabled,
			func(_ *gomock.Controller) controller.DBClient {
				return db
			},
		)

		ctx := jwtGetter.ToContext(context.Background(), jwtTokenFn())

		authMethod := api.OAuth2RegisterRequestTokenEndpointAuthMethod("none")

		resp, err := c.Oauth2Register(ctx, api.Oauth2RegisterRequestObject{
			Body: &api.OAuth2RegisterRequest{ //nolint:exhaustruct
				ClientName:              "Public App",
				RedirectUris:            []string{"https://example.com/callback"},
				TokenEndpointAuthMethod: &authMethod,
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		registerResp, ok := resp.(api.Oauth2Register201JSONResponse)
		if !ok {
			t.Fatalf("expected 201 response, got %T: %+v", resp, resp)
		}

		if registerResp.ClientSecretExpiresAt != nil {
			t.Error("expected no client_secret_expires_at for public client")
		}
	})

	t.Run("max clients reached", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		db := mock.NewMockDBClient(ctrl)
		db.EXPECT().GetUser(gomock.Any(), userID).
			Return(sql.AuthUser{ //nolint:exhaustruct
				ID:    userID,
				Email: sql.Text("jane@acme.com"),
			}, nil)
		db.EXPECT().CountOAuth2ClientsByCreatedBy(
			gomock.Any(), pgtype.UUID{Bytes: userID, Valid: true},
		).Return(int64(5), nil)

		c, jwtGetter := getController(
			t,
			ctrl,
			getConfigOAuth2DCRMaxClients(5),
			func(_ *gomock.Controller) controller.DBClient {
				return db
			},
		)

		ctx := jwtGetter.ToContext(context.Background(), jwtTokenFn())

		resp, err := c.Oauth2Register(ctx, api.Oauth2RegisterRequestObject{
			Body: &api.OAuth2RegisterRequest{ //nolint:exhaustruct
				ClientName:   "Test App",
				RedirectUris: []string{"https://example.com/callback"},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		defaultResp, ok := resp.(api.Oauth2RegisterdefaultJSONResponse)
		if !ok {
			t.Fatalf("expected default JSON response, got %T", resp)
		}

		if defaultResp.StatusCode != http.StatusBadRequest {
			t.Errorf("expected status %d, got %d", http.StatusBadRequest, defaultResp.StatusCode)
		}
	})

	t.Run("max clients zero - unlimited", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		db := mock.NewMockDBClient(ctrl)
		db.EXPECT().GetUser(gomock.Any(), userID).
			Return(sql.AuthUser{ //nolint:exhaustruct
				ID:    userID,
				Email: sql.Text("jane@acme.com"),
			}, nil)
		// CountOAuth2ClientsByCreatedBy should NOT be called when limit is 0
		db.EXPECT().InsertOAuth2Client(gomock.Any(), gomock.Any()).
			Return(testOAuth2Client(), nil)

		c, jwtGetter := getController(
			t,
			ctrl,
			getConfigOAuth2DCRMaxClients(0),
			func(_ *gomock.Controller) controller.DBClient {
				return db
			},
		)

		ctx := jwtGetter.ToContext(context.Background(), jwtTokenFn())

		authMethod := api.OAuth2RegisterRequestTokenEndpointAuthMethod("none")

		resp, err := c.Oauth2Register(ctx, api.Oauth2RegisterRequestObject{
			Body: &api.OAuth2RegisterRequest{ //nolint:exhaustruct
				ClientName:              "Test App",
				RedirectUris:            []string{"https://example.com/callback"},
				TokenEndpointAuthMethod: &authMethod,
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		_, ok := resp.(api.Oauth2Register201JSONResponse)
		if !ok {
			t.Fatalf("expected 201 response, got %T: %+v", resp, resp)
		}
	})
}
