package oauth2_test

import (
	"context"
	"errors"
	"log/slog"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/oauth2"
	"github.com/nhost/nhost/services/auth/go/oauth2/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
)

func TestIntrospectToken(t *testing.T) { //nolint:maintidx
	t.Parallel()

	logger := slog.Default()
	clientID := "test-client"
	issuer := "https://auth.example.com"
	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
	refreshTokenValue := "test-refresh-token"
	accessTokenValue := "test-access-token"
	tokenHash := oauth2.HashToken(refreshTokenValue)

	now := time.Now()

	confidentialClient := sql.AuthOauth2Client{ //nolint:exhaustruct
		ClientID:         clientID,
		ClientSecretHash: pgtype.Text{String: "hashed-secret", Valid: true},
	}

	validRefreshToken := sql.AuthOauth2RefreshToken{ //nolint:exhaustruct
		TokenHash: tokenHash,
		ClientID:  clientID,
		UserID:    userID,
		Scopes:    []string{"openid", "profile"},
		ExpiresAt: sql.TimestampTz(now.Add(time.Hour)),
		CreatedAt: sql.TimestampTz(now.Add(-time.Hour)),
	}

	validToken := &jwt.Token{ //nolint:exhaustruct
		Valid: true,
		Claims: jwt.MapClaims{
			"sub":   userID.String(),
			"aud":   clientID,
			"scope": "openid profile",
			"iat":   float64(now.Add(-time.Hour).Unix()),
			"exp":   float64(now.Add(time.Hour).Unix()),
			"iss":   issuer,
		},
	}

	refreshTokenHint := api.OAuth2IntrospectRequestTokenTypeHintRefreshToken
	accessTokenHint := api.OAuth2IntrospectRequestTokenTypeHintAccessToken

	inactive := &api.OAuth2IntrospectResponse{Active: false} //nolint:exhaustruct

	cases := []struct {
		name             string
		db               func(ctrl *gomock.Controller) *mock.MockDBClient
		signer           func(ctrl *gomock.Controller) *mock.MockSigner
		request          api.OAuth2IntrospectRequest
		expectedResponse *api.OAuth2IntrospectResponse
		expectedErr      *oauth2.Error
	}{
		{
			name: "error - nil client_id",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				return m
			},
			request: api.OAuth2IntrospectRequest{
				Token:         refreshTokenValue,
				ClientId:      nil,
				ClientSecret:  nil,
				TokenTypeHint: nil,
			},
			expectedResponse: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_client",
				Description: "Client ID is required",
			},
		},
		{
			name: "error - empty client_id",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				return m
			},
			request: api.OAuth2IntrospectRequest{
				Token:         refreshTokenValue,
				ClientId:      new(""),
				ClientSecret:  nil,
				TokenTypeHint: nil,
			},
			expectedResponse: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_client",
				Description: "Client ID is required",
			},
		},
		{
			name: "error - unknown client",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(sql.AuthOauth2Client{}, pgx.ErrNoRows) //nolint:exhaustruct

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				return m
			},
			request: api.OAuth2IntrospectRequest{
				Token:         refreshTokenValue,
				ClientId:      new(clientID),
				ClientSecret:  nil,
				TokenTypeHint: nil,
			},
			expectedResponse: nil,
			expectedErr:      &oauth2.Error{Err: "invalid_client", Description: "Unknown client"},
		},
		{
			name: "error - client authentication failure",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				return m
			},
			request: api.OAuth2IntrospectRequest{ //nolint:exhaustruct
				Token:    refreshTokenValue,
				ClientId: new(clientID),
			},
			expectedResponse: nil,
			expectedErr: &oauth2.Error{
				Err:         "invalid_client",
				Description: "Client secret required",
			},
		},
		{
			name: "success - valid refresh token without hint",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)
				m.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), tokenHash).
					Return(validRefreshToken, nil)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().Issuer().Return(issuer)

				return m
			},
			request: api.OAuth2IntrospectRequest{ //nolint:exhaustruct
				Token:        refreshTokenValue,
				ClientId:     new(clientID),
				ClientSecret: new("secret"),
			},
			expectedResponse: &api.OAuth2IntrospectResponse{
				Active:    true,
				ClientId:  new(clientID),
				Sub:       new(userID.String()),
				Scope:     new("openid profile"),
				Exp:       new(int(validRefreshToken.ExpiresAt.Time.Unix())),
				Iat:       new(int(validRefreshToken.CreatedAt.Time.Unix())),
				Iss:       new(issuer),
				TokenType: new(oauth2.TokenTypeRefreshToken),
			},
			expectedErr: nil,
		},
		{
			name: "success - valid refresh token with refresh_token hint",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)
				m.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), tokenHash).
					Return(validRefreshToken, nil)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().Issuer().Return(issuer)

				return m
			},
			request: api.OAuth2IntrospectRequest{
				Token:         refreshTokenValue,
				ClientId:      new(clientID),
				ClientSecret:  new("secret"),
				TokenTypeHint: &refreshTokenHint,
			},
			expectedResponse: &api.OAuth2IntrospectResponse{
				Active:    true,
				ClientId:  new(clientID),
				Sub:       new(userID.String()),
				Scope:     new("openid profile"),
				Exp:       new(int(validRefreshToken.ExpiresAt.Time.Unix())),
				Iat:       new(int(validRefreshToken.CreatedAt.Time.Unix())),
				Iss:       new(issuer),
				TokenType: new(oauth2.TokenTypeRefreshToken),
			},
			expectedErr: nil,
		},
		{
			name: "inactive - expired refresh token with refresh_token hint",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)

				expiredRT := validRefreshToken
				expiredRT.ExpiresAt = sql.TimestampTz(now.Add(-time.Hour))

				m.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), tokenHash).
					Return(expiredRT, nil)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				return m
			},
			request: api.OAuth2IntrospectRequest{
				Token:         refreshTokenValue,
				ClientId:      new(clientID),
				ClientSecret:  new("secret"),
				TokenTypeHint: &refreshTokenHint,
			},
			expectedResponse: inactive,
			expectedErr:      nil,
		},
		{
			name: "inactive - refresh token belongs to different client",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)

				otherClientRT := validRefreshToken
				otherClientRT.ClientID = "other-client"

				m.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), tokenHash).
					Return(otherClientRT, nil)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				return m
			},
			request: api.OAuth2IntrospectRequest{
				Token:         refreshTokenValue,
				ClientId:      new(clientID),
				ClientSecret:  new("secret"),
				TokenTypeHint: &refreshTokenHint,
			},
			expectedResponse: inactive,
			expectedErr:      nil,
		},
		{
			name: "inactive - refresh token not found with refresh_token hint",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)
				m.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), tokenHash).
					Return(sql.AuthOauth2RefreshToken{}, pgx.ErrNoRows) //nolint:exhaustruct

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				return m
			},
			request: api.OAuth2IntrospectRequest{
				Token:         refreshTokenValue,
				ClientId:      new(clientID),
				ClientSecret:  new("secret"),
				TokenTypeHint: &refreshTokenHint,
			},
			expectedResponse: inactive,
			expectedErr:      nil,
		},
		{
			name: "fallthrough - refresh token not found, falls through to access token",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)
				m.EXPECT().GetOAuth2RefreshTokenByHash(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2RefreshToken{}, pgx.ErrNoRows) //nolint:exhaustruct

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().Validate(accessTokenValue).Return(validToken, nil)

				return m
			},
			request: api.OAuth2IntrospectRequest{ //nolint:exhaustruct
				Token:        accessTokenValue,
				ClientId:     new(clientID),
				ClientSecret: new("secret"),
			},
			expectedResponse: &api.OAuth2IntrospectResponse{
				Active:    true,
				ClientId:  new(clientID),
				Sub:       new(userID.String()),
				Scope:     new("openid profile"),
				Exp:       new(int(now.Add(time.Hour).Unix())),
				Iat:       new(int(now.Add(-time.Hour).Unix())),
				Iss:       new(issuer),
				TokenType: new("access_token"),
			},
			expectedErr: nil,
		},
		{
			name: "success - valid access token with access_token hint",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().Validate(accessTokenValue).Return(validToken, nil)

				return m
			},
			request: api.OAuth2IntrospectRequest{
				Token:         accessTokenValue,
				ClientId:      new(clientID),
				ClientSecret:  new("secret"),
				TokenTypeHint: &accessTokenHint,
			},
			expectedResponse: &api.OAuth2IntrospectResponse{
				Active:    true,
				ClientId:  new(clientID),
				Sub:       new(userID.String()),
				Scope:     new("openid profile"),
				Exp:       new(int(now.Add(time.Hour).Unix())),
				Iat:       new(int(now.Add(-time.Hour).Unix())),
				Iss:       new(issuer),
				TokenType: new("access_token"),
			},
			expectedErr: nil,
		},
		{
			name: "inactive - invalid access token",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				m.EXPECT().Validate(accessTokenValue).
					Return(nil, errors.New("invalid token")) //nolint:err113

				return m
			},
			request: api.OAuth2IntrospectRequest{
				Token:         accessTokenValue,
				ClientId:      new(clientID),
				ClientSecret:  new("secret"),
				TokenTypeHint: &accessTokenHint,
			},
			expectedResponse: inactive,
			expectedErr:      nil,
		},
		{
			name: "inactive - access token audience mismatch",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				wrongAudToken := &jwt.Token{ //nolint:exhaustruct
					Valid: true,
					Claims: jwt.MapClaims{
						"sub":   userID.String(),
						"aud":   "other-client",
						"scope": "openid",
						"iat":   float64(now.Add(-time.Hour).Unix()),
						"exp":   float64(now.Add(time.Hour).Unix()),
						"iss":   issuer,
					},
				}
				m.EXPECT().Validate(accessTokenValue).Return(wrongAudToken, nil)

				return m
			},
			request: api.OAuth2IntrospectRequest{
				Token:         accessTokenValue,
				ClientId:      new(clientID),
				ClientSecret:  new("secret"),
				TokenTypeHint: &accessTokenHint,
			},
			expectedResponse: inactive,
			expectedErr:      nil,
		},
		{
			name: "success - access token without scope",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				noScopeToken := &jwt.Token{ //nolint:exhaustruct
					Valid: true,
					Claims: jwt.MapClaims{
						"sub": userID.String(),
						"aud": clientID,
						"iat": float64(now.Add(-time.Hour).Unix()),
						"exp": float64(now.Add(time.Hour).Unix()),
						"iss": issuer,
					},
				}
				m.EXPECT().Validate(accessTokenValue).Return(noScopeToken, nil)

				return m
			},
			request: api.OAuth2IntrospectRequest{
				Token:         accessTokenValue,
				ClientId:      new(clientID),
				ClientSecret:  new("secret"),
				TokenTypeHint: &accessTokenHint,
			},
			expectedResponse: &api.OAuth2IntrospectResponse{ //nolint:exhaustruct
				Active:    true,
				ClientId:  new(clientID),
				Sub:       new(userID.String()),
				Exp:       new(int(now.Add(time.Hour).Unix())),
				Iat:       new(int(now.Add(-time.Hour).Unix())),
				Iss:       new(issuer),
				TokenType: new("access_token"),
			},
			expectedErr: nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			mockDB := tc.db(ctrl)
			mockSigner := tc.signer(ctrl)

			provider := oauth2.NewProvider(
				mockDB, mockSigner, nil,
				func(_, _ string) bool { return true },
				oauth2.Config{}, //nolint:exhaustruct
				nil,
			)

			gotResp, gotErr := provider.IntrospectToken(
				context.Background(), &tc.request, logger,
			)

			if diff := cmp.Diff(tc.expectedErr, gotErr); diff != "" {
				t.Errorf("error mismatch (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(tc.expectedResponse, gotResp); diff != "" {
				t.Errorf("response mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
