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
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
)

func TestOauth2Introspect(t *testing.T) { //nolint:cyclop,gocognit,maintidx
	t.Parallel()

	clientID := "nhost_abc123def456"

	publicClient := sql.AuthOauth2Client{ //nolint:exhaustruct
		ID:                       uuid.MustParse("11111111-1111-1111-1111-111111111111"),
		ClientID:                 clientID,
		IsPublic:                 true,
		TokenEndpointAuthMethod:  "none",
		IDTokenSignedResponseAlg: "RS256",
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

		resp, err := c.Oauth2Introspect(context.Background(), api.Oauth2IntrospectRequestObject{
			Body: &api.OAuth2IntrospectRequest{ //nolint:exhaustruct
				Token: "some-token",
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		defaultResp, ok := resp.(api.Oauth2IntrospectdefaultJSONResponse)
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

		resp, err := c.Oauth2Introspect(context.Background(), api.Oauth2IntrospectRequestObject{
			Body: nil,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		defaultResp, ok := resp.(api.Oauth2IntrospectdefaultJSONResponse)
		if !ok {
			t.Fatalf("expected default JSON response, got %T", resp)
		}

		if defaultResp.StatusCode != http.StatusBadRequest {
			t.Errorf("expected status %d, got %d", http.StatusBadRequest, defaultResp.StatusCode)
		}
	})

	t.Run("missing client_id", func(t *testing.T) { //nolint:dupl
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

		resp, err := c.Oauth2Introspect(context.Background(), api.Oauth2IntrospectRequestObject{
			Body: &api.OAuth2IntrospectRequest{ //nolint:exhaustruct
				Token: "some-token",
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		defaultResp, ok := resp.(api.Oauth2IntrospectdefaultJSONResponse)
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

	t.Run("unknown client", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		unknownClientID := "nhost_unknown"

		db := mock.NewMockDBClient(ctrl)
		db.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), unknownClientID).
			Return(sql.AuthOauth2Client{}, pgx.ErrNoRows) //nolint:exhaustruct

		c, _ := getController(
			t,
			ctrl,
			getConfigOAuth2Enabled,
			func(_ *gomock.Controller) controller.DBClient {
				return db
			},
		)

		resp, err := c.Oauth2Introspect(context.Background(), api.Oauth2IntrospectRequestObject{
			Body: &api.OAuth2IntrospectRequest{ //nolint:exhaustruct
				Token:    "some-token",
				ClientId: &unknownClientID,
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		defaultResp, ok := resp.(api.Oauth2IntrospectdefaultJSONResponse)
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

	t.Run("refresh token - active", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
		now := time.Now()
		hint := api.OAuth2IntrospectRequestTokenTypeHintRefreshToken

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

		db := mock.NewMockDBClient(ctrl)
		db.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
			Return(publicClient, nil)
		db.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), gomock.Any()).
			Return(rt, nil)

		c, _ := getController(
			t,
			ctrl,
			getConfigOAuth2Enabled,
			func(_ *gomock.Controller) controller.DBClient {
				return db
			},
		)

		resp, err := c.Oauth2Introspect(context.Background(), api.Oauth2IntrospectRequestObject{
			Body: &api.OAuth2IntrospectRequest{ //nolint:exhaustruct
				Token:         "some-refresh-token",
				TokenTypeHint: &hint,
				ClientId:      &clientID,
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		successResp, ok := resp.(api.Oauth2Introspect200JSONResponse)
		if !ok {
			t.Fatalf("expected 200 response, got %T: %+v", resp, resp)
		}

		if !successResp.Active {
			t.Error("expected token to be active")
		}

		if successResp.ClientId == nil || *successResp.ClientId != rt.ClientID {
			t.Errorf("expected client_id %q", rt.ClientID)
		}
	})

	t.Run("unknown refresh token - inactive", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		hint := api.OAuth2IntrospectRequestTokenTypeHintRefreshToken

		db := mock.NewMockDBClient(ctrl)
		db.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
			Return(publicClient, nil)
		db.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), gomock.Any()).
			Return(sql.AuthOauth2RefreshToken{}, pgx.ErrNoRows) //nolint:exhaustruct

		c, _ := getController(
			t,
			ctrl,
			getConfigOAuth2Enabled,
			func(_ *gomock.Controller) controller.DBClient {
				return db
			},
		)

		resp, err := c.Oauth2Introspect(context.Background(), api.Oauth2IntrospectRequestObject{
			Body: &api.OAuth2IntrospectRequest{ //nolint:exhaustruct
				Token:         "unknown-token",
				TokenTypeHint: &hint,
				ClientId:      &clientID,
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		successResp, ok := resp.(api.Oauth2Introspect200JSONResponse)
		if !ok {
			t.Fatalf("expected 200 response, got %T: %+v", resp, resp)
		}

		if successResp.Active {
			t.Error("expected token to be inactive")
		}
	})
}
