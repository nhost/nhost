package controller_test

import (
	"context"
	"net/http"
	"net/url"
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

func TestOauth2Authorize(t *testing.T) { //nolint:cyclop,gocognit,gocyclo,maintidx
	t.Parallel()

	clientID := "nhost_abc123def456"
	redirectURI := "https://example.com/callback"
	state := "test-state"
	responseType := api.Code

	client := testOAuth2Client()
	client.ClientID = clientID

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

		resp, err := c.Oauth2Authorize(context.Background(), api.Oauth2AuthorizeRequestObject{
			Params: api.Oauth2AuthorizeParams{ //nolint:exhaustruct
				ClientId:     clientID,
				RedirectUri:  redirectURI,
				ResponseType: &responseType,
				State:        &state,
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		defaultResp, ok := resp.(api.Oauth2AuthorizedefaultJSONResponse)
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

	t.Run("success", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		db := mock.NewMockDBClient(ctrl)
		db.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
			Return(client, nil)
		db.EXPECT().InsertOAuth2AuthRequest(gomock.Any(), gomock.Any()).
			Return(sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
				ID:          uuid.MustParse("22222222-2222-2222-2222-222222222222"),
				ClientID:    clientID,
				RedirectUri: redirectURI,
				CreatedAt:   pgtype.Timestamptz{Time: time.Now(), Valid: true}, //nolint:exhaustruct
				ExpiresAt: pgtype.Timestamptz{ //nolint:exhaustruct
					Time:  time.Now().Add(10 * time.Minute),
					Valid: true,
				},
			}, nil)

		c, _ := getController(
			t,
			ctrl,
			getConfigOAuth2Enabled,
			func(_ *gomock.Controller) controller.DBClient {
				return db
			},
		)

		resp, err := c.Oauth2Authorize(context.Background(), api.Oauth2AuthorizeRequestObject{
			Params: api.Oauth2AuthorizeParams{ //nolint:exhaustruct
				ClientId:     clientID,
				RedirectUri:  redirectURI,
				ResponseType: &responseType,
				State:        &state,
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		redirectResp, ok := resp.(api.Oauth2Authorize302Response)
		if !ok {
			t.Fatalf("expected 302 response, got %T: %+v", resp, resp)
		}

		if redirectResp.Headers.Location == "" {
			t.Error("expected non-empty location header")
		}
	})

	t.Run("invalid client", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		db := mock.NewMockDBClient(ctrl)
		db.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), "unknown_client").
			Return(sql.AuthOauth2Client{}, pgx.ErrNoRows) //nolint:exhaustruct

		c, _ := getController(
			t,
			ctrl,
			getConfigOAuth2Enabled,
			func(_ *gomock.Controller) controller.DBClient {
				return db
			},
		)

		resp, err := c.Oauth2Authorize(context.Background(), api.Oauth2AuthorizeRequestObject{
			Params: api.Oauth2AuthorizeParams{ //nolint:exhaustruct
				ClientId:     "unknown_client",
				RedirectUri:  redirectURI,
				ResponseType: &responseType,
				State:        &state,
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		defaultResp, ok := resp.(api.Oauth2AuthorizedefaultJSONResponse)
		if !ok {
			t.Fatalf("expected default JSON response, got %T", resp)
		}

		if defaultResp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected status %d, got %d", http.StatusUnauthorized, defaultResp.StatusCode)
		}
	})

	t.Run("missing response_type redirects", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		db := mock.NewMockDBClient(ctrl)
		db.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
			Return(client, nil)

		c, _ := getController(
			t,
			ctrl,
			getConfigOAuth2Enabled,
			func(_ *gomock.Controller) controller.DBClient {
				return db
			},
		)

		resp, err := c.Oauth2Authorize(context.Background(), api.Oauth2AuthorizeRequestObject{
			Params: api.Oauth2AuthorizeParams{ //nolint:exhaustruct
				ClientId:     clientID,
				RedirectUri:  redirectURI,
				ResponseType: nil,
				State:        &state,
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		redirectResp, ok := resp.(api.Oauth2Authorize302Response)
		if !ok {
			t.Fatalf("expected 302 response, got %T: %+v", resp, resp)
		}

		u, err := url.Parse(redirectResp.Headers.Location)
		if err != nil {
			t.Fatalf("failed to parse redirect URL: %v", err)
		}

		if got := u.Query().Get("error"); got != "invalid_request" {
			t.Errorf("expected error=invalid_request, got %q", got)
		}

		if got := u.Query().Get("error_description"); got != "Missing response_type" {
			t.Errorf("expected error_description='Missing response_type', got %q", got)
		}

		if got := u.Query().Get("state"); got != state {
			t.Errorf("expected state=%q, got %q", state, got)
		}
	})

	t.Run("missing response_type without state", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		db := mock.NewMockDBClient(ctrl)
		db.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
			Return(client, nil)

		c, _ := getController(
			t,
			ctrl,
			getConfigOAuth2Enabled,
			func(_ *gomock.Controller) controller.DBClient {
				return db
			},
		)

		resp, err := c.Oauth2Authorize(context.Background(), api.Oauth2AuthorizeRequestObject{
			Params: api.Oauth2AuthorizeParams{ //nolint:exhaustruct
				ClientId:     clientID,
				RedirectUri:  redirectURI,
				ResponseType: nil,
				State:        nil,
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		redirectResp, ok := resp.(api.Oauth2Authorize302Response)
		if !ok {
			t.Fatalf("expected 302 response, got %T: %+v", resp, resp)
		}

		u, err := url.Parse(redirectResp.Headers.Location)
		if err != nil {
			t.Fatalf("failed to parse redirect URL: %v", err)
		}

		if got := u.Query().Get("error"); got != "invalid_request" {
			t.Errorf("expected error=invalid_request, got %q", got)
		}

		if got := u.Query().Get("state"); got != "" {
			t.Errorf("expected no state param, got %q", got)
		}
	})

	t.Run("unsupported response_type redirects", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		db := mock.NewMockDBClient(ctrl)
		db.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
			Return(client, nil)

		c, _ := getController(
			t,
			ctrl,
			getConfigOAuth2Enabled,
			func(_ *gomock.Controller) controller.DBClient {
				return db
			},
		)

		tokenType := api.Oauth2AuthorizeParamsResponseType("token")

		resp, err := c.Oauth2Authorize(context.Background(), api.Oauth2AuthorizeRequestObject{
			Params: api.Oauth2AuthorizeParams{ //nolint:exhaustruct
				ClientId:     clientID,
				RedirectUri:  redirectURI,
				ResponseType: &tokenType,
				State:        &state,
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		redirectResp, ok := resp.(api.Oauth2Authorize302Response)
		if !ok {
			t.Fatalf("expected 302 response, got %T: %+v", resp, resp)
		}

		u, err := url.Parse(redirectResp.Headers.Location)
		if err != nil {
			t.Fatalf("failed to parse redirect URL: %v", err)
		}

		if got := u.Query().Get("error"); got != "unsupported_response_type" {
			t.Errorf("expected error=unsupported_response_type, got %q", got)
		}

		if got := u.Query().Get("state"); got != state {
			t.Errorf("expected state=%q, got %q", state, got)
		}
	})

	t.Run("invalid scope redirects", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		db := mock.NewMockDBClient(ctrl)
		db.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
			Return(client, nil)

		c, _ := getController(
			t,
			ctrl,
			getConfigOAuth2Enabled,
			func(_ *gomock.Controller) controller.DBClient {
				return db
			},
		)

		badScope := "openid invalid_scope"

		resp, err := c.Oauth2Authorize(context.Background(), api.Oauth2AuthorizeRequestObject{
			Params: api.Oauth2AuthorizeParams{ //nolint:exhaustruct
				ClientId:     clientID,
				RedirectUri:  redirectURI,
				ResponseType: &responseType,
				Scope:        &badScope,
				State:        &state,
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		redirectResp, ok := resp.(api.Oauth2Authorize302Response)
		if !ok {
			t.Fatalf("expected 302 response, got %T: %+v", resp, resp)
		}

		u, err := url.Parse(redirectResp.Headers.Location)
		if err != nil {
			t.Fatalf("failed to parse redirect URL: %v", err)
		}

		if got := u.Query().Get("error"); got != "invalid_scope" {
			t.Errorf("expected error=invalid_scope, got %q", got)
		}

		if got := u.Query().Get("state"); got != state {
			t.Errorf("expected state=%q, got %q", state, got)
		}
	})
}
