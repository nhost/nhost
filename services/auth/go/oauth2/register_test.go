package oauth2_test

import (
	"context"
	"log/slog"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/oauth2"
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
)

type fakeHasher struct{}

func (fakeHasher) Hash(_ string) (string, error) { return "hashed", nil }
func (fakeHasher) Verify(_, _ string) bool       { return true }

func TestRegisterClientDefaultScopes(t *testing.T) {
	t.Parallel()

	logger := slog.Default()
	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")

	t.Run("no scope in request uses DefaultScopes", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		mockDB := NewMockDBClient(ctrl)

		mockDB.EXPECT().InsertOAuth2Client(gomock.Any(), gomock.Any()).
			DoAndReturn(func(
				_ context.Context, params sql.InsertOAuth2ClientParams,
			) (sql.AuthOauth2Client, error) {
				if diff := cmp.Diff(oauth2.DefaultScopes(), params.Scopes); diff != "" {
					t.Errorf("scopes mismatch (-want +got):\n%s", diff)
				}

				return sql.AuthOauth2Client{}, nil //nolint:exhaustruct
			})

		provider := oauth2.NewProvider(
			mockDB, nil, nil, nil, fakeHasher{},
			oauth2.Config{ //nolint:exhaustruct
				AccessTokenTTL:  900,
				RefreshTokenTTL: 2592000,
			},
			nil,
		)

		resp, oauthErr := provider.RegisterClient(
			context.Background(),
			&api.OAuth2RegisterRequest{ //nolint:exhaustruct
				ClientName:   "Test App",
				RedirectUris: []string{"https://app.example.com/callback"},
			},
			userID,
			0,
			logger,
		)
		if oauthErr != nil {
			t.Fatalf("unexpected error: %s", oauthErr.Description)
		}

		expectedScope := strings.Join(oauth2.DefaultScopes(), " ")
		if resp.Scope == nil || *resp.Scope != expectedScope {
			t.Errorf("expected scope %q, got %v", expectedScope, resp.Scope)
		}
	})

	t.Run("explicit scope overrides default", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		mockDB := NewMockDBClient(ctrl)

		customScope := "openid email"

		mockDB.EXPECT().InsertOAuth2Client(gomock.Any(), gomock.Any()).
			DoAndReturn(func(
				_ context.Context, params sql.InsertOAuth2ClientParams,
			) (sql.AuthOauth2Client, error) {
				expected := []string{"openid", "email"}
				if diff := cmp.Diff(expected, params.Scopes); diff != "" {
					t.Errorf("scopes mismatch (-want +got):\n%s", diff)
				}

				return sql.AuthOauth2Client{}, nil //nolint:exhaustruct
			})

		provider := oauth2.NewProvider(
			mockDB, nil, nil, nil, fakeHasher{},
			oauth2.Config{ //nolint:exhaustruct
				AccessTokenTTL:  900,
				RefreshTokenTTL: 2592000,
			},
			nil,
		)

		resp, oauthErr := provider.RegisterClient(
			context.Background(),
			&api.OAuth2RegisterRequest{ //nolint:exhaustruct
				ClientName:   "Test App",
				RedirectUris: []string{"https://app.example.com/callback"},
				Scope:        &customScope,
			},
			userID,
			0,
			logger,
		)
		if oauthErr != nil {
			t.Fatalf("unexpected error: %s", oauthErr.Description)
		}

		if resp.Scope == nil || *resp.Scope != customScope {
			t.Errorf("expected scope %q, got %v", customScope, resp.Scope)
		}
	})
}
