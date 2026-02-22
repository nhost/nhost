package oauth2_test

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"testing"

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

func errRedirect(oauthErr *oauth2.Error) string {
	return oauth2.ErrorRedirectURL(
		"https://example.com/callback",
		"some-state",
		"https://auth.example.com",
		oauthErr,
	)
}

func TestValidateAuthorizeRequest(t *testing.T) { //nolint:maintidx
	t.Parallel()

	logger := slog.Default()
	clientID := "test-client"
	redirectURI := "https://example.com/callback"
	issuer := "https://auth.example.com"
	authReqID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
	loginBase := "https://app.example.com/oauth2/login"

	confidentialClient := sql.AuthOauth2Client{ //nolint:exhaustruct
		ClientID:         clientID,
		ClientSecretHash: pgtype.Text{String: "hashed-secret", Valid: true},
		RedirectUris:     []string{redirectURI},
		Scopes:           []string{"openid", "profile", "email"},
	}

	publicClient := sql.AuthOauth2Client{ //nolint:exhaustruct
		ClientID:     clientID,
		RedirectUris: []string{redirectURI},
		Scopes:       []string{"openid", "profile", "email"},
	}

	baseParams := api.Oauth2AuthorizePostFormdataBody{
		ClientId:            clientID,
		RedirectUri:         redirectURI,
		ResponseType:        "code",
		Scope:               new("openid"),
		State:               new("some-state"),
		CodeChallenge:       nil,
		CodeChallengeMethod: nil,
		Nonce:               nil,
		Prompt:              nil,
		Resource:            nil,
	}

	authReqResult := sql.AuthOauth2AuthRequest{ //nolint:exhaustruct
		ID: authReqID,
	}

	cases := []struct {
		name        string
		config      oauth2.Config
		params      api.Oauth2AuthorizePostFormdataBody
		db          func(ctrl *gomock.Controller) *mock.MockDBClient
		expectedURL string
		expectedErr *oauth2.Error
	}{
		{
			name:   "success - confidential client",
			config: oauth2.Config{ClientURL: "https://app.example.com"}, //nolint:exhaustruct
			params: baseParams,
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)
				m.EXPECT().InsertOAuth2AuthRequest(gomock.Any(), gomock.Any()).
					Return(authReqResult, nil)

				return m
			},
			expectedURL: loginBase + "?request_id=" + authReqID.String(),
			expectedErr: nil,
		},
		{
			name: "success - uses configured LoginURL",
			config: oauth2.Config{ //nolint:exhaustruct
				LoginURL:  "https://custom-login.example.com/login",
				ClientURL: "https://app.example.com",
			},
			params: baseParams,
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)
				m.EXPECT().InsertOAuth2AuthRequest(gomock.Any(), gomock.Any()).
					Return(authReqResult, nil)

				return m
			},
			expectedURL: "https://custom-login.example.com/login?request_id=" + authReqID.String(),
			expectedErr: nil,
		},
		{
			name:   "success - prompt parameter forwarded",
			config: oauth2.Config{ClientURL: "https://app.example.com"}, //nolint:exhaustruct
			params: func() api.Oauth2AuthorizePostFormdataBody {
				p := baseParams
				p.Prompt = new("consent")

				return p
			}(),
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)
				m.EXPECT().InsertOAuth2AuthRequest(gomock.Any(), gomock.Any()).
					Return(authReqResult, nil)

				return m
			},
			expectedURL: loginBase + "?request_id=" + authReqID.String() + "&prompt=consent",
			expectedErr: nil,
		},
		{
			name:   "success - default scope openid when scope nil",
			config: oauth2.Config{ClientURL: "https://app.example.com"}, //nolint:exhaustruct
			params: func() api.Oauth2AuthorizePostFormdataBody {
				p := baseParams
				p.Scope = nil

				return p
			}(),
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)
				m.EXPECT().InsertOAuth2AuthRequest(gomock.Any(), gomock.Any()).
					Return(authReqResult, nil)

				return m
			},
			expectedURL: loginBase + "?request_id=" + authReqID.String(),
			expectedErr: nil,
		},
		{
			name:   "success - multiple scopes",
			config: oauth2.Config{ClientURL: "https://app.example.com"}, //nolint:exhaustruct
			params: func() api.Oauth2AuthorizePostFormdataBody {
				p := baseParams
				p.Scope = new("openid profile email")

				return p
			}(),
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)
				m.EXPECT().InsertOAuth2AuthRequest(gomock.Any(), gomock.Any()).
					Return(authReqResult, nil)

				return m
			},
			expectedURL: loginBase + "?request_id=" + authReqID.String(),
			expectedErr: nil,
		},
		{
			name:   "success - public client with PKCE",
			config: oauth2.Config{ClientURL: "https://app.example.com"}, //nolint:exhaustruct
			params: func() api.Oauth2AuthorizePostFormdataBody {
				p := baseParams
				p.CodeChallenge = new("challenge123")
				p.CodeChallengeMethod = new("S256")

				return p
			}(),
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(publicClient, nil)
				m.EXPECT().InsertOAuth2AuthRequest(gomock.Any(), gomock.Any()).
					Return(authReqResult, nil)

				return m
			},
			expectedURL: loginBase + "?request_id=" + authReqID.String(),
			expectedErr: nil,
		},
		{
			name:   "error - client not found",
			config: oauth2.Config{}, //nolint:exhaustruct
			params: baseParams,
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(sql.AuthOauth2Client{}, pgx.ErrNoRows) //nolint:exhaustruct

				return m
			},
			expectedURL: "",
			expectedErr: &oauth2.Error{Err: "invalid_client", Description: "Unknown client"},
		},
		{
			name:   "error - database error looking up client",
			config: oauth2.Config{}, //nolint:exhaustruct
			params: baseParams,
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(
						sql.AuthOauth2Client{},           //nolint:exhaustruct
						errors.New("connection refused"), //nolint:err113
					)

				return m
			},
			expectedURL: "",
			expectedErr: &oauth2.Error{Err: "server_error", Description: "Internal server error"},
		},
		{
			name:   "error - redirect URI not registered",
			config: oauth2.Config{}, //nolint:exhaustruct
			params: func() api.Oauth2AuthorizePostFormdataBody {
				p := baseParams
				p.RedirectUri = "https://evil.com/callback"

				return p
			}(),
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)

				return m
			},
			expectedURL: "",
			expectedErr: &oauth2.Error{Err: "invalid_request", Description: "Invalid redirect_uri"},
		},
		{
			name:   "error - unsupported response_type",
			config: oauth2.Config{}, //nolint:exhaustruct
			params: func() api.Oauth2AuthorizePostFormdataBody {
				p := baseParams
				p.ResponseType = "token"

				return p
			}(),
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)

				return m
			},
			expectedURL: errRedirect(
				&oauth2.Error{
					Err:         "unsupported_response_type",
					Description: "Only response_type=code is supported",
				},
			),
			expectedErr: &oauth2.Error{
				Err:         "unsupported_response_type",
				Description: "Only response_type=code is supported",
			},
		},
		{
			name:   "error - scope not allowed for client",
			config: oauth2.Config{}, //nolint:exhaustruct
			params: func() api.Oauth2AuthorizePostFormdataBody {
				p := baseParams
				p.Scope = new("openid admin")

				return p
			}(),
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)

				return m
			},
			expectedURL: errRedirect(
				&oauth2.Error{
					Err:         "invalid_scope",
					Description: `Scope "admin" not allowed for this client`,
				},
			),
			expectedErr: &oauth2.Error{
				Err:         "invalid_scope",
				Description: `Scope "admin" not allowed for this client`,
			},
		},
		{
			name:   "error - PKCE required for public client",
			config: oauth2.Config{}, //nolint:exhaustruct
			params: baseParams,
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(publicClient, nil)

				return m
			},
			expectedURL: errRedirect(
				&oauth2.Error{
					Err:         "invalid_request",
					Description: "PKCE code_challenge is required for public clients",
				},
			),
			expectedErr: &oauth2.Error{
				Err: "invalid_request", Description: "PKCE code_challenge is required for public clients",
			},
		},
		{
			name:   "error - PKCE empty string treated as missing",
			config: oauth2.Config{}, //nolint:exhaustruct
			params: func() api.Oauth2AuthorizePostFormdataBody {
				p := baseParams
				p.CodeChallenge = new("")

				return p
			}(),
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(publicClient, nil)

				return m
			},
			expectedURL: errRedirect(
				&oauth2.Error{
					Err:         "invalid_request",
					Description: "PKCE code_challenge is required for public clients",
				},
			),
			expectedErr: &oauth2.Error{
				Err: "invalid_request", Description: "PKCE code_challenge is required for public clients",
			},
		},
		{
			name:   "error - insert auth request fails",
			config: oauth2.Config{ClientURL: "https://app.example.com"}, //nolint:exhaustruct
			params: baseParams,
			db: func(ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(confidentialClient, nil)
				m.EXPECT().InsertOAuth2AuthRequest(gomock.Any(), gomock.Any()).
					Return(
						sql.AuthOauth2AuthRequest{}, //nolint:exhaustruct
						errors.New("db down"),       //nolint:err113
					)

				return m
			},
			expectedURL: errRedirect(
				&oauth2.Error{Err: "server_error", Description: "Internal server error"},
			),
			expectedErr: &oauth2.Error{Err: "server_error", Description: "Internal server error"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			mockDB := tc.db(ctrl)
			mockSigner := mock.NewMockSigner(ctrl)
			mockSigner.EXPECT().Issuer().Return(issuer).AnyTimes()

			provider := oauth2.NewProvider(
				mockDB, mockSigner, nil, nil,
				tc.config,
				&http.Client{}, //nolint:exhaustruct
			)

			gotURL, gotErr := provider.ValidateAuthorizeRequest(
				context.Background(), tc.params, logger,
			)

			if diff := cmp.Diff(tc.expectedURL, gotURL); diff != "" {
				t.Errorf("redirect URL mismatch (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(tc.expectedErr, gotErr); diff != "" {
				t.Errorf("error mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
