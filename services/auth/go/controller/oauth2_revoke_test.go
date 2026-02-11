package controller_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"go.uber.org/mock/gomock"
)

func TestOauth2Revoke(t *testing.T) {
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

		resp, err := c.Oauth2Revoke(context.Background(), api.Oauth2RevokeRequestObject{
			Body: &api.OAuth2RevokeRequest{ //nolint:exhaustruct
				Token: "some-token",
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		defaultResp, ok := resp.(api.Oauth2RevokedefaultJSONResponse)
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

		resp, err := c.Oauth2Revoke(context.Background(), api.Oauth2RevokeRequestObject{
			Body: nil,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		defaultResp, ok := resp.(api.Oauth2RevokedefaultJSONResponse)
		if !ok {
			t.Fatalf("expected default JSON response, got %T", resp)
		}

		if defaultResp.StatusCode != http.StatusBadRequest {
			t.Errorf("expected status %d, got %d", http.StatusBadRequest, defaultResp.StatusCode)
		}
	})

	t.Run("missing client_id", func(t *testing.T) {
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

		resp, err := c.Oauth2Revoke(context.Background(), api.Oauth2RevokeRequestObject{
			Body: &api.OAuth2RevokeRequest{ //nolint:exhaustruct
				Token: "some-token",
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		defaultResp, ok := resp.(api.Oauth2RevokedefaultJSONResponse)
		if !ok {
			t.Fatalf("expected default JSON response, got %T", resp)
		}

		if defaultResp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected status %d, got %d", http.StatusUnauthorized, defaultResp.StatusCode)
		}

		if defaultResp.Body.Error != "invalid_client" {
			t.Errorf("expected error %q, got %q", "invalid_client", defaultResp.Body.Error)
		}
	})

	t.Run("success", func(t *testing.T) {
		t.Parallel()

		clientID := "nhost_abc123def456"
		client := testOAuth2Client()

		ctrl := gomock.NewController(t)

		db := mock.NewMockDBClient(ctrl)
		db.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
			Return(client, nil)
		db.EXPECT().DeleteOAuth2RefreshToken(gomock.Any(), gomock.Any()).
			Return(nil)

		c, _ := getController(
			t,
			ctrl,
			getConfigOAuth2Enabled,
			func(_ *gomock.Controller) controller.DBClient {
				return db
			},
		)

		resp, err := c.Oauth2Revoke(context.Background(), api.Oauth2RevokeRequestObject{
			Body: &api.OAuth2RevokeRequest{ //nolint:exhaustruct
				Token:    "some-token",
				ClientId: &clientID,
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		_, ok := resp.(api.Oauth2Revoke200Response)
		if !ok {
			t.Fatalf("expected 200 response, got %T: %+v", resp, resp)
		}
	})
}
