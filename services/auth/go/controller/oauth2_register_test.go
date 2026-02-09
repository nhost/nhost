package controller_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
)

func TestOauth2Register(t *testing.T) { //nolint:cyclop
	t.Parallel()

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

		resp, err := c.Oauth2Register(context.Background(), api.Oauth2RegisterRequestObject{
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
		db.EXPECT().InsertOAuth2Client(gomock.Any(), gomock.Any()).
			Return(testOAuth2Client(), nil)

		c, _ := getController(
			t,
			ctrl,
			getConfigOAuth2Enabled,
			func(_ *gomock.Controller) controller.DBClient {
				return db
			},
		)

		authMethod := api.OAuth2RegisterRequestTokenEndpointAuthMethod("none")

		resp, err := c.Oauth2Register(context.Background(), api.Oauth2RegisterRequestObject{
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
		db.EXPECT().InsertOAuth2Client(gomock.Any(), gomock.Any()).
			Return(confidentialClient, nil)

		c, _ := getController(
			t,
			ctrl,
			getConfigOAuth2Enabled,
			func(_ *gomock.Controller) controller.DBClient {
				return db
			},
		)

		resp, err := c.Oauth2Register(context.Background(), api.Oauth2RegisterRequestObject{
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
			t.Errorf("expected client_secret_expires_at=0, got %d", *registerResp.ClientSecretExpiresAt)
		}
	})

	t.Run("public client has no secret_expires_at", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		db := mock.NewMockDBClient(ctrl)
		db.EXPECT().InsertOAuth2Client(gomock.Any(), gomock.Any()).
			Return(testOAuth2Client(), nil)

		c, _ := getController(
			t,
			ctrl,
			getConfigOAuth2Enabled,
			func(_ *gomock.Controller) controller.DBClient {
				return db
			},
		)

		authMethod := api.OAuth2RegisterRequestTokenEndpointAuthMethod("none")

		resp, err := c.Oauth2Register(context.Background(), api.Oauth2RegisterRequestObject{
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
}
