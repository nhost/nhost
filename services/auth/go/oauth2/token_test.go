package oauth2_test

import (
	"context"
	"crypto/rsa"
	"log/slog"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/oauth2"
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
)

type fakeSigner struct {
	calls []map[string]any
}

func (s *fakeSigner) RSASigningKey() (*rsa.PrivateKey, string, error) {
	return nil, "", nil
}

func (s *fakeSigner) SignClaims(claims map[string]any, _ time.Time) (string, error) {
	s.calls = append(s.calls, claims)
	return "fake-token", nil
}

func (s *fakeSigner) ValidateToken(
	_ string,
) (*oauth2.ValidatedClaims, error) {
	return &oauth2.ValidatedClaims{}, nil //nolint:exhaustruct
}

func (s *fakeSigner) Issuer() string {
	return "https://test.example.com"
}

func (s *fakeSigner) GraphQLClaims(
	_ context.Context,
	userID uuid.UUID,
	_ bool,
	allowedRoles []string,
	defaultRole string,
	_ map[string]any,
	_ *slog.Logger,
) (string, map[string]any, error) {
	return "https://hasura.io/jwt/claims", map[string]any{
		"x-hasura-user-id":       userID.String(),
		"x-hasura-default-role":  defaultRole,
		"x-hasura-allowed-roles": allowedRoles,
	}, nil
}

func TestExchangeCodeRedirectURIValidation(t *testing.T) {
	t.Parallel()

	logger := slog.Default()
	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
	clientID := "test-client"
	codeValue := "test-code"
	codeHash := oauth2.HashToken(codeValue)
	redirectURI := "https://example.com/callback"

	baseAuthReq := sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
		ClientID:    clientID,
		RedirectUri: redirectURI,
		Scopes:      []string{"openid"},
		UserID:      pgtype.UUID{Bytes: uuid.UUID(userID), Valid: true},
	}

	t.Run("missing redirect_uri returns error", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		mockDB := NewMockDBClient(ctrl)

		mockDB.EXPECT().ConsumeOAuth2AuthorizationCode(gomock.Any(), codeHash).
			Return(baseAuthReq, nil)

		provider := oauth2.NewProvider(
			mockDB, &fakeSigner{}, nil, nil, nil, //nolint:exhaustruct
			oauth2.Config{}, //nolint:exhaustruct
			nil,
		)

		_, oauthErr := provider.ExchangeCode(
			context.Background(),
			&api.OAuth2TokenRequest{ //nolint:exhaustruct
				Code:      &codeValue,
				GrantType: "authorization_code",
			},
			logger,
		)
		if oauthErr == nil {
			t.Fatal("expected error when redirect_uri is missing")
		}

		if oauthErr.Err != "invalid_grant" {
			t.Errorf("expected error 'invalid_grant', got %q", oauthErr.Err)
		}
	})

	t.Run("mismatched redirect_uri returns error", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		mockDB := NewMockDBClient(ctrl)

		mockDB.EXPECT().ConsumeOAuth2AuthorizationCode(gomock.Any(), codeHash).
			Return(baseAuthReq, nil)

		provider := oauth2.NewProvider(
			mockDB, &fakeSigner{}, nil, nil, nil, //nolint:exhaustruct
			oauth2.Config{}, //nolint:exhaustruct
			nil,
		)

		wrongURI := "https://evil.com/callback"

		_, oauthErr := provider.ExchangeCode(
			context.Background(),
			&api.OAuth2TokenRequest{ //nolint:exhaustruct
				Code:        &codeValue,
				GrantType:   "authorization_code",
				RedirectUri: &wrongURI,
			},
			logger,
		)
		if oauthErr == nil {
			t.Fatal("expected error when redirect_uri does not match")
		}

		if oauthErr.Err != "invalid_grant" {
			t.Errorf("expected error 'invalid_grant', got %q", oauthErr.Err)
		}
	})

	t.Run("unexpected redirect_uri when not in auth request returns error", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		mockDB := NewMockDBClient(ctrl)

		authReqNoRedirect := sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
			ClientID:    clientID,
			RedirectUri: "",
			Scopes:      []string{"openid"},
			UserID:      pgtype.UUID{Bytes: uuid.UUID(userID), Valid: true},
		}

		mockDB.EXPECT().ConsumeOAuth2AuthorizationCode(gomock.Any(), codeHash).
			Return(authReqNoRedirect, nil)

		provider := oauth2.NewProvider(
			mockDB, &fakeSigner{}, nil, nil, nil, //nolint:exhaustruct
			oauth2.Config{}, //nolint:exhaustruct
			nil,
		)

		someURI := "https://example.com/callback"

		_, oauthErr := provider.ExchangeCode(
			context.Background(),
			&api.OAuth2TokenRequest{ //nolint:exhaustruct
				Code:        &codeValue,
				GrantType:   "authorization_code",
				RedirectUri: &someURI,
			},
			logger,
		)
		if oauthErr == nil {
			t.Fatal("expected error when redirect_uri sent but not in auth request")
		}

		if oauthErr.Err != "invalid_request" {
			t.Errorf("expected error 'invalid_request', got %q", oauthErr.Err)
		}
	})

	t.Run("no redirect_uri in either request succeeds", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		mockDB := NewMockDBClient(ctrl)
		signer := &fakeSigner{} //nolint:exhaustruct

		authReqNoRedirect := sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
			ClientID:    clientID,
			RedirectUri: "",
			Scopes:      []string{"openid"},
			UserID:      pgtype.UUID{Bytes: uuid.UUID(userID), Valid: true},
		}

		confidentialClient := sql.AuthOauth2Client{ //nolint:exhaustruct
			ClientID:         clientID,
			IsPublic:         false,
			ClientSecretHash: pgtype.Text{String: "hashed-secret", Valid: true},
		}

		mockDB.EXPECT().ConsumeOAuth2AuthorizationCode(gomock.Any(), codeHash).
			Return(authReqNoRedirect, nil)
		mockDB.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
			Return(confidentialClient, nil).Times(3)
		mockDB.EXPECT().InsertOAuth2RefreshToken(gomock.Any(), gomock.Any()).
			Return(sql.AuthOauth2RefreshToken{}, nil) //nolint:exhaustruct

		secret := "my-secret"

		provider := oauth2.NewProvider(
			mockDB, signer, nil, nil, &fakeHasher{},
			oauth2.Config{ //nolint:exhaustruct
				AccessTokenTTL:  300,
				RefreshTokenTTL: 3600,
			},
			nil,
		)

		resp, oauthErr := provider.ExchangeCode(
			context.Background(),
			&api.OAuth2TokenRequest{ //nolint:exhaustruct
				Code:         &codeValue,
				GrantType:    "authorization_code",
				ClientSecret: &secret,
			},
			logger,
		)
		if oauthErr != nil {
			t.Fatalf("unexpected error: %s", oauthErr.Description)
		}

		if resp.AccessToken != "fake-token" {
			t.Errorf("expected access token 'fake-token', got %q", resp.AccessToken)
		}
	})

	t.Run("matching redirect_uri succeeds", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		mockDB := NewMockDBClient(ctrl)
		signer := &fakeSigner{} //nolint:exhaustruct

		confidentialClient := sql.AuthOauth2Client{ //nolint:exhaustruct
			ClientID:         clientID,
			IsPublic:         false,
			ClientSecretHash: pgtype.Text{String: "hashed-secret", Valid: true},
		}

		mockDB.EXPECT().ConsumeOAuth2AuthorizationCode(gomock.Any(), codeHash).
			Return(baseAuthReq, nil)
		mockDB.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
			Return(confidentialClient, nil).Times(3)
		mockDB.EXPECT().InsertOAuth2RefreshToken(gomock.Any(), gomock.Any()).
			Return(sql.AuthOauth2RefreshToken{}, nil) //nolint:exhaustruct

		secret := "my-secret"

		provider := oauth2.NewProvider(
			mockDB, signer, nil, nil, &fakeHasher{},
			oauth2.Config{ //nolint:exhaustruct
				AccessTokenTTL:  300,
				RefreshTokenTTL: 3600,
			},
			nil,
		)

		resp, oauthErr := provider.ExchangeCode(
			context.Background(),
			&api.OAuth2TokenRequest{ //nolint:exhaustruct
				Code:         &codeValue,
				GrantType:    "authorization_code",
				RedirectUri:  &redirectURI,
				ClientSecret: &secret,
			},
			logger,
		)
		if oauthErr != nil {
			t.Fatalf("unexpected error: %s", oauthErr.Description)
		}

		if resp.AccessToken != "fake-token" {
			t.Errorf("expected access token 'fake-token', got %q", resp.AccessToken)
		}
	})
}

func TestCreateAccessTokenWithGraphQLScope(t *testing.T) { //nolint:gocognit,cyclop
	t.Parallel()

	logger := slog.Default()
	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
	clientID := "test-client"
	refreshTokenValue := "test-refresh-token"
	tokenHash := oauth2.HashToken(refreshTokenValue)

	baseRefreshToken := sql.AuthOauth2RefreshToken{ //nolint:exhaustruct
		TokenHash: tokenHash,
		ClientID:  clientID,
		UserID:    userID,
		ExpiresAt: sql.TimestampTz(time.Now().Add(time.Hour)),
	}

	client := sql.AuthOauth2Client{ //nolint:exhaustruct
		ClientID: clientID,
		IsPublic: true,
	}

	user := sql.AuthUser{ //nolint:exhaustruct
		ID:          userID,
		DefaultRole: "user",
	}

	userRoles := []sql.AuthUserRole{
		{Role: "user"},   //nolint:exhaustruct
		{Role: "editor"}, //nolint:exhaustruct
	}

	t.Run("with graphql scope includes hasura claims", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		mockDB := NewMockDBClient(ctrl)
		signer := &fakeSigner{} //nolint:exhaustruct

		rt := baseRefreshToken
		rt.Scopes = []string{"graphql"}

		mockDB.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), tokenHash).
			Return(rt, nil)
		mockDB.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
			Return(client, nil).Times(2)
		mockDB.EXPECT().GetUser(gomock.Any(), userID).
			Return(user, nil)
		mockDB.EXPECT().GetUserRoles(gomock.Any(), userID).
			Return(userRoles, nil)
		mockDB.EXPECT().UpdateOAuth2RefreshToken(gomock.Any(), gomock.Any()).
			Return(sql.AuthOauth2RefreshToken{}, nil) //nolint:exhaustruct

		provider := oauth2.NewProvider(
			mockDB, signer, nil, nil, nil,
			oauth2.Config{ //nolint:exhaustruct
				AccessTokenTTL:  300,
				RefreshTokenTTL: 3600,
			},
			nil,
		)

		resp, oauthErr := provider.RefreshToken(
			context.Background(),
			&api.OAuth2TokenRequest{ //nolint:exhaustruct
				RefreshToken: &refreshTokenValue,
				GrantType:    "refresh_token",
			},
			logger,
		)
		if oauthErr != nil {
			t.Fatalf("unexpected error: %s", oauthErr.Description)
		}

		if resp.AccessToken != "fake-token" {
			t.Errorf("expected access token 'fake-token', got %q", resp.AccessToken)
		}

		if len(signer.calls) == 0 {
			t.Fatal("expected at least one SignClaims call")
		}

		accessTokenClaims := signer.calls[0]

		hasuraClaims, ok := accessTokenClaims["https://hasura.io/jwt/claims"]
		if !ok {
			t.Fatal("expected hasura claims to be present in access token")
		}

		hc, ok := hasuraClaims.(map[string]any)
		if !ok {
			t.Fatal("expected hasura claims to be a map")
		}

		if hc["x-hasura-user-id"] != userID.String() {
			t.Errorf(
				"expected x-hasura-user-id %q, got %q",
				userID.String(), hc["x-hasura-user-id"],
			)
		}

		if hc["x-hasura-default-role"] != "user" {
			t.Errorf(
				"expected x-hasura-default-role 'user', got %q",
				hc["x-hasura-default-role"],
			)
		}

		roles, ok := hc["x-hasura-allowed-roles"].([]string)
		if !ok {
			t.Fatal("expected x-hasura-allowed-roles to be a string slice")
		}

		if len(roles) != 2 {
			t.Errorf("expected 2 allowed roles, got %d", len(roles))
		}
	})

	t.Run("without graphql scope omits hasura claims", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		mockDB := NewMockDBClient(ctrl)
		signer := &fakeSigner{} //nolint:exhaustruct

		rt := baseRefreshToken
		rt.Scopes = []string{"profile"}

		mockDB.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), tokenHash).
			Return(rt, nil)
		mockDB.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
			Return(client, nil).Times(2)
		mockDB.EXPECT().UpdateOAuth2RefreshToken(gomock.Any(), gomock.Any()).
			Return(sql.AuthOauth2RefreshToken{}, nil) //nolint:exhaustruct

		// NOTE: GetUser and GetUserRoles should NOT be called

		provider := oauth2.NewProvider(
			mockDB, signer, nil, nil, nil,
			oauth2.Config{ //nolint:exhaustruct
				AccessTokenTTL:  300,
				RefreshTokenTTL: 3600,
			},
			nil,
		)

		resp, oauthErr := provider.RefreshToken(
			context.Background(),
			&api.OAuth2TokenRequest{ //nolint:exhaustruct
				RefreshToken: &refreshTokenValue,
				GrantType:    "refresh_token",
			},
			logger,
		)
		if oauthErr != nil {
			t.Fatalf("unexpected error: %s", oauthErr.Description)
		}

		if resp.AccessToken != "fake-token" {
			t.Errorf("expected access token 'fake-token', got %q", resp.AccessToken)
		}

		if len(signer.calls) == 0 {
			t.Fatal("expected at least one SignClaims call")
		}

		accessTokenClaims := signer.calls[0]

		if _, ok := accessTokenClaims["https://hasura.io/jwt/claims"]; ok {
			t.Error("expected hasura claims to NOT be present when graphql scope is absent")
		}
	})

	t.Run("with no scopes omits hasura claims", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		mockDB := NewMockDBClient(ctrl)
		signer := &fakeSigner{} //nolint:exhaustruct

		rt := baseRefreshToken
		rt.Scopes = []string{}

		mockDB.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), tokenHash).
			Return(rt, nil)
		mockDB.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
			Return(client, nil).Times(2)
		mockDB.EXPECT().UpdateOAuth2RefreshToken(gomock.Any(), gomock.Any()).
			Return(sql.AuthOauth2RefreshToken{}, nil) //nolint:exhaustruct

		provider := oauth2.NewProvider(
			mockDB, signer, nil, nil, nil,
			oauth2.Config{ //nolint:exhaustruct
				AccessTokenTTL:  300,
				RefreshTokenTTL: 3600,
			},
			nil,
		)

		_, oauthErr := provider.RefreshToken(
			context.Background(),
			&api.OAuth2TokenRequest{ //nolint:exhaustruct
				RefreshToken: &refreshTokenValue,
				GrantType:    "refresh_token",
			},
			logger,
		)
		if oauthErr != nil {
			t.Fatalf("unexpected error: %s", oauthErr.Description)
		}

		if len(signer.calls) == 0 {
			t.Fatal("expected at least one SignClaims call")
		}

		accessTokenClaims := signer.calls[0]

		if _, ok := accessTokenClaims["https://hasura.io/jwt/claims"]; ok {
			t.Error("expected hasura claims to NOT be present when no scopes")
		}
	})
}
