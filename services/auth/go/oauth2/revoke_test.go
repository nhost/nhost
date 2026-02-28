package oauth2_test

import (
	"context"
	"errors"
	"log/slog"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/oauth2"
	"github.com/nhost/nhost/services/auth/go/oauth2/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
)

func TestRevokeToken(t *testing.T) {
	t.Parallel()

	logger := slog.Default()
	clientID := "test-client"
	tokenValue := "test-token"
	tokenHash := oauth2.HashToken(tokenValue)

	confidentialClient := sql.AuthOauth2Client{ //nolint:exhaustruct
		ClientID:         clientID,
		ClientSecretHash: pgtype.Text{String: "hashed-secret", Valid: true},
	}

	publicClient := sql.AuthOauth2Client{ //nolint:exhaustruct
		ClientID: clientID,
	}

	cases := []struct {
		name        string
		db          func(ctrl *gomock.Controller) *mock.MockDBClient
		signer      func(ctrl *gomock.Controller) *mock.MockSigner
		verifyFn    oauth2.VerifySecretFunc
		request     api.OAuth2RevokeRequest
		expectedErr *oauth2.Error
	}{
		{
			name: "success - confidential client revokes token",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)
				m.EXPECT().DeleteOAuth2RefreshTokenByHashAndClientID(
					gomock.Any(),
					sql.DeleteOAuth2RefreshTokenByHashAndClientIDParams{
						TokenHash: tokenHash,
						ClientID:  clientID,
					},
				).Return(nil)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				return m
			},
			verifyFn: func(_, _ string) bool { return true },
			request: api.OAuth2RevokeRequest{ //nolint:exhaustruct
				Token:        tokenValue,
				ClientId:     new(clientID),
				ClientSecret: new("secret"),
			},
			expectedErr: nil,
		},
		{
			name: "success - public client revokes token",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(publicClient, nil)
				m.EXPECT().DeleteOAuth2RefreshTokenByHashAndClientID(
					gomock.Any(),
					sql.DeleteOAuth2RefreshTokenByHashAndClientIDParams{
						TokenHash: tokenHash,
						ClientID:  clientID,
					},
				).Return(nil)

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				return m
			},
			verifyFn: nil,
			request: api.OAuth2RevokeRequest{ //nolint:exhaustruct
				Token:    tokenValue,
				ClientId: new(clientID),
			},
			expectedErr: nil,
		},
		{
			name: "success - delete fails but revoke still succeeds",
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)
				m.EXPECT().DeleteOAuth2RefreshTokenByHashAndClientID(
					gomock.Any(), gomock.Any(),
				).Return(errors.New("db error")) //nolint:err113

				return m
			},
			signer: func(ctrl *gomock.Controller) *mock.MockSigner {
				m := mock.NewMockSigner(ctrl)
				return m
			},
			verifyFn: func(_, _ string) bool { return true },
			request: api.OAuth2RevokeRequest{ //nolint:exhaustruct
				Token:        tokenValue,
				ClientId:     new(clientID),
				ClientSecret: new("secret"),
			},
			expectedErr: nil,
		},
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
			verifyFn: nil,
			request: api.OAuth2RevokeRequest{ //nolint:exhaustruct
				Token:    tokenValue,
				ClientId: nil,
			},
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
			verifyFn: nil,
			request: api.OAuth2RevokeRequest{ //nolint:exhaustruct
				Token:    tokenValue,
				ClientId: new(string),
			},
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
			verifyFn: nil,
			request: api.OAuth2RevokeRequest{ //nolint:exhaustruct
				Token:    tokenValue,
				ClientId: new(clientID),
			},
			expectedErr: &oauth2.Error{
				Err:         "invalid_client",
				Description: "Unknown client",
			},
		},
		{
			name: "error - confidential client missing secret",
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
			verifyFn: nil,
			request: api.OAuth2RevokeRequest{ //nolint:exhaustruct
				Token:    tokenValue,
				ClientId: new(clientID),
			},
			expectedErr: &oauth2.Error{
				Err:         "invalid_client",
				Description: "Client secret required",
			},
		},
		{
			name: "error - confidential client wrong secret",
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
			verifyFn: func(_, _ string) bool { return false },
			request: api.OAuth2RevokeRequest{ //nolint:exhaustruct
				Token:        tokenValue,
				ClientId:     new(clientID),
				ClientSecret: new("wrong-secret"),
			},
			expectedErr: &oauth2.Error{
				Err:         "invalid_client",
				Description: "Invalid client credentials",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			mockDB := tc.db(ctrl)
			mockSigner := tc.signer(ctrl)

			provider := oauth2.NewProvider(
				mockDB, mockSigner, nil, tc.verifyFn,
				oauth2.Config{}, //nolint:exhaustruct
				nil,
			)

			gotErr := provider.RevokeToken(
				context.Background(), &tc.request, logger,
			)

			if diff := cmp.Diff(tc.expectedErr, gotErr); diff != "" {
				t.Errorf("error mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
